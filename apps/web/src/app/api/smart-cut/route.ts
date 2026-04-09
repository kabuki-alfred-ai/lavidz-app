import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 60

type Word = { word: string; start: number; end: number }

const SegmentSchema = z.object({
  segments: z.array(
    z.object({
      start: z.number().describe('Start time in seconds — must match exactly a timestamp from the transcript'),
      end: z.number().describe('End time in seconds — must match exactly a timestamp from the transcript'),
    }),
  ).describe('List of segments to keep. Use ONLY timestamps that appear in the transcript.'),
})

/**
 * Snap a time value to the nearest word boundary.
 * For start: snap to the nearest word.start
 * For end: snap to the nearest word.end
 */
function snapToWord(time: number, words: Word[], type: 'start' | 'end'): number {
  if (!words.length) return time
  let best = words[0]
  let bestDist = Infinity
  for (const w of words) {
    const ref = type === 'start' ? w.start : w.end
    const dist = Math.abs(ref - time)
    if (dist < bestDist) { bestDist = dist; best = w }
  }
  return type === 'start' ? best.start : best.end
}

/**
 * Format words as numbered sentences for Gemini.
 * Each line = one sentence (split on .!?), with its start and end timestamp.
 */
function formatSentences(words: Word[]): string {
  const sentences: { text: string; start: number; end: number }[] = []
  let buf: Word[] = []

  for (const w of words) {
    buf.push(w)
    if (w.word.match(/[.!?]$/) || buf.length >= 20) {
      sentences.push({
        text: buf.map(x => x.word).join(' '),
        start: buf[0].start,
        end: buf[buf.length - 1].end,
      })
      buf = []
    }
  }
  if (buf.length) {
    sentences.push({
      text: buf.map(x => x.word).join(' '),
      start: buf[0].start,
      end: buf[buf.length - 1].end,
    })
  }

  return sentences
    .map((s, i) => `${i + 1}. [${s.start.toFixed(2)}s → ${s.end.toFixed(2)}s] ${s.text}`)
    .join('\n')
}

export async function POST(req: Request) {
  const { transcript, wordTimestamps, duration, maxDuration: maxDur } = await req.json()

  if (!transcript || typeof transcript !== 'string') {
    return new Response('transcript requis', { status: 400 })
  }

  const words: Word[] = Array.isArray(wordTimestamps) ? wordTimestamps : []
  const hasTimestamps = words.length > 0

  const formattedTranscript = hasTimestamps
    ? formatSentences(words)
    : transcript

  const durationInfo = duration ? `La vidéo dure ${(duration as number).toFixed(1)} secondes.` : ''
  const maxDurInfo = maxDur ? `La durée maximale souhaitée est de ${maxDur} secondes.` : ''

  const prompt = `Tu es un monteur vidéo expert pour LinkedIn. ${durationInfo} ${maxDurInfo}

Voici la transcription numérotée phrase par phrase avec les timestamps exacts :

${formattedTranscript}

Renvoie les segments (début, fin en secondes) à CONSERVER pour obtenir une réponse percutante et fluide.

RÈGLES STRICTES :
- Utilise UNIQUEMENT des valeurs de timestamps qui apparaissent dans la transcription ci-dessus
- Ne coupe JAMAIS au milieu d'une phrase — chaque segment doit commencer et finir à une limite de phrase
- Supprime les hésitations, répétitions, "euh", "hm", les phrases inachevées
- Garde les idées fortes et les formulations percutantes
- Chaque segment doit durer au minimum 2 secondes
- Si la réponse est déjà bonne, retourne un seul segment couvrant toute la durée`

  try {
    const model = google(process.env.AI_MODEL ?? 'gemini-2.0-flash')
    const { object } = await generateObject({
      model,
      schema: SegmentSchema,
      prompt,
    })

    const maxTime = (duration as number | undefined) ?? Infinity

    const snapped = object.segments
      .map(s => ({
        start: hasTimestamps ? snapToWord(s.start, words, 'start') : Math.max(0, s.start),
        end:   hasTimestamps ? snapToWord(s.end,   words, 'end')   : Math.min(maxTime, s.end),
      }))
      .map(s => ({ start: Math.max(0, s.start), end: Math.min(maxTime, s.end) }))
      .filter(s => s.end - s.start >= 1.5)
      .sort((a, b) => a.start - b.start)
      // Merge overlapping or adjacent segments (gap < 0.3s)
      .reduce<{ start: number; end: number }[]>((acc, seg) => {
        const last = acc[acc.length - 1]
        if (last && seg.start - last.end < 0.3) {
          last.end = Math.max(last.end, seg.end)
        } else {
          acc.push({ ...seg })
        }
        return acc
      }, [])

    return Response.json({ segments: snapped })
  } catch (err: any) {
    console.error('[smart-cut] Gemini error:', err)
    return new Response(`Gemini erreur : ${err?.message ?? 'inconnue'}`, { status: 500 })
  }
}
