import type { ContentFormat } from '@lavidz/types'

export interface LauncherAnswers {
  a1: string
  a2: string
  a3: string
}

export interface ProposalContext {
  sujet: string
  mood: string
  beats: string[]
  beatLabels: string[]
  coachingTip: string
}

const SHARED_CONTEXT = (answers: LauncherAnswers, proposal: ProposalContext) => `
Contexte du créateur :
- Sujet : ${proposal.sujet}
- Angle Kabou : ${proposal.beats.map((b, i) => `${proposal.beatLabels[i]} — ${b}`).join(' | ')}
- Conseil Kabou : ${proposal.coachingTip}

Réponses aux 3 questions :
1. ${answers.a1}
2. ${answers.a2}
3. ${answers.a3}
`.trim()

export const LAUNCHER_PROMPTS: Record<ContentFormat, (answers: LauncherAnswers, proposal: ProposalContext) => string> = {
  STORYTELLING: (answers, proposal) => `
Tu es un coach LinkedIn expert en storytelling vidéo. Génère un script Storytelling court (60-90s) pour LinkedIn.

${SHARED_CONTEXT(answers, proposal)}

Structure obligatoire :
- setup : la situation de départ (1-2 phrases, ancre dans le réel)
- tension : le problème / le moment de bascule (1-2 phrases, crée l'empathie)
- climax : le tournant / la révélation (1-2 phrases, le moment fort)
- resolution : la leçon / l'appel à l'action (1-2 phrases, mémorable)

Écris en français, ton direct et authentique, style parlé LinkedIn.
`,

  HOT_TAKE: (answers, proposal) => `
Tu es un coach LinkedIn expert en prises de position tranchées. Génère un script Hot Take pour LinkedIn (45-60s).

${SHARED_CONTEXT(answers, proposal)}

Structure obligatoire :
- thesis : la prise de position choc en 1 phrase (doit provoquer une réaction)
- arguments : 3 arguments courts et percutants (1 phrase chacun)
- punchline : la phrase de clôture mémorable qui renforce la thèse

Écris en français, ton assertif, direct, polémique mais fondé.
`,

  QUESTION_BOX: (answers, proposal) => `
Tu es un coach LinkedIn expert en format Q&A. Génère un script Questions-Réponses pour LinkedIn (60-90s).

${SHARED_CONTEXT(answers, proposal)}

Structure obligatoire : 3 paires question/réponse où :
- question : une vraie question que pose l'audience (courte, directe)
- keyPoints : 2-3 points clés pour répondre (concis, actionnables)

Écris en français, ton pédagogique et engageant.
`,

  DAILY_TIP: (answers, proposal) => `
Tu es un coach LinkedIn expert en conseils pratiques. Génère un script Conseil du Jour pour LinkedIn (30-45s).

${SHARED_CONTEXT(answers, proposal)}

Structure obligatoire :
- problem : le problème concret que l'audience reconnaît (1-2 phrases)
- tip : le conseil clair et actionnable (1-2 phrases, le cœur de la vidéo)
- application : comment l'appliquer dès aujourd'hui (1-2 phrases, concret)

Écris en français, ton direct et utile.
`,

  MYTH_VS_REALITY: (answers, proposal) => `
Tu es un coach LinkedIn expert en déconstruction de croyances. Génère un script Mythe vs Réalité pour LinkedIn (60-90s).

${SHARED_CONTEXT(answers, proposal)}

Structure obligatoire : 2-3 paires mythe/réalité où :
- myth : la croyance répandue mais fausse (1 phrase percutante)
- reality : la vérité surprenante (1-2 phrases, étayée par l'expérience)

Écris en français, ton expert mais accessible, crée des "aha moments".
`,

  TELEPROMPTER: (answers, proposal) => `
Tu es un coach LinkedIn expert en scripts téléprompteur. Génère un script complet à lire pour LinkedIn (60-90s, ~150 mots).

${SHARED_CONTEXT(answers, proposal)}

Contraintes :
- Texte fluide et naturel à l'oral (pas de listes, pas de tirets)
- Phrases courtes (max 15 mots), rythme varié
- Hook percutant dès la première phrase (arrête le scroll)
- Clôture avec un appel à l'action ou une question à l'audience

Écris en français, ton conversationnel, comme si tu parlais à un ami.
`,
}
