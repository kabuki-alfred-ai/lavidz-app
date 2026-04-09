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
      'La phrase la plus percutante de la transcription (entre 3 et 5 secondes de temps de parole estimé). Doit être une citation exacte du texte.',
    ),
  visual_inlays: z
    .array(
      z.object({
        exact_word: z
          .string()
          .describe('Un mot-clé fort exactement tel qu\'il apparaît dans la transcription'),
        category: z.enum([
          'alert',
          'money',
          'growth',
          'idea',
          'fire',
          'heart',
          'target',
          'star',
        ]),
      }),
    )
    .max(5)
    .describe('3 à 5 mots-clés forts avec une catégorie visuelle'),
  context_emojis: z
    .array(
      z.object({
        start_seconds: z.number().describe('Timestamp de début en secondes (depuis le début de la transcription)'),
        end_seconds: z.number().describe('Timestamp de fin en secondes'),
        emoji: z.string().describe('Un seul emoji unicode ultra-expressif qui représente le thème ou l\'émotion de ce moment'),
      }),
    )
    .max(8)
    .describe('5 à 8 moments clés de la transcription avec un emoji contextuel. L\'emoji doit représenter le THÈME ou l\'ÉMOTION dominante de ce passage (pas un mot précis) : émotion forte 😱🥹💀, concept business 💰🚀💎, énergie 🔥⚡💥, introspection 🧠👀, succès 🏆✅, etc. Chaque moment dure en général 3 à 8 secondes.'),
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

/**
 * Find the first occurrence of a word in the word timestamps.
 */
function matchWord(target: string, words: Word[]): number | null {
  const norm = target
    .toLowerCase()
    .replace(/[.,!?;:]/g, '')
    .trim()
  for (const w of words) {
    const wNorm = w.word
      .toLowerCase()
      .replace(/[.,!?;:]/g, '')
      .trim()
    if (wNorm === norm || wNorm.includes(norm) || norm.includes(wNorm)) {
      return w.start
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

  // Keep only the words that fall within the actual clip duration
  const clippedWords = words.filter(w => w.start < clipDuration)

  const prompt = `Tu es un monteur vidéo expert pour les réseaux sociaux (LinkedIn, TikTok, YouTube Shorts).

Analyse cette transcription et :

1. ACCROCHE (hook_phrase) : Extraie la phrase la plus percutante, surprenante ou intrigante qui donnerait envie de regarder la vidéo. Elle doit durer entre 3 et 5 secondes de parole. Ce doit être une citation EXACTE du texte.

2. INCRUSTATIONS VISUELLES (visual_inlays) : Identifie 3 à 5 mots-clés forts et associe-leur une catégorie visuelle parmi : alert (problème, danger), money (argent, business, CA), growth (croissance, évolution), idea (idée, innovation), fire (intensité, énergie), heart (passion, émotion), target (objectif, cible), star (succès, excellence).

Les mots-clés doivent être des mots EXACTS présents dans la transcription.

3. EMOJIS CONTEXTUELS (context_emojis) : Identifie des moments clés dans la transcription et associe à chacun un emoji qui représente le THÈME ou l'ÉMOTION dominante de ce passage. CONTRAINTE ABSOLUE : tous les timestamps doivent être compris entre 0.0 et ${clipDuration.toFixed(1)} secondes (durée réelle du clip). Utilise UNIQUEMENT les timestamps des mots fournis ci-dessous pour déterminer start_seconds et end_seconds. L'emoji doit capturer l'essence émotionnelle ou thématique du passage, pas un mot précis : 😱 (surprise/choc), 🔥 (intensité/passion), 💰 (argent/opportunité), 🚀 (ambition/croissance), 🧠 (réflexion/insight), 💎 (valeur/excellence), 🥹 (émotion/touché), ⚡ (énergie/urgence), 🏆 (succès/victoire), 💀 (échec/danger évité).

DURÉE DU CLIP : ${clipDuration.toFixed(1)} secondes
TIMESTAMPS DES MOTS (utilise ces valeurs exactes) :
${clippedWords.map(w => `${w.start.toFixed(2)}s "${w.word}"`).join(' | ')}

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

    // Time-match each visual inlay
    const inlays = object.visual_inlays
      .map(inlay => {
        const time = matchWord(inlay.exact_word, words)
        if (time === null) return null
        return {
          exactWord: inlay.exact_word,
          category: inlay.category,
          timeInSeconds: time,
        }
      })
      .filter(Boolean)

    // Build contextEmojis — clamp to [0, clipDuration] and discard out-of-range
    const contextEmojis = (object.context_emojis ?? [])
      .filter(e => e.emoji && e.end_seconds > e.start_seconds && e.start_seconds < clipDuration)
      .map(e => ({
        startInSeconds: Math.max(0, Math.min(e.start_seconds, clipDuration)),
        endInSeconds:   Math.max(0, Math.min(e.end_seconds,   clipDuration)),
        emoji: e.emoji,
      }))
      .filter(e => e.endInSeconds > e.startInSeconds)

    return Response.json({ coldOpen, inlays, contextEmojis })
  } catch (err: any) {
    console.error('[cold-open] Gemini error:', err)
    return new Response(`Gemini erreur : ${err?.message ?? 'inconnue'}`, { status: 500 })
  }
}
