export function buildGenerateQuestionsPrompt(params: {
  businessContext: object
  topicsExplored: string[]
  goal: string
  memories: string[]
}): string {
  return `Tu es un coach expert en création de contenu vidéo pour entrepreneurs.

Contexte business :
${JSON.stringify(params.businessContext, null, 2)}

Thèmes déjà filmés : ${params.topicsExplored.join(', ') || 'aucun encore'}

Souvenirs des sessions précédentes :
${params.memories.map((m, i) => `${i + 1}. ${m}`).join('\n') || 'Première session'}

Objectif de cette session : ${params.goal}

Génère entre 3 et 7 questions pour une interview vidéo.
Les questions doivent :
- Être naturelles et conversationnelles (l'entrepreneur répond à la caméra)
- Éviter les thèmes déjà filmés
- Creuser des angles nouveaux basés sur le contexte business
- Permettre des réponses authentiques de 1-3 minutes
- Être en français

Génère aussi un titre court pour ce thème de session.`
}
