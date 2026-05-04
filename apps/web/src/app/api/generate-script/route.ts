export const runtime = 'nodejs'

import { generateObject } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth'
import { LAUNCHER_PROMPTS } from '@/lib/launcher-prompts'
import type { ContentFormat } from '@lavidz/types'

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '' })

// ── Zod schemas per format ────────────────────────────────────────────────────

const StorytellingSchema = z.object({
  kind: z.literal('storytelling'),
  beats: z.array(z.object({
    label: z.enum(['setup', 'tension', 'climax', 'resolution']),
    text: z.string(),
  })).min(3).max(4),
})

const HotTakeSchema = z.object({
  kind: z.literal('hot_take'),
  thesis: z.string(),
  arguments: z.array(z.string()).min(2).max(4),
  punchline: z.string(),
})

const QASchema = z.object({
  kind: z.literal('qa'),
  items: z.array(z.object({
    question: z.string(),
    keyPoints: z.array(z.string()).min(2).max(3),
  })).min(2).max(3),
})

const DailyTipSchema = z.object({
  kind: z.literal('daily_tip'),
  problem: z.string(),
  tip: z.string(),
  application: z.string(),
})

const MythVsRealitySchema = z.object({
  kind: z.literal('myth_vs_reality'),
  pairs: z.array(z.object({
    myth: z.string(),
    reality: z.string(),
  })).min(2).max(3),
})

const TeleprompterSchema = z.object({
  kind: z.literal('teleprompter'),
  script: z.string().min(50),
})

const SCHEMAS: Record<ContentFormat, z.ZodTypeAny> = {
  STORYTELLING: StorytellingSchema,
  HOT_TAKE: HotTakeSchema,
  QUESTION_BOX: QASchema,
  DAILY_TIP: DailyTipSchema,
  MYTH_VS_REALITY: MythVsRealitySchema,
  TELEPROMPTER: TeleprompterSchema,
}

const VALID_FORMATS: ContentFormat[] = [
  'STORYTELLING', 'HOT_TAKE', 'QUESTION_BOX', 'DAILY_TIP', 'MYTH_VS_REALITY', 'TELEPROMPTER',
]

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const orgId = (user.role === 'SUPERADMIN' && user.activeOrgId)
      ? user.activeOrgId
      : user.organizationId
    if (!orgId) return new Response('No organization', { status: 400 })

    const body = await req.json()
    const { answers, format, proposalContext } = body

    if (!answers?.a1 || !answers?.a2 || !answers?.a3) {
      return new Response('Missing answers', { status: 400 })
    }
    if (!proposalContext?.sujet) {
      return new Response('Missing proposalContext.sujet', { status: 400 })
    }
    if (!Array.isArray(proposalContext.beats) || proposalContext.beats.length === 0) {
      return new Response('Missing proposalContext.beats', { status: 400 })
    }
    if (!Array.isArray(proposalContext.beatLabels) || proposalContext.beatLabels.length === 0) {
      return new Response('Missing proposalContext.beatLabels', { status: 400 })
    }

    const targetFormat: ContentFormat = VALID_FORMATS.includes(format)
      ? format
      : (proposalContext.contentFormat ?? 'STORYTELLING')

    const promptFn = LAUNCHER_PROMPTS[targetFormat]
    const schema = SCHEMAS[targetFormat]
    const anchorSyncedAt = new Date().toISOString()

    let script: any
    try {
      const { object } = await generateObject({
        model: google('gemini-2.0-flash'),
        schema,
        prompt: promptFn(answers, proposalContext),
      })
      script = { ...(object as Record<string, unknown>), anchorSyncedAt }
    } catch (llmErr) {
      // Fallback: return an empty template with pre-labelled sections so the UI is never broken
      console.error('[generate-script] LLM error, returning fallback', llmErr)
      script = buildFallback(targetFormat, anchorSyncedAt)
    }

    return Response.json({
      format: targetFormat,
      script,
      recommendationReason: proposalContext.coachingTip ?? '',
    })
  } catch (err: any) {
    console.error('[POST /api/generate-script]', err)
    return new Response(err.message ?? 'Internal error', { status: 500 })
  }
}

// ── Fallback templates (LLM failure) ─────────────────────────────────────────

function buildFallback(format: ContentFormat, anchorSyncedAt: string): any {
  switch (format) {
    case 'STORYTELLING':
      return { kind: 'storytelling', anchorSyncedAt, beats: [
        { label: 'setup', text: '' },
        { label: 'tension', text: '' },
        { label: 'climax', text: '' },
        { label: 'resolution', text: '' },
      ]}
    case 'HOT_TAKE':
      return { kind: 'hot_take', anchorSyncedAt, thesis: '', arguments: ['', '', ''], punchline: '' }
    case 'QUESTION_BOX':
      return { kind: 'qa', anchorSyncedAt, items: [
        { question: '', keyPoints: ['', ''] },
        { question: '', keyPoints: ['', ''] },
        { question: '', keyPoints: ['', ''] },
      ]}
    case 'DAILY_TIP':
      return { kind: 'daily_tip', anchorSyncedAt, problem: '', tip: '', application: '' }
    case 'MYTH_VS_REALITY':
      return { kind: 'myth_vs_reality', anchorSyncedAt, pairs: [
        { myth: '', reality: '' },
        { myth: '', reality: '' },
      ]}
    case 'TELEPROMPTER':
    default:
      return { kind: 'teleprompter', anchorSyncedAt, script: '' }
  }
}
