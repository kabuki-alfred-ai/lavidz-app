import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { generateObject } from 'ai'
import { z } from 'zod'
import { prisma, type RecordingAnalysis } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'
import {
  buildAnalyzeRecordingPrompt,
  type RecordingStats,
  type RecordingTake,
} from '../prompts/analyze-recording.prompt'
import { VoiceGuardianService } from './voice-guardian.service'

const IMPROVEMENT_PATH_SCHEMA = z.object({
  path: z.string(),
  reason: z.string(),
  actionType: z.enum(['redo', 'montage_hint', 'none']),
  targetQuestionId: z.string().nullable().optional(),
  montageHint: z
    .object({
      type: z.string(),
      count: z.number().optional(),
    })
    .nullable()
    .optional(),
})

const ANALYSIS_SCHEMA = z.object({
  summary: z.array(z.string()).max(5),
  standoutMoment: z.string().nullable(),
  strengths: z.array(z.string()).max(3),
  improvementPaths: z.array(IMPROVEMENT_PATH_SCHEMA).max(2),
})

export type RecordingAnalysisResult = z.infer<typeof ANALYSIS_SCHEMA>

// A conservative list of French filler words and crutch phrases.
// Ordered roughly by specificity (multi-word first).
const FILLER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\btu vois\b/gi, label: 'tu vois' },
  { pattern: /\ben fait\b/gi, label: 'en fait' },
  { pattern: /\bc'est-?à-?dire\b/gi, label: "c'est-à-dire" },
  { pattern: /\bdu coup\b/gi, label: 'du coup' },
  { pattern: /\bquoi\b/gi, label: 'quoi' },
  { pattern: /\bbah\b/gi, label: 'bah' },
  { pattern: /\bben\b/gi, label: 'ben' },
  { pattern: /\beuh+\b/gi, label: 'euh' },
  { pattern: /\bhein\b/gi, label: 'hein' },
  { pattern: /\bvoilà\b/gi, label: 'voilà' },
]

@Injectable()
export class RecordingAnalysisService {
  private readonly logger = new Logger(RecordingAnalysisService.name)

  constructor(private readonly voiceGuardian: VoiceGuardianService) {}

  /**
   * Run full analysis pipeline for a session that has just been submitted.
   * Idempotent-ish: if a READY analysis already exists, it is re-generated
   * (regeneratedAt is set). Returns the fresh analysis record.
   */
  async analyzeSession(sessionId: string): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        theme: {
          include: {
            questions: { where: { active: true }, orderBy: { order: 'asc' } },
          },
        },
        topicEntity: true,
        recordings: {
          orderBy: { createdAt: 'asc' },
          include: { question: true },
        },
      },
    })

    if (!session) throw new NotFoundException(`Session ${sessionId} not found`)

    // Upsert a PENDING row so the frontend knows we started.
    await prisma.recordingAnalysis.upsert({
      where: { sessionId },
      create: { sessionId, status: 'PENDING' },
      update: { status: 'PENDING', errorMessage: null },
    })

    try {
      // Take the latest transcript per question (most recent Recording wins).
      const recordingsWithTranscript = session.recordings.filter(
        (r): r is typeof r & { transcript: string } =>
          typeof r.transcript === 'string' && r.transcript.trim().length > 0,
      )

      if (recordingsWithTranscript.length === 0) {
        await this.markEmpty(sessionId, 'Aucune transcription disponible.')
        return
      }

      const latestPerQuestion = new Map<string, (typeof recordingsWithTranscript)[number]>()
      for (const rec of recordingsWithTranscript) {
        latestPerQuestion.set(rec.questionId, rec)
      }

      const takes: RecordingTake[] = Array.from(latestPerQuestion.values()).map((rec) => ({
        questionId: rec.questionId,
        questionText: rec.question.text,
        transcript: rec.transcript,
        durationMs: this.estimateDurationFromWords(rec.wordTimestamps),
      }))

      const stats = this.computeStats(takes, Array.from(latestPerQuestion.values()).map((r) => r.wordTimestamps))

      // Pull profile for communicationStyle if organization-scoped.
      let communicationStyle: unknown = null
      const organizationId = session.theme?.organizationId ?? null
      if (organizationId) {
        const profile = await prisma.entrepreneurProfile.findUnique({
          where: { organizationId },
          select: { communicationStyle: true },
        })
        communicationStyle = profile?.communicationStyle ?? null
      }

      const prompt = buildAnalyzeRecordingPrompt({
        topicName: session.topicEntity?.name ?? session.theme?.name ?? null,
        topicAngle: session.topicEntity?.brief ?? null,
        topicPillar: session.topicEntity?.pillar ?? null,
        format: session.contentFormat,
        plannedHook: null,
        plannedQuestions: session.theme.questions.map((q) => ({ id: q.id, text: q.text })),
        takes,
        stats,
        communicationStyle,
      })

      const { object } = await generateObject({
        model: getDefaultModel(),
        schema: ANALYSIS_SCHEMA,
        prompt,
      })

      const existed = await prisma.recordingAnalysis.findUnique({
        where: { sessionId },
        select: { generatedAt: true },
      })

      await prisma.recordingAnalysis.update({
        where: { sessionId },
        data: {
          status: 'READY',
          summary: object.summary,
          standoutMoment: object.standoutMoment,
          strengths: object.strengths,
          improvementPaths: object.improvementPaths,
          stats: stats as unknown as object,
          errorMessage: null,
          generatedAt: existed?.generatedAt ?? new Date(),
          regeneratedAt: existed?.generatedAt ? new Date() : null,
        },
      })

      this.logger.log(`Analyse post-tournage prête pour la session ${sessionId}`)

      // Gardien de la voix — enrichit le profil de style à partir de la
      // transcription agrégée des prises retenues. Non-bloquant : si ça
      // échoue, l'analyse reste valide.
      if (organizationId) {
        const aggregatedTranscription = takes.map((t) => t.transcript).join('\n\n')
        try {
          await this.voiceGuardian.enrichFromTranscription({
            organizationId,
            transcription: aggregatedTranscription,
          })
        } catch (voiceErr) {
          this.logger.warn(
            `VoiceGuardian silently failed on session ${sessionId}: ${String(voiceErr)}`,
          )
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Échec de l'analyse pour la session ${sessionId}`, error as Error)
      await prisma.recordingAnalysis.update({
        where: { sessionId },
        data: { status: 'FAILED', errorMessage: message },
      })
      throw error
    }
  }

  private async markEmpty(sessionId: string, reason: string): Promise<void> {
    await prisma.recordingAnalysis.update({
      where: { sessionId },
      data: {
        status: 'READY',
        summary: [],
        standoutMoment: null,
        strengths: [],
        improvementPaths: [],
        stats: {},
        errorMessage: reason,
        generatedAt: new Date(),
      },
    })
  }

  /**
   * Rough duration estimate: takes the last wordTimestamp end if present,
   * otherwise returns undefined. wordTimestamps is a Deepgram-style array.
   */
  private estimateDurationFromWords(wordTimestamps: unknown): number | undefined {
    if (!Array.isArray(wordTimestamps) || wordTimestamps.length === 0) return undefined
    const last = wordTimestamps[wordTimestamps.length - 1] as Record<string, unknown> | undefined
    if (!last) return undefined
    const end = typeof last.end === 'number' ? last.end : typeof last.endTime === 'number' ? last.endTime : null
    return end !== null ? Math.round(end * 1000) : undefined
  }

  private computeStats(takes: RecordingTake[], wordTimestampsList: unknown[]): RecordingStats {
    const allText = takes.map((t) => t.transcript).join(' ')
    const words = allText.split(/\s+/).filter(Boolean)
    const totalWords = words.length

    // Filler detection — count matches across patterns, keep top 3 samples.
    const fillerCounts: Array<[string, number]> = []
    for (const { pattern, label } of FILLER_PATTERNS) {
      const matches = allText.match(pattern)
      if (matches && matches.length > 0) {
        fillerCounts.push([label, matches.length])
      }
    }
    fillerCounts.sort((a, b) => b[1] - a[1])
    const fillerSamples = fillerCounts.slice(0, 3).map(([label]) => label)
    const fillerCount = fillerCounts.reduce((sum, [, n]) => sum + n, 0)

    // Long silences — walk wordTimestamps and detect gaps > 1.5s.
    let longSilencesCount = 0
    for (const wts of wordTimestampsList) {
      if (!Array.isArray(wts)) continue
      for (let i = 1; i < wts.length; i++) {
        const prev = wts[i - 1] as Record<string, unknown>
        const cur = wts[i] as Record<string, unknown>
        const prevEnd = typeof prev?.end === 'number' ? prev.end : typeof prev?.endTime === 'number' ? prev.endTime : null
        const curStart = typeof cur?.start === 'number' ? cur.start : typeof cur?.startTime === 'number' ? cur.startTime : null
        if (prevEnd !== null && curStart !== null && curStart - prevEnd > 1.5) {
          longSilencesCount++
        }
      }
    }

    // Avg sentence length — split on terminal punctuation; ignore empty.
    const sentences = allText.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean)
    const avgSentenceLength =
      sentences.length > 0
        ? Math.round(
            sentences.reduce((sum, s) => sum + s.split(/\s+/).filter(Boolean).length, 0) /
              sentences.length,
          )
        : 0

    // Repetitions — naive 2-gram count, keep n-grams occurring >= 3 times.
    const repetitionHints: string[] = []
    const lowerWords = words.map((w) => w.toLowerCase().replace(/[^a-zà-ÿ']/g, ''))
    const bigrams = new Map<string, number>()
    for (let i = 0; i < lowerWords.length - 1; i++) {
      const bg = `${lowerWords[i]} ${lowerWords[i + 1]}`
      if (bg.length < 6) continue
      bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1)
    }
    for (const [bg, count] of bigrams.entries()) {
      if (count >= 3 && repetitionHints.length < 5) repetitionHints.push(bg)
    }

    const totalDurationMs = takes.reduce((sum, t) => sum + (t.durationMs ?? 0), 0)

    return {
      totalWords,
      totalDurationMs,
      fillerCount,
      fillerSamples,
      longSilencesCount,
      avgSentenceLength,
      repetitionHints,
    }
  }

  async getAnalysis(sessionId: string): Promise<RecordingAnalysis | null> {
    return prisma.recordingAnalysis.findUnique({ where: { sessionId } })
  }

  async requestRegeneration(sessionId: string): Promise<void> {
    await prisma.recordingAnalysis.upsert({
      where: { sessionId },
      create: { sessionId, status: 'PENDING' },
      update: { status: 'PENDING', errorMessage: null },
    })
  }

  /**
   * Invalidate a recording for a given question so the entrepreneur can
   * re-record it. The old recording is soft-hidden by being detached from
   * the latest-per-question selection (we rely on createdAt ordering in
   * `analyzeSession`, so a new Recording will naturally supersede it).
   *
   * For now we simply mark the existing recording's status as FAILED to
   * exclude it from the analysis pipeline — a fresh Recording row will
   * be created when the entrepreneur re-records.
   */
  async invalidateRecording(sessionId: string, questionId: string): Promise<void> {
    const existing = await prisma.recording.findFirst({
      where: { sessionId, questionId },
      orderBy: { createdAt: 'desc' },
    })
    if (!existing) throw new NotFoundException('Recording not found')
    await prisma.recording.update({
      where: { id: existing.id },
      data: { status: 'FAILED' },
    })
  }

  /**
   * Appends a montage hint (e.g. "remove_fillers, count: 3") to
   * Session.montageSettings.autoHints[]. The montage UI can read these
   * hints when opening the session for editing.
   */
  async addMontageHint(
    sessionId: string,
    hint: { type: string; count?: number; note?: string },
  ): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { montageSettings: true },
    })
    if (!session) throw new NotFoundException('Session not found')

    const current = (session.montageSettings as Record<string, unknown> | null) ?? {}
    const existingHints = Array.isArray(current.autoHints) ? (current.autoHints as unknown[]) : []

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        montageSettings: {
          ...current,
          autoHints: [...existingHints, { ...hint, addedAt: new Date().toISOString() }],
        } as any,
      },
    })
  }
}
