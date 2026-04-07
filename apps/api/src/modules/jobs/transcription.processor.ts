import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { prisma } from '@lavidz/database'
import { StorageService } from '../storage/storage.service'
import { TranscriptionJobData } from '@lavidz/types'

function findFfmpeg(): string | null {
  for (const candidate of [process.env.FFMPEG_PATH, '/usr/bin/ffmpeg', 'ffmpeg'].filter(Boolean) as string[]) {
    try {
      if (spawnSync(candidate, ['-version'], { timeout: 3000 }).status === 0) return candidate
    } catch {}
  }
  return null
}

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
      let effectiveKey = audioKey
      const signedUrl = await this.storageService.getSignedUrl(audioKey)

      // Convert WebM to MP4 if needed — ensures stable duration metadata for the montage editor
      if (audioKey.endsWith('.webm')) {
        const mp4Key = audioKey.replace(/\.webm$/, '.mp4')
        const tmpInput = path.join(os.tmpdir(), `tr-in-${recordingId}.webm`)
        const tmpOutput = path.join(os.tmpdir(), `tr-out-${recordingId}.mp4`)
        try {
          const ffmpeg = findFfmpeg()
          if (ffmpeg) {
            const videoRes = await fetch(signedUrl)
            if (videoRes.ok && videoRes.body) {
              const { pipeline } = await import('stream/promises')
              const { Readable } = await import('stream')
              await pipeline(Readable.fromWeb(videoRes.body as any), fs.createWriteStream(tmpInput))

              const result = spawnSync(ffmpeg, [
                '-y', '-fflags', '+genpts',
                '-i', tmpInput,
                '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
                '-c:a', 'aac',
                '-movflags', '+faststart',
                tmpOutput,
              ], { timeout: 300_000 })

              if (result.status === 0) {
                const stat = fs.statSync(tmpOutput)
                await this.storageService.upload(mp4Key, fs.readFileSync(tmpOutput), 'video/mp4')
                await prisma.recording.update({
                  where: { id: recordingId },
                  data: { rawVideoKey: mp4Key },
                })
                effectiveKey = mp4Key
              }
            }
          }
        } catch (err) {
          console.error(`[transcription] WebM→MP4 conversion failed for ${recordingId}:`, err)
        } finally {
          try { fs.unlinkSync(tmpInput) } catch {}
          try { fs.unlinkSync(tmpOutput) } catch {}
        }
      }

      const effectiveSignedUrl = effectiveKey !== audioKey
        ? await this.storageService.getSignedUrl(effectiveKey)
        : signedUrl

      const audioResponse = await fetch(effectiveSignedUrl)
      const audioBuffer = await audioResponse.arrayBuffer()

      const response = await fetch(
        'https://api.deepgram.com/v1/listen?model=nova-3&language=fr&smart_format=true&filler_words=false',
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': effectiveKey.endsWith('.mp4') ? 'video/mp4' : 'audio/webm',
          },
          body: audioBuffer,
        },
      )

      if (!response.ok) throw new Error(`Deepgram error: ${response.statusText}`)

      const result = await response.json() as any
      const raw: string = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
      const transcript = raw
        .replace(/\s+'\s+/g, "'")
        .replace(/\s+'/g, "'")
        .replace(/'\s+/g, "'")

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
