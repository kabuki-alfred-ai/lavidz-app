import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 60

const SegmentSchema = z.object({
  segments: z.array(
    z.object({
      start: z.number().describe('Start time in seconds'),
      end: z.number().describe('End time in seconds'),
      reason: z.string().describe('Why this segment was kept'),
    }),
  ).describe('List of segments to keep in the final cut'),
})

export async function POST(req: Request) {
  const { transcript, wordTimestamps, duration, maxDuration: maxDur } = await req.json()

  if (!transcript || typeof transcript !== 'string') {
    return new Response('transcript requis', { status: 400 })
  }

  // Build a readable transcript with timestamps for Gemini
  let formattedTranscript = transcript
  if (Array.isArray(wordTimestamps) && wordTimestamps.length > 0) {
    // Group words into sentences with timestamps for readability
    const lines: string[] = []
    let lineWords: string[] = []
    let lineStart: number | null = null
    let lineEnd = 0
    for (const w of wordTimestamps) {
      if (lineStart === null) lineStart = w.start
      lineWords.push(w.word)
      lineEnd = w.end
      if (lineWords.length >= 10 || w.word.match(/[.!?]$/)) {
        lines.push(`[${(lineStart as number).toFixed(2)}s - ${lineEnd.toFixed(2)}s] ${lineWords.join(' ')}`)
        lineWords = []
        lineStart = null
      }
    }
    if (lineWords.length > 0 && lineStart !== null) {
      lines.push(`[${lineStart.toFixed(2)}s - ${lineEnd.toFixed(2)}s] ${lineWords.join(' ')}`)
    }
    formattedTranscript = lines.join('\n')
  }

  const durationInfo = duration ? `La vidéo dure ${duration.toFixed(1)} secondes.` : ''
  const maxDurInfo = maxDur ? `La durée maximale souhaitée est de ${maxDur} secondes.` : ''

  const prompt = `Tu es un monteur vidéo expert pour LinkedIn et les réseaux sociaux. ${durationInfo} ${maxDurInfo}

Voici la transcription horodatée d'une réponse à une question :

${formattedTranscript}

Analyse cette transcription et renvoie uniquement les segments (début, fin en secondes) à conserver pour obtenir une réponse dynamique, percutante et fluide.

Règles :
- Supprime les hésitations, répétitions et redondances
- Supprime les silences longs et les "euh", "hm", "bah"
- Garde les moments clés, les idées fortes et les formulations percutantes
- Assure une narration cohérente sans rupture de sens
- Chaque segment conservé doit durer au minimum 1.5 secondes
- Laisse 0.1s de marge au début et à la fin de chaque segment`

  try {
    const model = google(process.env.AI_MODEL ?? 'gemini-2.0-flash')
    const { object } = await generateObject({
      model,
      schema: SegmentSchema,
      prompt,
    })

    // Clamp segments to video duration
    const maxTime = duration ?? Infinity
    const clamped = object.segments
      .map(s => ({ ...s, start: Math.max(0, s.start), end: Math.min(maxTime, s.end) }))
      .filter(s => s.end - s.start >= 1.5)
      .sort((a, b) => a.start - b.start)

    return Response.json({ segments: clamped })
  } catch (err: any) {
    console.error('[smart-cut] Gemini error:', err)
    return new Response(`Gemini erreur : ${err?.message ?? 'inconnue'}`, { status: 500 })
  }
}
