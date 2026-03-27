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

      const formData = new FormData()
      const audioResponse = await fetch(signedUrl)
      const audioBuffer = await audioResponse.arrayBuffer()
      formData.append('file', new Blob([audioBuffer]), 'audio.webm')
      formData.append('model', 'whisper-1')
      formData.append('response_format', 'verbose_json')
      formData.append('timestamp_granularities[]', 'word')

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: formData,
      })

      if (!response.ok) throw new Error(`Whisper API error: ${response.statusText}`)

      const result = await response.json() as { text: string }

      await prisma.recording.update({
        where: { id: recordingId },
        data: { transcript: result.text, status: 'DONE' },
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
