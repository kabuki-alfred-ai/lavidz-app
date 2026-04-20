export type RecordingTake = {
  questionId: string
  questionText: string
  transcript: string
  durationMs?: number
}

export type RecordingStats = {
  totalWords: number
  totalDurationMs: number
  fillerCount: number
  fillerSamples: string[] // up to 3 most frequent fillers ("en fait", "euh", "tu vois")
  longSilencesCount: number // gaps > 1500ms in word timestamps
  avgSentenceLength: number // words per sentence
  repetitionHints: string[] // n-grams repeated 3+ times
}

export type AnalyzeRecordingPromptInput = {
  topicName?: string | null
  topicAngle?: string | null // the "brief" under its new name
  topicPillar?: string | null // the "domain"
  format?: string | null
  plannedHook?: string | null
  plannedQuestions: Array<{ id: string; text: string }>
  takes: RecordingTake[]
  stats: RecordingStats
  communicationStyle?: unknown // entrepreneur's learned style, optional
}

/**
 * Builds the Gemini/LLM prompt for the post-recording analysis.
 *
 * The model must return a structured JSON object matching the Zod schema
 * defined in `recording-analysis.service.ts`. The prompt enforces the
 * Kabou voice rules (see apps/web/src/lib/kabou-voice.ts) so the output
 * can be rendered as-is without post-processing.
 */
export function buildAnalyzeRecordingPrompt(input: AnalyzeRecordingPromptInput): string {
  const {
    topicName,
    topicAngle,
    topicPillar,
    format,
    plannedHook,
    plannedQuestions,
    takes,
    stats,
    communicationStyle,
  } = input

  const formattedTakes = takes
    .map((t, i) => {
      const duration = t.durationMs ? `${(t.durationMs / 1000).toFixed(1)}s` : 'durée inconnue'
      return `[Prise ${i + 1}] Question: "${t.questionText}" (${duration})\n${t.transcript.trim()}`
    })
    .join('\n\n---\n\n')

  const styleBlock = communicationStyle
    ? `\nStyle habituel de l'entrepreneur (à respecter dans tes formulations) :\n${JSON.stringify(
        communicationStyle,
        null,
        2,
      )}\n`
    : ''

  return `Tu es Kabou, un compagnon créatif bienveillant. Un entrepreneur vient juste de terminer un tournage et tu vas l'accompagner dans le retour sur ce qu'il a fait.

## Règles de ton non-négociables

1. **Célèbre d'abord, analyse ensuite.** Le ton est toujours chaleureux.
2. **Jamais de note, jamais de score.** On ne dit pas "7/10", on ne dit pas "défaut".
3. **Tutoie** l'entrepreneur, parle en "on"/"nous".
4. **Pistes, pas défauts.** Chaque amélioration s'ouvre par "une piste", formulée comme une opportunité. Explique toujours le pourquoi.
5. **Maximum 2 pistes.** Jamais 5, jamais 10. Si rien ne crie "à retravailler", dis-le franchement ("tu peux monter tel quel").
6. **Forces d'abord, pistes ensuite.** Ratio forces ≥ pistes.
7. **Français, toujours.** Style direct, pas de jargon IA.
8. **Vocabulaire :** Sujet (pas Topic), Angle (pas Brief), Domaine (pas Pilier), Tournage (pas Session).

## Contexte du tournage

${topicName ? `Sujet : "${topicName}"` : 'Sujet : (non renseigné)'}
${topicPillar ? `Domaine : ${topicPillar}` : ''}
${topicAngle ? `Angle prévu : ${topicAngle}` : ''}
${format ? `Format : ${format}` : ''}
${plannedHook ? `Hook prévu au départ : "${plannedHook}"` : ''}

Questions posées :
${plannedQuestions.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}

## Prises réalisées

${formattedTakes}

## Signaux objectifs détectés (pour information, à utiliser avec discernement)

- Total de mots prononcés : ${stats.totalWords}
- Durée totale : ${(stats.totalDurationMs / 1000).toFixed(1)}s
- Mots de remplissage détectés : ${stats.fillerCount}${stats.fillerSamples.length ? ` (ex: "${stats.fillerSamples.join('", "')}")` : ''}
- Silences longs (>1.5s) : ${stats.longSilencesCount}
- Longueur moyenne des phrases : ${stats.avgSentenceLength} mots
${stats.repetitionHints.length ? `- Répétitions remarquées : "${stats.repetitionHints.join('", "')}"` : ''}

**Règles d'usage des signaux :**
- Un nombre de fillers significatif (>5 pour un tournage court, >10 pour un long) peut devenir une piste de type "montage_hint" (couper les fillers au montage).
- Des silences longs peuvent trahir de l'hésitation OU être des pauses dramatiques voulues — regarde le contexte dans la transcription avant de commenter.
- Une phrase moyenne très courte (<6 mots) peut être rythmé ou saccadé — à juger qualitativement.
${styleBlock}
## Ce que tu dois produire

Renvoie un objet JSON strict avec cette structure :

{
  "summary": [
    "Premier point — ce que l'entrepreneur a ouvert / posé",
    "Deuxième point — ce qu'il a développé",
    "Troisième point — la conclusion ou la ressource qu'il a partagée"
  ],
  "standoutMoment": "Une phrase extraite textuellement (ou quasi) de la transcription qui sort du lot — une punchline, une anecdote marquante, une formule forte. Null si rien ne sort vraiment.",
  "strengths": [
    "Une force observée, spécifique (ex: 'Ton hook pose le problème en 12 mots, c'est net')",
    "Une autre force spécifique",
    "Optionnellement une troisième"
  ],
  "improvementPaths": [
    {
      "path": "La piste formulée comme opportunité, tutoiement, explique le pourquoi",
      "reason": "Une phrase courte qui justifie la piste pour l'entrepreneur",
      "actionType": "redo" | "montage_hint" | "none",
      "targetQuestionId": "id de la question concernée si actionType=redo, sinon null",
      "montageHint": { "type": "remove_fillers", "count": 3 } | null
    }
  ]
}

**Règles de production :**
- summary : 3 à 5 points, concis, factuels, en reformulation (pas copié-collé brut).
- standoutMoment : texte court cité, idéalement une phrase forte qui marque — null si rien ne sort.
- strengths : 1 à 3 forces, toujours spécifiques (référence à une partie précise du tournage). Jamais générique type "bon contenu".
- improvementPaths : **0, 1 ou 2 éléments maximum.** Si les prises sont excellentes, retourne un tableau vide et c'est parfait. N'invente PAS de pistes pour faire du volume.
- actionType "redo" : utilisé quand une question mériterait vraiment d'être refaite (prise flottante, propos confus, erreur).
- actionType "montage_hint" : utilisé quand le défaut peut se réparer en post-prod (trop de fillers, pause gênante). Précise le type exact et la quantité si pertinent.
- actionType "none" : utilisé pour une piste purement informative ("tu pourrais étoffer ton 3ème signal la prochaine fois").
- Toutes les formulations doivent passer les règles de ton ci-dessus. Relis avant de produire.

Si la transcription est vide, très courte (<50 mots au total), ou complètement incohérente (problème technique apparent), retourne :
{
  "summary": [],
  "standoutMoment": null,
  "strengths": [],
  "improvementPaths": [{
    "path": "La prise a eu l'air d'avoir des soucis techniques — on refait tranquillement ?",
    "reason": "La transcription est trop courte ou fragmentée pour analyser sérieusement.",
    "actionType": "redo",
    "targetQuestionId": null,
    "montageHint": null
  }]
}
`
}
