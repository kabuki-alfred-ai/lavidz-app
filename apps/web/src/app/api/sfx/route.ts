import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { text, durationSeconds } = await req.json()
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) return new Response('Missing ElevenLabs API key', { status: 500 })
  if (!text) return new Response('Missing text prompt', { status: 400 })

  const body: Record<string, unknown> = { text, prompt_influence: 0.3 }
  if (durationSeconds) body.duration_seconds = durationSeconds

  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(`ElevenLabs error: ${err}`, { status: res.status })
  }

  const audio = Buffer.from(await res.arrayBuffer())
  const id = crypto.randomUUID()
  fs.writeFileSync(path.join('/tmp', `sfx-${id}.mp3`), audio)

  return Response.json({ id })
}
