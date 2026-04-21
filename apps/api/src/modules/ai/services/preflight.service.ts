import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { generateObject } from '../providers/ai-sdk'
import { z } from 'zod'
import { prisma } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'

const PreflightSchema = z.object({
  hook: z.object({
    strength: z.enum(['strong', 'medium', 'weak']),
    observation: z
      .string()
      .describe("Observation courte et non-jugement sur la capacité du Sujet à accrocher"),
    suggestion: z
      .string()
      .nullable()
      .describe(
        "Si strength est 'weak' ou 'medium', une suggestion concrète pour muscler. Sinon null.",
      ),
  }),
  proof: z.object({
    strength: z.enum(['strong', 'medium', 'weak']),
    observation: z
      .string()
      .describe("Observation sur la présence d'une preuve concrète (chiffre, anecdote, exemple)"),
    suggestion: z.string().nullable(),
  }),
  takeaway: z.object({
    strength: z.enum(['strong', 'medium', 'weak']),
    observation: z
      .string()
      .describe("Observation sur ce que le lecteur retient après avoir consommé le contenu"),
    suggestion: z.string().nullable(),
  }),
  overallVerdict: z
    .enum(['ready', 'refine_recommended', 'refine_required'])
    .describe(
      "ready = on peut y aller | refine_recommended = utile de muscler mais non bloquant | refine_required = il manque une brique structurelle",
    ),
})

export type PreflightResult = z.infer<typeof PreflightSchema>

/**
 * PreflightService — runs a non-blocking quality check on a Sujet just before
 * the tournage. Passes three filters (hook, proof, takeaway) and returns
 * observations + suggestions. Never blocks the entrepreneur — the CTA to
 * record stays available whatever the verdict.
 */
@Injectable()
export class PreflightService {
  private readonly logger = new Logger(PreflightService.name)

  async runForTopic(organizationId: string, topicId: string): Promise<PreflightResult> {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: {
        id: true,
        name: true,
        brief: true,
        pillar: true,
        hooks: true,
        sources: true,
      },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')

    const profile = await prisma.entrepreneurProfile.findUnique({
      where: { organizationId },
      select: { thesis: true, communicationStyle: true },
    })

    const thesis = profile?.thesis as Record<string, unknown> | null
    const thesisStatement =
      thesis && typeof thesis.statement === 'string' ? thesis.statement : null

    const hooks = topic.hooks as Record<string, unknown> | null
    const chosenHook = hooks
      ? (hooks.chosen === 'native' || hooks.chosen === 'marketing') &&
        typeof (hooks as Record<string, Record<string, unknown>>)[hooks.chosen as string]
          ?.phrase === 'string'
        ? (hooks as Record<string, Record<string, unknown>>)[hooks.chosen as string]
            .phrase as string
        : null
      : null

    const sources = topic.sources as Record<string, unknown> | null
    const sourcesCount = Array.isArray(sources?.sources)
      ? (sources!.sources as unknown[]).length
      : 0

    const prompt = `Tu es Kabou. L'entrepreneur est sur le point de tourner son Sujet. Tu fais un dernier check en 3 passes : hook, preuve, call-to-think. Tu n'es pas un juge : tu es un compagnon qui observe et propose.

## Règles non-négociables
- Tutoiement, ton chaleureux, on/nous.
- Vocabulaire : Sujet, Angle. Jamais Topic/Brief.
- Chaque observation doit être spécifique à CE Sujet, pas générique.
- Si quelque chose va bien, dis-le franchement (strength: strong).
- Une "suggestion" ne sert que si elle est actionnable en 2 minutes avant le tournage.
- Jamais de "il faut" ou "tu devrais" — préfère "on pourrait muscler en…".

## Les trois filtres

**hook** : la première phrase / la première idée a-t-elle de quoi arrêter le scroll ? Est-ce que c'est spécifique, contrarienne, concrète ? Ou est-ce une ouverture plate ("aujourd'hui je vais parler de...") ?

**proof** : y a-t-il une preuve concrète (anecdote vécue, chiffre, exemple client, contre-exemple) qui ancre l'angle ? Ou est-ce du généralisme ?

**takeaway** : qu'est-ce que le lecteur retient après 30 secondes ? Une pensée nouvelle, une question qui reste, une décision à prendre ? Ou juste un contenu "agréable" qui glisse sans marquer ?

## Verdict global
- ready : les trois filtres sont solides → on y va.
- refine_recommended : un ou deux filtres sont medium → c'est tournage possible, mais 2 minutes de musculation aideraient.
- refine_required : un filtre est weak ET c'est structurel (pas juste de la formulation) → mieux vaut retravailler avant.

## Matière sur ce Sujet

Nom : ${topic.name}
${topic.pillar ? `Domaine : ${topic.pillar}` : ''}
${topic.brief ? `Angle :\n${topic.brief}` : 'Angle : pas encore écrit.'}

${chosenHook ? `Accroche choisie : "${chosenHook}"` : 'Pas d\'accroche choisie pour l\'instant.'}

Sources anchorées : ${sourcesCount > 0 ? `${sourcesCount} source(s)` : 'aucune'}

${thesisStatement ? `## Thèse de l'entrepreneur\n"${thesisStatement}"\n(Vérifie que le Sujet est cohérent avec elle dans le filtre takeaway.)` : ''}

${profile?.communicationStyle ? `## Style de communication\n${profile.communicationStyle}` : ''}`

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: PreflightSchema,
      prompt,
    })
    return object
  }
}
