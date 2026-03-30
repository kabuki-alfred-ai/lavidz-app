import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { prisma, type Recording } from '@lavidz/database'
import { StorageService } from '../storage/storage.service'
import { Resend } from 'resend'

@Injectable()
export class SessionsService {
  private readonly resend: Resend | null

  constructor(
    private readonly storageService: StorageService,
    @InjectQueue('transcription') private readonly transcriptionQueue: Queue,
    @InjectQueue('enrichment') private readonly enrichmentQueue: Queue,
  ) {
    this.resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  }

  async create(themeId: string, recipientEmail?: string, recipientName?: string): Promise<any> {
    let version = 1
    if (recipientEmail) {
      const count = await prisma.session.count({ where: { themeId, recipientEmail } })
      version = count + 1
    }
    return prisma.session.create({
      data: { themeId, recipientEmail, recipientName, version },
      include: { theme: { include: { questions: { where: { active: true }, orderBy: { order: 'asc' } } } } },
    })
  }

  async findOne(id: string): Promise<any> {
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        theme: { include: { questions: { where: { active: true }, orderBy: { order: 'asc' } } } },
        recordings: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!session) throw new NotFoundException(`Session ${id} not found`)
    return session
  }

  async submit(sessionId: string): Promise<any> {
    const session = await this.findOne(sessionId)

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    })

    const organizationId = session.theme?.organizationId as string | null | undefined
    if (organizationId) {
      const profile = await prisma.entrepreneurProfile.findUnique({
        where: { organizationId },
        select: { id: true },
      })

      if (profile) {
        await this.enrichmentQueue.add('enrich', {
          sessionId,
          profileId: profile.id,
        })
      }
    }

    return updated
  }

  async getSubmitted(): Promise<any[]> {
    return prisma.session.findMany({
      where: { status: { in: ['SUBMITTED', 'PROCESSING', 'DONE'] } },
      include: { theme: true },
      orderBy: { submittedAt: 'desc' },
    })
  }

  async saveFinalVideoKey(sessionId: string, key: string): Promise<any> {
    return prisma.session.update({
      where: { id: sessionId },
      data: { finalVideoKey: key, status: 'PROCESSING' },
    })
  }

  async saveMontageSettings(sessionId: string, settings: Record<string, unknown>): Promise<any> {
    return prisma.session.update({
      where: { id: sessionId },
      data: { montageSettings: settings as any },
    })
  }

  async saveRecordingCache(
    recordingId: string,
    data: {
      ttsAudioKey?: string
      ttsVoiceId?: string
      processedVideoKey?: string
      processingHash?: string
    },
  ): Promise<any> {
    return prisma.recording.update({
      where: { id: recordingId },
      data,
    })
  }

  async getRecordingTtsUrl(recordingId: string): Promise<string> {
    const recording = await prisma.recording.findUnique({ where: { id: recordingId } })
    if (!recording?.ttsAudioKey) throw new NotFoundException('No TTS audio cached for this recording')
    return this.storageService.getSignedUrl(recording.ttsAudioKey)
  }

  async getRecordingProcessedUrl(recordingId: string): Promise<string> {
    const recording = await prisma.recording.findUnique({ where: { id: recordingId } })
    if (!recording?.processedVideoKey) throw new NotFoundException('No processed video cached for this recording')
    return this.storageService.getSignedUrl(recording.processedVideoKey)
  }

  async uploadRecordingCache(
    sessionId: string,
    recordingId: string,
    buffer: Buffer,
    mimetype: string,
    type: 'tts' | 'processed',
    voiceId?: string,
    processingHash?: string,
  ): Promise<any> {
    const ext = type === 'tts' ? 'mp3' : 'mp4'
    const key = `sessions/${sessionId}/cache/${type}-${recordingId}.${ext}`
    await this.storageService.upload(key, buffer, mimetype)

    const data: Record<string, string> = {}
    if (type === 'tts') {
      data.ttsAudioKey = key
      if (voiceId) data.ttsVoiceId = voiceId
    } else {
      data.processedVideoKey = key
      if (processingHash) data.processingHash = processingHash
    }

    return prisma.recording.update({ where: { id: recordingId }, data })
  }

  async sendInvite(sessionId: string, shareUrl: string): Promise<void> {
    const session = await this.findOne(sessionId)
    if (!session.recipientEmail) {
      throw new BadRequestException('No recipient email for this session')
    }

    if (!this.resend) return

    const recipientName = session.recipientName ?? 'vous'
    const themeName = session.theme?.name ?? ''

    await this.resend.emails.send({
      from: process.env.EMAIL_FROM ?? process.env.RESEND_FROM ?? 'Lavidz <noreply@lavidz.fr>',
      to: session.recipientEmail,
      subject: `Votre lien d'enregistrement — ${themeName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #0a0a0a; color: #fff;">
          <div style="margin-bottom: 32px;">
            <div style="display: inline-flex; align-items: center; gap: 10px;">
              <div style="position: relative; width: 14px; height: 14px; flex-shrink: 0;">
                <span style="display: block; width: 12px; height: 12px; background: hsl(14, 100%, 55%);"></span>
                <span style="display: block; position: absolute; top: -2px; right: -2px; width: 6px; height: 6px; background: rgba(255, 107, 46, 0.4);"></span>
              </div>
              <span style="font-family: sans-serif; font-weight: 900; font-size: 15px; letter-spacing: -0.04em; text-transform: uppercase; color: #fff;">LAVIDZ</span>
            </div>
          </div>
          <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 12px; letter-spacing: -0.02em;">Bonjour ${recipientName},</h1>
          <p style="font-size: 15px; color: rgba(255,255,255,0.6); margin: 0 0 8px; line-height: 1.6;">
            Vous avez été invité(e) à enregistrer une vidéo pour le projet
          </p>
          <p style="font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 32px;">
            ${themeName}
          </p>
          <p style="font-size: 14px; color: rgba(255,255,255,0.5); margin: 0 0 28px; line-height: 1.6;">
            Cliquez sur le bouton ci-dessous pour accéder à votre session d'enregistrement. Vous pourrez répondre aux questions à votre rythme, depuis votre téléphone ou ordinateur.
          </p>
          <a href="${shareUrl}" style="display: inline-block; padding: 14px 28px; background: hsl(14, 100%, 55%); color: #fff; text-decoration: none; font-weight: 700; font-size: 15px; letter-spacing: -0.01em;">
            Commencer l'enregistrement →
          </a>
          <p style="margin-top: 40px; font-size: 11px; color: rgba(255,255,255,0.2); font-family: monospace; word-break: break-all;">
            ${shareUrl}
          </p>
        </div>
      `,
    })
  }

  async deliver(sessionId: string): Promise<any> {
    const session = await this.findOne(sessionId)
    if (!session.finalVideoKey) {
      throw new BadRequestException('No final video available for this session')
    }
    if (!session.recipientEmail) {
      throw new BadRequestException('No recipient email for this session')
    }

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000'
    const videoUrl = `${webUrl}/video/${sessionId}`

    if (this.resend) {
      const recipientName = session.recipientName ?? 'vous'
      await this.resend.emails.send({
        from: process.env.EMAIL_FROM ?? process.env.RESEND_FROM ?? 'Lavidz <noreply@lavidz.fr>',
        to: session.recipientEmail,
        subject: 'Votre montage est prêt 🎬',
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #0a0a0a; color: #fff;">
            <div style="margin-bottom: 32px;">
              <div style="display: inline-flex; align-items: center; gap: 10px;">
                <div style="position: relative; width: 14px; height: 14px; flex-shrink: 0;">
                  <span style="display: block; width: 12px; height: 12px; background: hsl(14, 100%, 55%);"></span>
                  <span style="display: block; position: absolute; top: -2px; right: -2px; width: 6px; height: 6px; background: rgba(255, 107, 46, 0.4);"></span>
                </div>
                <span style="font-family: sans-serif; font-weight: 900; font-size: 15px; letter-spacing: -0.04em; text-transform: uppercase; color: #fff;">LAVIDZ</span>
              </div>
            </div>
            <h1 style="font-size: 28px; font-weight: 800; margin: 0 0 12px; letter-spacing: -0.02em;">Bonjour ${recipientName},</h1>
            <p style="font-size: 16px; color: rgba(255,255,255,0.6); margin: 0 0 32px; line-height: 1.6;">
              Votre montage vidéo <strong style="color: #fff;">${session.theme?.name ?? ''}</strong> est prêt. Vous pouvez le visionner et le télécharger en cliquant sur le bouton ci-dessous.
            </p>
            <a href="${videoUrl}" style="display: inline-block; padding: 14px 28px; background: #fff; color: #000; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px;">
              Voir mon montage →
            </a>
            <p style="margin-top: 40px; font-size: 11px; color: rgba(255,255,255,0.2); font-family: monospace;">
              ${videoUrl}
            </p>
          </div>
        `,
      })
    }

    return prisma.session.update({
      where: { id: sessionId },
      data: { status: 'DONE', deliveredAt: new Date() },
    })
  }

  async getFinalVideoUrl(sessionId: string): Promise<string> {
    const session = await prisma.session.findUnique({ where: { id: sessionId } })
    if (!session?.finalVideoKey) throw new NotFoundException('No final video available')
    return this.storageService.getSignedUrl(session.finalVideoKey)
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { recordings: true },
    })
    if (!session) throw new NotFoundException('Session not found')

    const keysToDelete: string[] = []
    if (session.finalVideoKey) keysToDelete.push(session.finalVideoKey)
    for (const rec of session.recordings) {
      if (rec.rawVideoKey) keysToDelete.push(rec.rawVideoKey)
      if (rec.finalVideoKey) keysToDelete.push(rec.finalVideoKey)
      if (rec.ttsAudioKey) keysToDelete.push(rec.ttsAudioKey)
      if (rec.processedVideoKey) keysToDelete.push(rec.processedVideoKey)
    }

    await Promise.allSettled(keysToDelete.map(key => this.storageService.delete(key)))
    await prisma.session.delete({ where: { id: sessionId } })
  }

  async uploadRecording(sessionId: string, questionId: string, buffer: Buffer, mimetype: string): Promise<Recording> {
    await this.findOne(sessionId)
    const ext = mimetype.includes('webm') ? 'webm' : 'mp4'
    const key = `sessions/${sessionId}/raw/${questionId}.${ext}`

    await this.storageService.upload(key, buffer, mimetype)

    return this.confirmRecording(sessionId, questionId, key, mimetype)
  }

  async confirmRecording(sessionId: string, questionId: string, key: string, mimeType: string): Promise<Recording> {
    await this.findOne(sessionId)

    const recording = await prisma.recording.create({
      data: { sessionId, questionId, rawVideoKey: key },
    })

    await this.transcriptionQueue.add('transcribe', {
      recordingId: recording.id,
      audioKey: key,
    })

    return recording
  }

  async getRecordingUrl(recordingId: string): Promise<string> {
    const recording = await prisma.recording.findUnique({ where: { id: recordingId } })
    if (!recording?.finalVideoKey && !recording?.rawVideoKey) {
      throw new NotFoundException('No video available')
    }
    const key = recording.finalVideoKey ?? recording.rawVideoKey!
    return this.storageService.getSignedUrl(key)
  }
}
