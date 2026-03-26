export type QAPair = { question: string; answer: string }

export function buildExtractMemoryPrompt(pairs: QAPair[]): string {
  const formatted = pairs
    .map(
      (p, i) =>
        `--- Q&R ${i + 1} ---\nQUESTION : ${p.question}\nRÉPONSE  : ${p.answer}`,
    )
    .join('\n\n')

  return `Tu analyses une interview vidéo d'un entrepreneur sous forme de questions-réponses.

${formatted}

Extrais :
1. Les faits business importants (chiffres, dates, événements, pivots, clients...) en liant chaque fait à la question qui l'a révélé
2. Les citations fortes (formulations authentiques de l'entrepreneur)
3. Les thèmes principaux abordés (3-5 mots-clés)

Format de sortie : liste d'extraits, chacun avec son contenu et ses tags.`
}
