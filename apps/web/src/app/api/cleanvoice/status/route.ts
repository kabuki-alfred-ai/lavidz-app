import fs from 'fs'
import path from 'path'
import { streamResponseToFile } from '@/lib/stream-file'
import { mergeElidedWords } from '@/lib/word-timestamps'
import { uploadFileToS3 } from '@/lib/s3'
import { cleanvoiceS3Key } from '@/lib/cleanvoice-storage'
import { remuxToFaststart } from '@/lib/ffmpeg'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  const id = searchParams.get('id')

  if (!jobId || !id) return new Response('jobId and id are required', { status: 400 })

  const apiKey = process.env.CLEANVOICE_API_KEY
  if (!apiKey) return new Response('CLEANVOICE_API_KEY manquant', { status: 500 })

  const statusRes = await fetch(`https://api.cleanvoice.ai/v2/edits/${jobId}`, {
    headers: { 'X-API-Key': apiKey },
  })
  if (!statusRes.ok) return new Response(`Cleanvoice status error (${statusRes.status})`, { status: 502 })

  const data = await statusRes.json()

  if (data.status === 'FAILURE') {
    return Response.json({ done: true, error: `Cleanvoice processing failed: ${JSON.stringify(data)}` })
  }

  if (data.status !== 'SUCCESS') {
    return Response.json({ done: false, status: data.status })
  }

  // SUCCESS — download the cleaned video and extract timestamps
  const result = data.result ?? data
  const downloadUrl = result.download_url
  if (!downloadUrl) {
    return Response.json({ done: true, error: `Cleanvoice: aucun lien de téléchargement dans la réponse` })
  }

  const rawPath = path.join('/tmp', `cleanvoice-${id}-raw.mp4`)
  const outputPath = path.join('/tmp', `cleanvoice-${id}.mp4`)
  const cleanedRes = await fetch(downloadUrl)
  if (!cleanedRes.ok) {
    return Response.json({ done: true, error: `Impossible de télécharger la vidéo nettoyée (${cleanedRes.status})` })
  }
  await streamResponseToFile(cleanedRes, rawPath)

  // Cleanvoice returns MP4 with moov atom at end of file — forces Chromium (and
  // Remotion's renderer) to download the full file before seeking, which times
  // out delayRender on large videos. Remux with +faststart (no re-encode) to
  // move moov to the start. If ffmpeg is unavailable, fall back to the raw file.
  const remuxed = remuxToFaststart(rawPath, outputPath)
  if (!remuxed) {
    fs.renameSync(rawPath, outputPath)
  } else {
    try { fs.unlinkSync(rawPath) } catch {}
  }

  // Upload to MinIO/S3 so the file is reachable from any serverless instance during render.
  // The /tmp copy is kept for the current invocation (fast local access) and GC'd by purgeStaleTmpFiles.
  try {
    await uploadFileToS3(outputPath, cleanvoiceS3Key(id), 'video/mp4')
  } catch (uploadErr) {
    console.error('[cleanvoice] MinIO upload failed:', uploadErr)
  }

  const rawWords: any[] = result.transcription?.transcription?.words ?? result.transcript?.words ?? []
  const wordTimestamps = mergeElidedWords(
    rawWords
      .map((w: any) => ({
        word: (w.text ?? w.word ?? '') as string,
        start: (w.start ?? w.start_time ?? 0) as number,
        end: (w.end ?? w.end_time ?? 0) as number,
      }))
      .filter((w: any) => w.word.trim().length > 0)
  )

  const stats = result.statistics ?? {}
  const removed: number =
    result.processing_stats?.filler_words_removed ??
    Object.values(stats).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0)

  return Response.json({ done: true, id, removed, wordTimestamps })
}
