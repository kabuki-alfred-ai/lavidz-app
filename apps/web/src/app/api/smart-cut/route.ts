import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 60

type Word = { word: string; start: number; end: number }
type Sentence = { index: number; text: string; start: number; end: number }

/**
 * Split word timestamps into sentences.
 * A sentence ends when: punctuation .!? is found, or after MAX_WORDS words without punctuation.
 */
function buildSentences(words: Word[]): Sentence[] {
  const MAX_WORDS = 25
  const sentences: Sentence[] = []
  let buf: Word[] = []

  const flush = () => {
    if (!buf.length) return
    sentences.push({
      index: sentences.length + 1,
      text: buf.map(w => w.word).join(' '),
      start: buf[0].start,
      end: buf[buf.length - 1].end,
    })
    buf = []
  }

  for (const w of words) {
    buf.push(w)
    if (w.word.match(/[.!?]$/) || buf.length >= MAX_WORDS) flush()
  }
  flush()
  return sentences
}

/**
 * Merge consecutive kept sentence indices into contiguous time segments.
 */
function sentencesToSegments(
  kept: number[],
  sentences: Sentence[],
): { start: number; end: number }[] {
  const keptSet = new Set(kept)
  const result: { start: number; end: number }[] = []

  for (const s of sentences) {
    if (!keptSet.has(s.index)) continue
    const last = result[result.length - 1]
    if (last && s.start - last.end < 0.5) {
      // Merge with previous segment if close enough
      last.end = s.end
    } else {
      result.push({ start: s.start, end: s.end })
    }
  }

  return result
}

const SelectionSchema = z.object({
  keep: z.array(z.number().int()).describe(
    'List of sentence numbers (1-based) to keep in the final cut',
  ),
})

export async function POST(req: Request) {
  const { transcript, wordTimestamps, duration } = await req.json()

  if (!transcript || typeof transcript !== 'string') {
    return new Response('transcript requis', { status: 400 })
  }

  const words: Word[] = Array.isArray(wordTimestamps) ? wordTimestamps : []

  // Fall back to plain transcript if no word timestamps
  if (!words.length) {
    return Response.json({ segments: [{ start: 0, end: duration ?? 0 }] })
  }

  const sentences = buildSentences(words)

  if (sentences.length <= 1) {
    // Nothing to cut
    return Response.json({ segments: [{ start: sentences[0]?.start ?? 0, end: sentences[0]?.end ?? (duration ?? 0) }] })
  }

  const formattedList = sentences
    .map(s => `${s.index}. [${s.start.toFixed(2)}s → ${s.end.toFixed(2)}s] ${s.text}`)
    .join('\n')

  const durationInfo = duration ? `La vidéo dure ${(duration as number).toFixed(1)} secondes.` : ''

  const prompt = `Tu es un monteur vidéo expert pour LinkedIn. ${durationInfo}

Voici la transcription découpée en phrases numérotées :

${formattedList}

Renvoie la liste des numéros de phrases à CONSERVER pour obtenir une réponse dynamique et percutante.

RÈGLES :
- Supprime les hésitations, répétitions, redondances et phrases inachevées
- Garde les idées fortes, les formulations percutantes et la narration cohérente
- Ne retourne QUE des numéros de phrases existants (entre 1 et ${sentences.length})
- Si la réponse est déjà bonne, retourne tous les numéros`

  try {
    const model = google(process.env.AI_MODEL ?? 'gemini-2.0-flash')
    const { object } = await generateObject({
      model,
      schema: SelectionSchema,
      prompt,
    })

    // Validate indices, clamp to valid range
    const validKept = [...new Set(object.keep)]
      .filter(n => Number.isInteger(n) && n >= 1 && n <= sentences.length)
      .sort((a, b) => a - b)

    if (!validKept.length) {
      // Gemini returned nothing valid — keep everything
      return Response.json({ segments: [{ start: sentences[0].start, end: sentences[sentences.length - 1].end }] })
    }

    const segments = sentencesToSegments(validKept, sentences)

    return Response.json({ segments, debug: { sentenceCount: sentences.length, kept: validKept } })
  } catch (err: any) {
    console.error('[smart-cut] Gemini error:', err)
    return new Response(`Gemini erreur : ${err?.message ?? 'inconnue'}`, { status: 500 })
  }
}
