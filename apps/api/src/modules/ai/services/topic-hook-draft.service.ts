import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { prisma, Prisma } from '@lavidz/database'

/**
 * TopicHookDraftService — CRUD simple du champ `Topic.hookDraft`.
 *
 * Contrairement à `SubjectHookService` (hooks structurés native/marketing
 * générés par LLM et stockés sur Topic.hooks), ce service gère des NOTES
 * LIBRES d'idées d'accroches saisies par l'entrepreneur — aucune génération
 * LLM, pas de format structuré. C'est un pense-bête long-terme (mémoire
 * stratégique) qui alimente les services aval (session-hook, chat Kabou).
 *
 * Shape stockée : `{ notes: string; updatedAt: string }` — volontairement
 * flexible pour accueillir du texte libre ou un bloc markdown.
 */

export type TopicHookDraft = {
  notes: string
  updatedAt: string
}

@Injectable()
export class TopicHookDraftService {
  async get(organizationId: string, topicId: string): Promise<TopicHookDraft | null> {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: { hookDraft: true },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')
    if (!topic.hookDraft || typeof topic.hookDraft !== 'object') return null
    return topic.hookDraft as unknown as TopicHookDraft
  }

  async set(
    organizationId: string,
    topicId: string,
    notes: string,
  ): Promise<TopicHookDraft> {
    const trimmed = typeof notes === 'string' ? notes.trim() : ''
    if (!trimmed) {
      throw new BadRequestException('notes requis (texte non vide)')
    }
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: { id: true },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')

    const payload: TopicHookDraft = {
      notes: trimmed,
      updatedAt: new Date().toISOString(),
    }
    await prisma.topic.update({
      where: { id: topic.id },
      data: { hookDraft: payload as unknown as Prisma.InputJsonValue },
    })
    return payload
  }

  async clear(organizationId: string, topicId: string): Promise<void> {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: { id: true },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')
    await prisma.topic.update({
      where: { id: topic.id },
      data: { hookDraft: Prisma.JsonNull },
    })
  }
}
