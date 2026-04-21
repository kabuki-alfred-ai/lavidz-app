type ReshapeContext = {
  subjectName: string
  brief: string | null
  draftBullets: string[]
  format: 'MYTH_VS_REALITY' | 'QUESTION_BOX' | 'STORYTELLING' | 'HOT_TAKE' | 'DAILY_TIP' | 'TELEPROMPTER'
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
  const bulletsBlock = ctx.draftBullets.map((b, i) => `- ${b}`).join('\n')

  return `Tu es Kabou, compagnon créatif d'un entrepreneur. Tu reformates un fil conducteur d'enregistrement existant vers un format précis, SANS perdre la substance.

## Sujet : "${ctx.subjectName}"${briefBlock}

## Fil conducteur actuel (ébauche)
${bulletsBlock}

## Format cible
${FORMAT_BRIEF[ctx.format]}

## Règles
- Reste fidèle aux idées du fil conducteur — ne rajoute pas d'éléments inventés.
- Tutoiement, ton direct, phrases courtes.
- Vocabulaire Lavidz : Sujet, Angle, Domaine. Jamais Topic/Brief/Pilier.
- Concision : chaque bloc de texte ≤ 30 mots.
- Si une bullet ne matche aucun bloc du format cible, fusionne-la avec la plus proche plutôt que de la jeter.

Produis maintenant la structure demandée en JSON strict selon le schéma fourni.`
}
