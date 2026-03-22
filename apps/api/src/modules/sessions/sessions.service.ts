import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { prisma, type Recording } from '@lavidz/database'
import { StorageService } from '../storage/storage.service'

@Injectable()
export class SessionsService {
  constructor(
    private readonly storageService: StorageService,
    @InjectQueue('transcription') private readonly transcriptionQueue: Queue,
  ) {}

  create(themeId: string): Promise<any> {
    return prisma.session.create({
      data: { themeId },
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

  async uploadRecording(sessionId: string, questionId: string, buffer: Buffer, mimetype: string): Promise<Recording> {
    await this.findOne(sessionId)
    const ext = mimetype.includes('webm') ? 'webm' : 'mp4'
    const key = `sessions/${sessionId}/raw/${questionId}.${ext}`

    await this.storageService.upload(key, buffer, mimetype)

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
