import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { prisma } from '@lavidz/database'
import { StorageService } from '../storage/storage.service'
import { TranscriptionJobData } from '@lavidz/types'
import { createClient } from '@deepgram/sdk'

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
      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())

      const deepgram = createClient(process.env.DEEPGRAM_API_KEY ?? '')
      const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-3',
          language: 'fr',
          smart_format: true,
        },
      )

      if (error) throw new Error(`Deepgram error: ${error.message}`)

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
