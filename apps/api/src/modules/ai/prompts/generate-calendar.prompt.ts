import { readFileSync } from 'fs'
import { join } from 'path'

const KNOWLEDGE_BASE_DIR = join(__dirname, '../../../../../../packages/ai-knowledge')

function loadKnowledge(filename: string): string {
  try {
    return readFileSync(join(KNOWLEDGE_BASE_DIR, filename), 'utf-8')
  } catch {
    return ''
  }
}

export interface GenerateCalendarParams {
  businessContext: object
  topicsExplored: string[]
  memories: string[]
  platforms: string[]
  weeksCount: number
  videosPerWeek: number
  communicationStyle?: string | null
}

export function buildGenerateCalendarPrompt(params: GenerateCalendarParams): string {
  const {
    businessContext,
    topicsExplored,
    memories,
    platforms,
    weeksCount,
    videosPerWeek,
    communicationStyle,
  } = params

  const viralityCodes = loadKnowledge('virality-codes.md')

  const platformSummaries = platforms.map((p) => {
    const content = loadKnowledge(`platform-${p.toLowerCase()}.md`)
    if (!content) return ''
    // Extract just the key formats section to keep prompt concise
    const lines = content.split('\n').slice(0, 30).join('\n')
    return `### ${p}\n${lines}`
  }).filter(Boolean).join('\n\n')

  const totalVideos = weeksCount * videosPerWeek
  const today = new Date()

  return `Tu es le strategiste de contenu de Lavidz, expert en personal branding video.

## Ta mission

Genere un calendrier de contenu video pour les ${weeksCount} prochaines semaines (${totalVideos} videos au total, ${videosPerWeek} par semaine).

Date de debut : ${today.toISOString().split('T')[0]} (aujourd'hui)
Jours de publication preferes : mardi, mercredi, jeudi (eviter lundi et vendredi)

## Profil du createur

Contexte business :
${JSON.stringify(businessContext, null, 2)}

${communicationStyle ? `Style de communication : ${communicationStyle}` : ''}

Sujets deja couverts : ${topicsExplored.join(', ') || 'aucun'}

${memories.length > 0 ? `Memoire des sessions precedentes :\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}` : ''}

## Plateformes cibles
${platforms.join(', ')}

${platformSummaries}

## Codes de viralite (resume)
- Hook en 3s obligatoire
- Pattern interrupt toutes les 8-12s
- Un seul CTA par video
- Authenticite > perfection
- Les saves et shares comptent plus que les likes

## Formats disponibles

Tu dois varier les formats pour eviter la monotonie :
- QUESTION_BOX : L'IA pose des questions, reponse naturelle (authentique)
- TELEPROMPTER : Script guide affiche a l'ecran (structure, storytelling)
- HOT_TAKE : Reaction a un sujet trending (engagement, debat)
- STORYTELLING : Histoire en 3 actes (emotion, connexion)
- DAILY_TIP : Conseil actionnable en 30-45s (saves, valeur)
- MYTH_VS_REALITY : "On croit que X, en fait Y" (surprise, pattern interrupt)

## Regles de generation

1. Varier les formats — ne pas repeter le meme format 2 fois d'affilee
2. Varier les sujets — chaque video doit avoir un angle unique
3. Adapter le format au sujet (un storytelling pour une experience, un hot take pour une opinion)
4. Alterner entre contenu educatif, opinion, et emotionnel
5. Planifier un crescendo : commencer par des sujets faciles, monter en intensite
6. Chaque sujet doit etre lie au domaine d'expertise du createur
7. Ne PAS repeter les sujets deja couverts sauf avec un angle radicalement different
8. Inclure la ou les plateformes cibles pour chaque video
9. Generer un hook suggere pour chaque video

Pour chaque entree du calendrier, fournis :
- scheduledDate : date au format YYYY-MM-DD
- topic : titre court et accrocheur du sujet
- description : 1-2 phrases decrivant l'angle et le contenu
- format : un des 6 formats ci-dessus
- platforms : tableau des plateformes cibles
- hook : une suggestion de hook pour cette video

Genere exactement ${totalVideos} entrees.
Toutes les reponses doivent etre en francais.`
}
