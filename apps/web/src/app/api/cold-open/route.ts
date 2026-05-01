import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 60

type Word = { word: string; start: number; end: number }

const ColdOpenSchema = z.object({
  hook_candidates: z
    .array(
      z.object({
        phrase: z
          .string()
          .describe(
            'Citation EXACTE de 3 à 8 mots (1 à 2,5 secondes). Ultra-courte, punchy, stoppe le scroll.',
          ),
        angle: z
          .enum(['chiffre', 'aveu', 'contradiction', 'promesse', 'punchline'])
          .describe('Le type d\'accroche utilisé'),
        why: z
          .string()
          .describe('En 10 mots max : pourquoi cette phrase accroche'),
      }),
    )
    .length(3)
    .describe(
      'Exactement 3 propositions de hooks DIFFÉRENTES (angles variés) extraites du texte. La plus forte en premier.',
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
    .describe('3 à 8 mots importants de la transcription avec un emoji associé.'),
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

function buildColdOpen(
  phrase: string,
  words: Word[],
  clipDuration: number,
  segmentId: string,
  extra: { angle?: string; why?: string } = {},
) {
  const phraseMatch = matchPhrase(phrase, words)
  if (!phraseMatch) return null

  const hookDuration = phraseMatch.end - phraseMatch.start
  const MIN_HOOK_DURATION = 1.8

  let start = phraseMatch.start
  let end = phraseMatch.end

  // Breathing room :
  // - 0.2s avant (laisse respirer l'entrée, absorbe le fade-in)
  // - 0.9s après — critique : ASR word-end cut sur le dernier phonème (souvent
  //   100-200 ms avant la fin réellement audible), et le fade-out Remotion consomme
  //   ~0.27s sur les 8 dernières frames. Il faut au moins ~0.7s de pad non mangé
  //   par le fade pour que la voix soit complète et ne se termine pas en plein breath.
  start = Math.max(0, start - 0.2)
  end = Math.min(clipDuration, end + 0.9)

  // If the hook is still too short, extend the tail first (viewers
  // barely notice a late start, but a clipped ending feels broken).
  const paddedDuration = end - start
  if (paddedDuration < MIN_HOOK_DURATION) {
    const missing = MIN_HOOK_DURATION - paddedDuration
    const tailRoom = clipDuration - end
    const fromTail = Math.min(missing, tailRoom)
    end += fromTail
    const stillMissing = missing - fromTail
    if (stillMissing > 0) start = Math.max(0, start - stillMissing)
  }

  return {
    hookPhrase: phrase,
    startInSeconds: start,
    endInSeconds: end,
    segmentId,
    angle: extra.angle,
    why: extra.why,
  }
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

Analyse cette transcription et produis :

1. TROIS CANDIDATS DE HOOK (hook_candidates) : Extraie EXACTEMENT 3 propositions différentes, classées par ordre de puissance (la plus forte en premier). Chaque candidat doit être :
- Une citation EXACTE du texte (pas de reformulation, pas d'ajout)
- Entre 3 et 8 mots, 1 à 2,5 secondes de parole
- Ultra-courte, punchy, pensée comme un "tweet" qui stoppe le scroll
- D'un angle DIFFÉRENT des deux autres (varie : chiffre, aveu, contradiction, promesse, punchline)
- Pour chaque candidat, classe-le via "angle" (chiffre | aveu | contradiction | promesse | punchline) et explique brièvement dans "why" (10 mots max) pourquoi il accroche

Exemples d'angles forts :
- chiffre : "j'ai perdu 200 000 euros" → impact brut
- aveu : "j'avais tout faux" → vulnérabilité
- contradiction : "tout le monde se trompe" → pattern interrupt
- promesse : "la méthode qui change tout" → curiosité
- punchline : "personne n'en parle" → exclusivité

RÈGLES ABSOLUES pour CHAQUE candidat :
- Évite les introductions ("bonjour aujourd'hui"), les propositions subordonnées, les "et/mais/parce que" qui étirent
- Si la meilleure punchline fait 4 mots, prends 4 mots. NE JAMAIS rallonger pour remplir.
- Les 3 propositions doivent être VRAIMENT différentes (pas de variantes du même moment)

2. EMOJIS PAR MOT (word_emojis) : Identifie 3 à 8 mots à fort impact dans la transcription et associe à chacun un emoji qui AMPLIFIE LE SENS de ce mot spécifique. Règles : utiliser des mots EXACTS de la transcription (un seul mot), choisir des mots émotionnellement forts (chiffres, verbes d'action, concepts business, émotions). Exemple : "million" → 💰, "croissance" → 📈, "peur" → 😰, "lancé" → 🚀, "échoué" → 💀.

DURÉE DU CLIP : ${clipDuration.toFixed(1)} secondes

TRANSCRIPTION :
${transcript}`

  try {
    const model = google(process.env.AI_MODEL ?? 'gemini-2.5-flash')
    const { object } = await generateObject({
      model,
      schema: ColdOpenSchema,
      prompt,
    })

    // Time-match each candidate and drop the ones we can't align
    const candidates = (object.hook_candidates ?? [])
      .map(c => buildColdOpen(c.phrase, words, clipDuration, segmentId ?? '', { angle: c.angle, why: c.why }))
      .filter((c): c is NonNullable<typeof c> => c !== null)

    // Back-compat: expose the first candidate as "coldOpen"
    const coldOpen = candidates[0] ?? null

    // Build wordEmojis — filter out entries with empty words or emojis
    const wordEmojis = (object.word_emojis ?? [])
      .filter(e => e.exact_word && e.emoji)
      .map(e => ({ word: e.exact_word, emoji: e.emoji }))

    return Response.json({ coldOpen, coldOpenCandidates: candidates, wordEmojis })
  } catch (err: any) {
    console.error('[cold-open] Gemini error:', err)
    return new Response(`Gemini erreur : ${err?.message ?? 'inconnue'}`, { status: 500 })
  }
}
