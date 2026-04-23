type ReshapeContext = {
  subjectName: string
  brief: string | null
  draftBullets: string[]
  format: 'MYTH_VS_REALITY' | 'QUESTION_BOX' | 'STORYTELLING' | 'HOT_TAKE' | 'DAILY_TIP' | 'TELEPROMPTER'
  /** Bloc pré-formaté de sources factuelles du Topic — peut ancrer concrètement
   *  le script (chiffres, anecdotes, contre-exemples). Fourni par le caller. */
  sourcesBlock?: string | null
}

const FORMAT_BRIEF: Record<ReshapeContext['format'], string> = {
  MYTH_VS_REALITY:
    'Format "Mythe vs Réalité" — pour chaque idée reçue, on pose le mythe exactement comme les gens le disent, puis la réalité en 1-2 phrases tranchantes.',
  QUESTION_BOX:
    'Format "Questions-Réponses" — on formule 3 à 5 questions que pose la cible, chacune adossée à 2-4 points clés à couvrir.',
  STORYTELLING:
    'Format "Storytelling" — on construit une narration en 4 beats : setup (contexte), tension (complication), climax (moment de bascule), resolution (ce qu\'on en tire).',
  HOT_TAKE:
    'Format "Prise de position" — on pose une thèse forte, 3 arguments qui la soutiennent, et une punchline finale.',
  DAILY_TIP:
    'Format "Conseil du jour" — un problème concret, le conseil actionnable, et comment l\'appliquer aujourd\'hui.',
  TELEPROMPTER:
    'Format "Téléprompteur" — un script structuré en sections [HOOK], [CONTENU], [CTA], avec bullet points concis (pas un texte à réciter mot pour mot).',
}

export function buildReshapeRecordingGuidePrompt(ctx: ReshapeContext): string {
  const briefBlock = ctx.brief ? `\n### Angle du sujet\n${ctx.brief}` : ''
  const bulletsBlock = ctx.draftBullets.map((b) => `- ${b}`).join('\n')
  const sourcesBlock = ctx.sourcesBlock
    ? `\n\n## Sources factuelles du sujet (ancre quand c'est pertinent, n'invente pas)\n${ctx.sourcesBlock}`
    : ''

  return `Tu es Kabou, compagnon créatif d'un entrepreneur. Tu reformates un fil conducteur d'enregistrement existant vers un format précis, SANS perdre la substance.

## Sujet : "${ctx.subjectName}"${briefBlock}

## Fil conducteur actuel (ébauche)
${bulletsBlock}

## Format cible
${FORMAT_BRIEF[ctx.format]}${sourcesBlock}

## Règles
- Reste fidèle aux idées du fil conducteur — ne rajoute pas d'éléments inventés.
- Tutoiement, ton direct, phrases courtes.
- Vocabulaire Lavidz : Sujet, Angle, Domaine. Jamais Topic/Brief/Pilier.
- Concision : chaque bloc de texte ≤ 30 mots.
- Si une bullet ne matche aucun bloc du format cible, fusionne-la avec la plus proche plutôt que de la jeter.
- Quand une source factuelle est pertinente (chiffre, anecdote, contre-angle) — ancre-la dans le script du format (ex: dans les arguments d'un HOT_TAKE, dans les keyPoints d'une Q/A, dans le setup d'un STORYTELLING). Cite la source de façon naturelle, pas en mode bibliographie.

Produis maintenant la structure demandée en JSON strict selon le schéma fourni.`
}
