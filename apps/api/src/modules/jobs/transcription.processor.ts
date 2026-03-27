import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { prisma } from '@lavidz/database'
import { StorageService } from '../storage/storage.service'
import { TranscriptionJobData } from '@lavidz/types'

@Processor('transcription', { concurrency: 3 })
export class TranscriptionProcessor extends WorkerHost {
  constructor(private readonly storageService: StorageService) {
    super()
  }

  async process(job: Job<TranscriptionJobData>) {
    const { recordingId, audioKey } = job.data

    await prisma.recording.update({
      where: { id: recordingId },
      data: { status: 'TRANSCRIBING' },
    })

    try {
      const signedUrl = await this.storageService.getSignedUrl(audioKey)
      const audioResponse = await fetch(signedUrl)
      const audioBuffer = await audioResponse.arrayBuffer()

      const response = await fetch(
        'https://api.deepgram.com/v1/listen?model=nova-3&language=fr&smart_format=true',
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': 'audio/webm',
          },
          body: audioBuffer,
        },
      )

      if (!response.ok) throw new Error(`Deepgram error: ${response.statusText}`)

      const result = await response.json() as any
      const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''

      await prisma.recording.update({
        where: { id: recordingId },
        data: { transcript, status: 'DONE' },
      })
    } catch (error) {
      await prisma.recording.update({
        where: { id: recordingId },
        data: { status: 'FAILED' },
      })
      throw error
    }
  }
}
