import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { generateObject } from 'ai'
import { z } from 'zod'
import { prisma, Prisma } from '@lavidz/database'
import type { EntrepreneurProfile } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'

const SummarySchema = z.object({
  activite: z.string().describe("Description concise de l'activité (1-2 phrases)"),
  stade: z.enum(['démarrage', 'croissance', 'établi']).describe("Stade actuel de l'activité"),
  clientsCibles: z.string().describe("Qui sont les clients ou l'audience cible"),
  problemeResolu: z.string().describe("Quel problème ou besoin principal résout l'entrepreneur"),
  objectifsContenu: z.string().describe("Pourquoi faire du contenu vidéo — quel objectif"),
  styleComm: z.string().describe("Ton et style de communication préféré"),
  pointsForts: z.array(z.string()).min(1).max(6).describe("3-5 mots-clés différenciateurs ou atouts"),
  lacunes: z.array(z.string()).describe("Informations importantes encore inconnues ou à approfondir"),
})

type ProfileUpdateData = {
  businessContext?: Prisma.InputJsonValue
  topicsExplored?: string[]
  communicationStyle?: string | null
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name)

  async generateAndSaveSummary(organizationId: string): Promise<EntrepreneurProfile> {
    const profile = await prisma.entrepreneurProfile.findUnique({
      where: { organizationId },
    })
    if (!profile) throw new NotFoundException(`Profil introuvable`)

    const ctx = profile.businessContext as Record<string, unknown>
    const conversationSummary = typeof ctx?.conversationSummary === 'string' ? ctx.conversationSummary : null
    if (!conversationSummary) throw new NotFoundException('Aucune conversation à résumer')

    this.logger.log(`Génération du résumé IA pour l'organisation ${organizationId}`)

    const { object: summary } = await generateObject({
      model: getDefaultModel(),
      schema: SummarySchema,
      prompt: `Tu analyses une conversation entre un entrepreneur et un assistant IA.
À partir de cette conversation, extrais de façon structurée ce que tu sais sur cet entrepreneur.
Sois factuel, synthétique, et n'invente rien qui ne soit pas mentionné.
Si une information est absente, laisse le champ vide ou indique-la dans "lacunes".

CONVERSATION :
${conversationSummary}`,
    })

    return prisma.entrepreneurProfile.update({
      where: { organizationId },
      data: {
        businessContext: { ...ctx, summary } as Prisma.InputJsonValue,
      },
    })
  }
  async getOrCreate(organizationId: string): Promise<EntrepreneurProfile> {
    const existing = await prisma.entrepreneurProfile.findUnique({
      where: { organizationId },
    })

    if (existing) return existing

    return prisma.entrepreneurProfile.create({
      data: {
        organizationId,
        ownerType: 'ORGANIZATION',
      },
    })
  }

  async update(organizationId: string, data: ProfileUpdateData): Promise<EntrepreneurProfile> {
    const profile = await prisma.entrepreneurProfile.findUnique({
      where: { organizationId },
    })

    if (!profile) {
      throw new NotFoundException(`Profil introuvable pour l'organisation ${organizationId}`)
    }

    return prisma.entrepreneurProfile.update({
      where: { organizationId },
      data,
    })
  }

  async getByOrganization(organizationId: string): Promise<EntrepreneurProfile | null> {
    return prisma.entrepreneurProfile.findUnique({
      where: { organizationId },
    })
  }
}
