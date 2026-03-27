import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 180

export async function POST(req: Request) {
  const apiKey = process.env.CLEANVOICE_API_KEY
  if (!apiKey)
    return new Response("CLEANVOICE_API_KEY manquant — ajoutez-le dans les variables d'environnement", { status: 500 })

  let { videoUrl } = await req.json()
  if (!videoUrl) return new Response('videoUrl required', { status: 400 })

  if (videoUrl.startsWith('/')) {
    const origin = req.headers.get('origin') ?? `http://${req.headers.get('host')}`
    videoUrl = `${origin}${videoUrl}`
  }

  const id = crypto.randomUUID()
  const outputPath = path.join('/tmp', `filler-cut-${id}.mp4`)

  // Submit job to Cleanvoice
  const editRes = await fetch('https://api.cleanvoice.ai/v2/edits', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: {
        files: [videoUrl],
        config: {
          fillers: true,
          remove_filler_words: true,
          hesitations: true,
          stutters: false,
          mouth_sounds: false,
          breath: 'natural',
          video: true,
          transcription: true,
          export_format: 'mp4',
        },
      },
    }),
  })
  if (!editRes.ok) throw new Error(`Cleanvoice submit error: ${await editRes.text()}`)
  const { id: jobId } = await editRes.json()

  // Poll until SUCCESS (5s intervals, max ~150s to stay within maxDuration)
  let jobResult: any = null
  for (let attempt = 0; attempt < 28; attempt++) {
    await new Promise(r => setTimeout(r, 5000))
    const statusRes = await fetch(`https://api.cleanvoice.ai/v2/edits/${jobId}`, {
      headers: { 'X-API-Key': apiKey },
    })
    const data = await statusRes.json()
    if (data.status === 'SUCCESS') { jobResult = data; break }
    if (data.status === 'FAILURE') throw new Error(`Cleanvoice processing failed: ${JSON.stringify(data)}`)
  }
  if (!jobResult) throw new Error('Cleanvoice timeout — vidéo trop longue pour être traitée dans le délai imparti')

  // Download cleaned video
  const downloadUrl = jobResult.audio?.download_url
  if (!downloadUrl) throw new Error('Cleanvoice: aucun lien de téléchargement dans la réponse')

  const cleanedRes = await fetch(downloadUrl)
  if (!cleanedRes.ok) throw new Error(`Impossible de télécharger la vidéo nettoyée (${cleanedRes.status})`)
  fs.writeFileSync(outputPath, Buffer.from(await cleanedRes.arrayBuffer()))

  // Extract word timestamps from Cleanvoice transcript (already in cleaned-video timeline)
  const rawWords: any[] = jobResult.transcript?.words ?? []
  const wordTimestamps = rawWords
    .map(w => ({
      word: (w.text ?? w.word ?? '') as string,
      start: (w.start ?? w.start_time ?? 0) as number,
      end: (w.end ?? w.end_time ?? 0) as number,
    }))
    .filter(w => w.word.trim().length > 0)

  const removed: number =
    jobResult.processing_stats?.filler_words_removed ??
    jobResult.audio?.statistics?.filler_sounds_removed ??
    0

  return Response.json({ id, removed, wordTimestamps })
}
