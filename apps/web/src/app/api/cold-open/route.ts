import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 60

type Word = { word: string; start: number; end: number }

const ColdOpenSchema = z.object({
  hook_phrase: z
    .string()
    .describe(
      'Le moment le plus choquant/intriguant de la transcription. Citation EXACTE, 2 à 6 mots MAX (1-2 secondes de parole). Chiffre inattendu, aveu fort, contradiction ou cliffhanger.',
    ),
  word_emojis: z
    .array(
      z.object({
        exact_word: z.string().describe('Un mot important exactement tel qu\'il apparaît dans la transcription (un seul mot)'),
        emoji: z.string().describe('Un seul emoji unicode qui représente ce mot ou son concept clé'),
      }),
    )
    .min(3)
    .max(8)
    .describe('3 à 8 mots importants de la transcription avec un emoji associé. Choisir des mots à fort impact émotionnel ou conceptuel : chiffres clés, verbes d\'action forts, concepts business, émotions. L\'emoji doit amplifier le sens du mot.'),
})

/**
 * Find the start/end timestamps of a phrase within word timestamps.
 * Uses a sliding-window approach matching normalised words.
 */
function matchPhrase(
  phrase: string,
  words: Word[],
): { start: number; end: number } | null {
  const phraseWords = phrase
    .toLowerCase()
    .replace(/[.,!?;:]/g, '')
    .split(/\s+/)
    .filter(Boolean)

  if (!phraseWords.length) return null

  const normWords = words.map(w =>
    w.word
      .toLowerCase()
      .replace(/[.,!?;:]/g, '')
      .trim(),
  )

  // Sliding window
  for (let i = 0; i <= normWords.length - phraseWords.length; i++) {
    let match = true
    for (let j = 0; j < phraseWords.length; j++) {
      if (normWords[i + j] !== phraseWords[j]) {
        match = false
        break
      }
    }
    if (match) {
      return {
        start: words[i].start,
        end: words[i + phraseWords.length - 1].end,
      }
    }
  }

  // Fuzzy: try matching a subset (at least 60% of words)
  const minMatch = Math.ceil(phraseWords.length * 0.6)
  for (let i = 0; i <= normWords.length - minMatch; i++) {
    let matched = 0
    let lastIdx = i
    for (let j = 0; j < phraseWords.length; j++) {
      const idx = normWords.indexOf(phraseWords[j], lastIdx)
      if (idx !== -1 && idx < i + phraseWords.length + 3) {
        matched++
        lastIdx = idx + 1
      }
    }
    if (matched >= minMatch) {
      const endIdx = Math.min(i + phraseWords.length - 1, words.length - 1)
      return { start: words[i].start, end: words[endIdx].end }
    }
  }

  return null
}

export async function POST(req: Request) {
  const { transcript, wordTimestamps, segmentId, videoDurationSeconds } = await req.json()

  if (!transcript || typeof transcript !== 'string') {
    return new Response('transcript requis', { status: 400 })
  }

  const rawWords: Word[] = Array.isArray(wordTimestamps) ? wordTimestamps : []

  if (!rawWords.length) {
    return Response.json({ error: 'wordTimestamps requis pour le time-matching' }, { status: 400 })
  }

  // Normalize timestamps to start at t=0 (removes any offset from source audio)
  const tOffset = rawWords[0].start
  const words: Word[] = tOffset === 0
    ? rawWords
    : rawWords.map(w => ({ word: w.word, start: w.start - tOffset, end: w.end - tOffset }))

  // Actual clip duration — clamp to word range if not provided
  const clipDuration: number = typeof videoDurationSeconds === 'number' && videoDurationSeconds > 0
    ? videoDurationSeconds
    : (words.length ? words[words.length - 1].end : 60)

  const prompt = `Tu es un monteur vidéo viral expert (MrBeast, Alex Hormozi, Léo Prieur, Tibo InShape). Tu maîtrises les codes des hooks courts qui stoppent le scroll.

Analyse cette transcription et :

1. ACCROCHE (hook_phrase) : Extraie LE moment le plus choquant, surprenant ou intriguant. RÈGLES ABSOLUES :
- Durée : 1 à 2 secondes de parole MAX (2 à 6 mots en général)
- Ce doit être une citation EXACTE du texte, pas une reformulation
- Préfère : un chiffre inattendu ("j'ai perdu 200 000€"), une contradiction ("j'ai tout quitté"), un aveu fort ("j'avais tort"), une promesse ("la méthode qui change tout"), un cliffhanger ("ce que personne ne dit")
- Évite : les phrases explicatives, les introductions, les questions rhétoriques banales
- L'objectif : que le spectateur soit OBLIGÉ de continuer pour comprendre

2. EMOJIS PAR MOT (word_emojis) : Identifie 3 à 8 mots à fort impact dans la transcription et associe à chacun un emoji qui AMPLIFIE LE SENS de ce mot spécifique. Règles : utiliser des mots EXACTS de la transcription (un seul mot), choisir des mots émotionnellement forts ou conceptuellement importants (chiffres, verbes d'action, concepts business, émotions). L'emoji doit illustrer directement le mot : "million" → 💰, "croissance" → 📈, "peur" → 😰, "lancé" → 🚀, "échoué" → 💀, "incroyable" → 🤯.

DURÉE DU CLIP : ${clipDuration.toFixed(1)} secondes

TRANSCRIPTION :
${transcript}`

  try {
    const model = google(process.env.AI_MODEL ?? 'gemini-2.0-flash')
    const { object } = await generateObject({
      model,
      schema: ColdOpenSchema,
      prompt,
    })

    // Time-match the hook phrase
    const phraseMatch = matchPhrase(object.hook_phrase, words)

    const coldOpen = phraseMatch
      ? {
          hookPhrase: object.hook_phrase,
          startInSeconds: phraseMatch.start,
          endInSeconds: phraseMatch.end,
          segmentId: segmentId ?? '',
        }
      : null

    // Build wordEmojis — filter out entries with empty words or emojis
    const wordEmojis = (object.word_emojis ?? [])
      .filter(e => e.exact_word && e.emoji)
      .map(e => ({ word: e.exact_word, emoji: e.emoji }))

    return Response.json({ coldOpen, wordEmojis })
  } catch (err: any) {
    console.error('[cold-open] Gemini error:', err)
    return new Response(`Gemini erreur : ${err?.message ?? 'inconnue'}`, { status: 500 })
  }
}
