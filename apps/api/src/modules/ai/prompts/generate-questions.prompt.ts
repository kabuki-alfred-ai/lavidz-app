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

function loadFormatKnowledge(format: string): string {
  const formatMap: Record<string, string> = {
    QUESTION_BOX: 'formats/question-box.md',
    TELEPROMPTER: 'formats/teleprompter.md',
    HOT_TAKE: 'formats/hot-take.md',
    STORYTELLING: 'formats/storytelling.md',
    DAILY_TIP: 'formats/daily-tip.md',
    MYTH_VS_REALITY: 'formats/myth-vs-reality.md',
  }
  const file = formatMap[format]
  return file ? loadKnowledge(file) : ''
}

function loadPlatformKnowledge(platform: string): string {
  const platformMap: Record<string, string> = {
    linkedin: 'platform-linkedin.md',
    tiktok: 'platform-tiktok.md',
    instagram: 'platform-instagram.md',
    youtube: 'platform-youtube.md',
  }
  const file = platformMap[platform.toLowerCase()]
  return file ? loadKnowledge(file) : ''
}

// Cache knowledge base content in memory after first load
let cachedViralityCodes: string | null = null
let cachedInterviewTechniques: string | null = null

function getViralityCodes(): string {
  if (!cachedViralityCodes) cachedViralityCodes = loadKnowledge('virality-codes.md')
  return cachedViralityCodes
}

function getInterviewTechniques(): string {
  if (!cachedInterviewTechniques) cachedInterviewTechniques = loadKnowledge('interview-techniques.md')
  return cachedInterviewTechniques
}

export interface GenerateQuestionsParams {
  businessContext: object
  topicsExplored: string[]
  goal: string
  memories: string[]
  format?: string
  platform?: string
  communicationStyle?: string | null
}

export function buildGenerateQuestionsPrompt(params: GenerateQuestionsParams): string {
  const {
    businessContext,
    topicsExplored,
    goal,
    memories,
    format,
    platform,
    communicationStyle,
  } = params

  const viralityCodes = getViralityCodes()
  const interviewTechniques = getInterviewTechniques()
  const formatKnowledge = format ? loadFormatKnowledge(format) : ''
  const platformKnowledge = platform ? loadPlatformKnowledge(platform) : ''

  const sections: string[] = []

  // Core identity
  sections.push(`Tu es le directeur artistique et interviewer en chef de Lavidz.
Tu combines l'expertise d'un realisateur video, d'un interviewer professionnel (style Terry Gross, Tim Ferriss), et d'un growth hacker specialise en personal branding sur les reseaux sociaux.

Ton objectif : generer les questions ou le script les plus pertinents possibles pour extraire le MEILLEUR contenu video de cet entrepreneur. Chaque question doit mener a une reponse qui sera montable en contenu viral.`)

  // Knowledge base - virality codes (truncated to key sections for prompt size)
  if (viralityCodes) {
    const truncated = viralityCodes.split('\n').slice(0, 60).join('\n')
    sections.push(`## Expertise : Codes de Viralite (resume)
${truncated}`)
  }

  // Knowledge base - interview techniques (truncated)
  if (interviewTechniques) {
    const truncated = interviewTechniques.split('\n').slice(0, 60).join('\n')
    sections.push(`## Expertise : Techniques d'Interview (resume)
${truncated}`)
  }

  // Format-specific knowledge
  if (formatKnowledge) {
    sections.push(`## Format de contenu choisi
${formatKnowledge}`)
  }

  // Platform-specific knowledge
  if (platformKnowledge) {
    sections.push(`## Plateforme cible
${platformKnowledge}`)
  }

  // Creator context (Couche 2)
  sections.push(`## Profil du createur

Contexte business :
${JSON.stringify(businessContext, null, 2)}

${communicationStyle ? `Style de communication naturel : ${communicationStyle}` : ''}

Themes deja filmes : ${topicsExplored.join(', ') || 'aucun encore'}`)

  // Memory context (Couche 2 - RAG) — structured for exploitation
  if (memories.length > 0) {
    sections.push(`## Memoire structuree du createur

Les souvenirs ci-dessous sont ta MINE D'OR. Tu DOIS les utiliser pour personnaliser chaque question.
Chaque question que tu generes DOIT contenir au moins un element tire de cette memoire.

${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}

### Comment exploiter cette memoire :
- Si tu trouves une ANECDOTE → integre-la dans la question : "Tu m'as dit que [anecdote]. Raconte..."
- Si tu trouves une OPINION → provoque : "Tu penses que [opinion]. Pourquoi ?"
- Si tu trouves un CHIFFRE → utilise-le comme hook : "Tu geres [X] clients. Comment tu..."
- Si tu trouves une EXPRESSION → fais-la utiliser : "Tu dis souvent '[expression]'. Explique."
- Si tu trouves une ROUTINE → transforme-la en conseil : "Tu fais [routine]. Pourquoi c'est non-negociable ?"`)
  } else {
    sections.push(`## Memoire des sessions precedentes
Premiere session — pas d'historique disponible.
Commence par des questions d'EXPLORATION qui extraient des pepites personnelles :
- "C'est quoi le moment ou tu as eu le plus peur dans ton business ?"
- "Quelle est l'opinion la plus controversee que tu as dans ton metier ?"
- "Raconte la derniere fois qu'un client t'a surpris"
Ces questions forcent l'authenticite et alimenteront la memoire pour les prochaines sessions.`)
  }

  // Task
  sections.push(`## Ta mission

Objectif de cette session : ${goal}
${format ? `Format : ${format}` : 'Format : QUESTION_BOX (par defaut)'}
${platform ? `Plateforme cible : ${platform}` : ''}

Genere entre 3 et 7 questions/elements de script pour cette session.

Regles strictes :
- Chaque question doit commencer par "Comment", "Pourquoi", "Raconte", "Donne-moi", "Quel" — JAMAIS par "Est-ce que"
- Chaque question doit avoir un objectif clair : hook, valeur, emotion, ou CTA
- Suis la progression : echauffement → valeur → approfondissement → emotion → conclusion
- Evite les themes deja filmes sauf si l'angle est radicalement different
- Utilise les techniques d'interview appropriees (entonnoir, relance, silence, question miroir)
- Adapte le ton et la structure a la plateforme cible
- Formule les questions de maniere conversationnelle (tutoiement, ton direct)
- Si le format est TELEPROMPTER, genere un script en bullet points guides (pas mot-a-mot)
- Si le format est HOT_TAKE ou DAILY_TIP, genere moins de questions mais plus percutantes
- Inclus un hint pour chaque question qui aide le createur a comprendre l'angle attendu

Genere aussi un titre court et accrocheur pour cette session, et une description optionnelle.
Toutes les reponses doivent etre en francais.

## VERIFICATION ANTI-GENERIQUE (obligatoire)

Avant de retourner tes questions, verifie CHACUNE :
1. Contient-elle un detail qui ne peut venir QUE de ce createur ? (anecdote, chiffre, opinion, expression)
2. Est-il impossible d'y repondre avec du contenu copie-colle d'un blog ?
3. Force-t-elle une reponse emotionnelle, une anecdote ou une prise de position ?

Si une question echoue ces 3 tests → reformule-la en y injectant un element de la memoire du createur.
Si la memoire est vide → pose des questions d'exploration qui EXTRAIENT des pepites (pas des questions factuelles).

Le contenu generique est INTERDIT. Chaque question doit etre taillee pour CE createur.`)

  return sections.join('\n\n---\n\n')
}
