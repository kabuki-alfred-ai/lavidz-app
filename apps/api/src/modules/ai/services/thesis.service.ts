import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { generateObject } from '../providers/ai-sdk'
import { z } from 'zod'
import { prisma, Prisma } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'

const ThesisProposalSchema = z.object({
  statement: z
    .string()
    .min(10)
    .max(200)
    .describe(
      "La phrase-clé en 15 mots max, à la première personne, qui condense la conviction forte que porte l'entrepreneur. Doit être défendable et contrarienne, pas consensuelle.",
    ),
  enemies: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe("2-3 idées reçues contre lesquelles l'entrepreneur se positionne — formulées courtes"),
  audienceArchetype: z
    .string()
    .min(5)
    .max(150)
    .describe(
      "L'archétype très précis du lecteur idéal, en une phrase. Ex: 'le dirigeant PME qui a peur de manquer le train IA mais refuse de licencier'",
    ),
})

export type ThesisProposal = z.infer<typeof ThesisProposalSchema>

type Confidence = 'forming' | 'emerging' | 'crystallized'

export type StoredThesis = ThesisProposal & {
  confidence: Confidence
  updatedAt: string
}

/**
 * ThesisService — materializes the entrepreneur's editorial thesis : the
 * 15-word conviction that orients every Sujet. Proposed after the user has
 * worked 2-3 Sujets (we have enough material), persisted on EntrepreneurProfile,
 * and injected into Kabou's system prompt so all downstream generations stay
 * coherent with it.
 */
@Injectable()
export class ThesisService {
  private readonly logger = new Logger(ThesisService.name)

  async get(organizationId: string): Promise<StoredThesis | null> {
    const profile = await prisma.entrepreneurProfile.findUnique({
      where: { organizationId },
      select: { thesis: true },
    })
    if (!profile?.thesis || typeof profile.thesis !== 'object') return null
    return profile.thesis as unknown as StoredThesis
  }

  async propose(organizationId: string): Promise<ThesisProposal> {
    const profile = await prisma.entrepreneurProfile.findUnique({
      where: { organizationId },
      select: {
        businessContext: true,
        communicationStyle: true,
        editorialPillars: true,
      },
    })
    if (!profile) throw new NotFoundException('Profil introuvable')

    const topics = await prisma.topic.findMany({
      where: { organizationId, status: { not: 'ARCHIVED' } },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: { name: true, brief: true, pillar: true },
    })

    const topicsBlock = topics
      .map((t) => `- ${t.name}${t.pillar ? ` (${t.pillar})` : ''}${t.brief ? ` :: ${t.brief.slice(0, 200)}` : ''}`)
      .join('\n')

    const prompt = `Tu es Kabou. Tu aides l'entrepreneur à formuler SA thèse — la conviction forte qui structure tout ce qu'il dira publiquement les 12 prochains mois.

## Ce qu'est une thèse (et ce que n'est PAS une thèse)
Une thèse :
- Est défendable : un concurrent de même niveau pourrait ne pas être d'accord.
- Est contrarienne : elle refuse un consensus implicite du secteur.
- Tient en une phrase de 15 mots maximum.
- S'écrit à la première personne (je, nous).
- Est ancrée sur ce que l'entrepreneur a déjà exprimé à travers ses Sujets.

Une thèse N'est PAS :
- Une promesse marketing ("nous aidons les entreprises à réussir").
- Un slogan ("avancez plus vite").
- Un constat partagé par tout le monde dans son secteur.
- Une description d'activité.

## Règles voix Kabou
- Tutoiement. Pas de jargon marketing ("secret", "méthode ultime", "découvrir").
- Vocabulaire Lavidz : Sujet, Angle, Domaine.

## Matière disponible

${profile.communicationStyle ? `### Style de communication\n${profile.communicationStyle}\n` : ''}
### Domaines éditoriaux
${profile.editorialPillars.join(', ') || '(aucun)'}

### Contexte business
${JSON.stringify(profile.businessContext ?? {}).slice(0, 1500)}

### Sujets récents (max 8)
${topicsBlock || '(aucun Sujet encore)'}

## Ce que tu produis
Un objet JSON strict :
- statement : la phrase-clé (max 15 mots, première personne, défendable, contrarienne)
- enemies : 1-3 idées reçues qu'elle combat, chacune en 10 mots max
- audienceArchetype : l'archétype du lecteur idéal en une phrase précise

Si la matière est très mince (moins de 2 Sujets creusés), propose une thèse volontairement large mais honnête — elle se précisera avec les prochains Sujets.`

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: ThesisProposalSchema,
      prompt,
    })
    return object
  }

  async save(organizationId: string, proposal: ThesisProposal): Promise<StoredThesis> {
    const existing = await this.get(organizationId)
    const confidence = this.computeConfidence(existing)
    const stored: StoredThesis = {
      ...proposal,
      confidence,
      updatedAt: new Date().toISOString(),
    }
    await prisma.entrepreneurProfile.upsert({
      where: { organizationId },
      create: {
        organizationId,
        ownerType: 'ORGANIZATION',
        thesis: stored as unknown as Prisma.InputJsonValue,
      },
      update: {
        thesis: stored as unknown as Prisma.InputJsonValue,
      },
    })
    return stored
  }

  async clear(organizationId: string): Promise<void> {
    await prisma.entrepreneurProfile.update({
      where: { organizationId },
      data: { thesis: Prisma.JsonNull },
    })
  }

  /**
   * A thesis grows in confidence as the entrepreneur refines it over time.
   * First save → "forming". After one update → "emerging". After three → "crystallized".
   * This state is purely informative (displayed as a discreet badge).
   */
  private computeConfidence(existing: StoredThesis | null): Confidence {
    if (!existing) return 'forming'
    if (existing.confidence === 'forming') return 'emerging'
    return 'crystallized'
  }
}
