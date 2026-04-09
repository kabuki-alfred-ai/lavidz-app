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

type WordToken = { word: string; start: number; end: number }

/** Merge elided tokens split at apostrophe: ["j'", "étais"] → ["j'étais"] */
function mergeElidedWords(words: WordToken[]): WordToken[] {
  const result: WordToken[] = []
  let i = 0
  while (i < words.length) {
    const w = words[i]
    if (w.word.endsWith("'") && i + 1 < words.length) {
      result.push({ word: w.word + words[i + 1].word, start: w.start, end: words[i + 1].end })
      i += 2
    } else {
      result.push(w)
      i++
    }
  }
  return result
}

/** Whisper via Groq or OpenAI — returns { transcript, wordTimestamps } */
async function transcribeWithWhisper(
  audioPath: string,
  apiKey: string,
  endpoint: string,
  model: string,
): Promise<{ transcript: string; wordTimestamps: WordToken[] }> {
  const audioBuffer = fs.readFileSync(audioPath)
  const formData = new FormData()
  formData.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3')
  formData.append('model', model)
  formData.append('language', 'fr')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'word')

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })
  if (!res.ok) throw new Error(`Whisper API error: ${await res.text()}`)

  const data = await res.json() as { text: string; words?: { word: string; start: number; end: number }[] }
  const rawWords: WordToken[] = (data.words ?? []).map(w => ({ word: w.word.trim(), start: w.start, end: w.end }))
  return { transcript: data.text.trim(), wordTimestamps: mergeElidedWords(rawWords) }
}

/** Deepgram nova-3 — fallback when no Whisper key is available */
async function transcribeWithDeepgram(
  videoBuffer: ArrayBuffer,
  contentType: string,
): Promise<{ transcript: string; wordTimestamps: WordToken[] }> {
  const res = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-3&language=fr&smart_format=true&filler_words=false&punctuate=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': contentType,
      },
      body: videoBuffer,
    },
  )
  if (!res.ok) throw new Error(`Deepgram error: ${res.statusText}`)

  const result = await res.json() as any
  const alternative = result?.results?.channels?.[0]?.alternatives?.[0]
  const raw: string = (alternative?.transcript ?? '')
    .replace(/\s+'\s+/g, "'").replace(/\s+'/g, "'").replace(/'\s+/g, "'")

  const rawWords: WordToken[] = (alternative?.words ?? []).map((w: any) => ({
    word: (w.punctuated_word ?? w.word) as string,
    start: w.start as number,
    end: w.end as number,
  }))
  return { transcript: raw, wordTimestamps: mergeElidedWords(rawWords) }
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
                '-c:a', 'aac', '-movflags', '+faststart',
                tmpOutput,
              ], { timeout: 300_000 })

              if (result.status === 0) {
                await this.storageService.upload(mp4Key, fs.readFileSync(tmpOutput), 'video/mp4')
                await prisma.recording.update({ where: { id: recordingId }, data: { rawVideoKey: mp4Key } })
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

      // Prefer Whisper (Groq or OpenAI) — significantly better for French
      const groqKey = process.env.GROQ_API_KEY
      const openaiKey = process.env.OPENAI_API_KEY
      const useWhisper = !!(groqKey || openaiKey)

      let transcript: string
      let wordTimestamps: WordToken[]

      if (useWhisper) {
        const ffmpeg = findFfmpeg()
        if (!ffmpeg) throw new Error('FFmpeg introuvable pour extraction audio')

        // Download video to tmp
        const tmpVideo = path.join(os.tmpdir(), `tr-video-${recordingId}.mp4`)
        const tmpAudio = path.join(os.tmpdir(), `tr-audio-${recordingId}.mp3`)
        try {
          const videoRes = await fetch(effectiveSignedUrl)
          if (!videoRes.ok || !videoRes.body) throw new Error('Téléchargement vidéo échoué')
          const { pipeline } = await import('stream/promises')
          const { Readable } = await import('stream')
          await pipeline(Readable.fromWeb(videoRes.body as any), fs.createWriteStream(tmpVideo))

          // Extract audio: mono 16kHz MP3 — optimal for Whisper
          const ffResult = spawnSync(ffmpeg, [
            '-y', '-i', tmpVideo,
            '-vn', '-ar', '16000', '-ac', '1', '-b:a', '64k',
            tmpAudio,
          ], { timeout: 120_000 })
          if (ffResult.status !== 0) throw new Error(`FFmpeg audio extraction: ${ffResult.stderr?.toString()}`)

          const endpoint = groqKey
            ? 'https://api.groq.com/openai/v1/audio/transcriptions'
            : 'https://api.openai.com/v1/audio/transcriptions'
          const model = groqKey ? 'whisper-large-v3' : 'whisper-1'
          const apiKey = (groqKey ?? openaiKey)!

          ;({ transcript, wordTimestamps } = await transcribeWithWhisper(tmpAudio, apiKey, endpoint, model))
        } finally {
          try { fs.unlinkSync(tmpVideo) } catch {}
          try { fs.unlinkSync(tmpAudio) } catch {}
        }
      } else {
        // Fallback: Deepgram nova-3
        const audioResponse = await fetch(effectiveSignedUrl)
        const audioBuffer = await audioResponse.arrayBuffer()
        const contentType = effectiveKey.endsWith('.mp4') ? 'video/mp4' : 'audio/webm'
        ;({ transcript, wordTimestamps } = await transcribeWithDeepgram(audioBuffer, contentType))
      }

      await prisma.recording.update({
        where: { id: recordingId },
        data: { transcript, wordTimestamps, status: 'DONE' },
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
