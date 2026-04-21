import { Injectable } from '@nestjs/common'
import type { Topic } from '@prisma/client'

export type ReadinessBreakdown = {
  brief: number
  hooks: number
  recordingGuide: number
  sourcesOrPillar: number
  chosenHook: number
}

export type ReadinessResult = {
  score: number
  breakdown: ReadinessBreakdown
}

@Injectable()
export class TopicReadinessService {
  computeScore(topic: Pick<Topic, 'brief' | 'hooks' | 'recordingGuide' | 'sources' | 'pillar'>): ReadinessResult {
    const brief = this.scoreBrief(topic.brief)
    const hooks = this.scoreHooks(topic.hooks)
    const recordingGuide = this.scoreRecordingGuide(topic.recordingGuide)
    const sourcesOrPillar = this.scoreSourcesOrPillar(topic.sources, topic.pillar)
    const chosenHook = this.scoreChosenHook(topic.hooks)

    const score = brief + hooks + recordingGuide + sourcesOrPillar + chosenHook

    return {
      score,
      breakdown: { brief, hooks, recordingGuide, sourcesOrPillar, chosenHook },
    }
  }

  private scoreBrief(brief: string | null | undefined): number {
    if (!brief) return 0
    return brief.trim().length >= 50 ? 25 : 0
  }

  private scoreHooks(hooks: unknown): number {
    if (!hooks || typeof hooks !== 'object') return 0
    const h = hooks as { native?: unknown; marketing?: unknown }
    const hasNative = typeof h.native === 'string' && h.native.trim().length > 0
    const hasMarketing = typeof h.marketing === 'string' && h.marketing.trim().length > 0
    return hasNative || hasMarketing ? 25 : 0
  }

  private scoreRecordingGuide(recordingGuide: unknown): number {
    return recordingGuide !== null && recordingGuide !== undefined ? 25 : 0
  }

  private scoreSourcesOrPillar(sources: unknown, pillar: string | null | undefined): number {
    const hasSources = Array.isArray(sources) && sources.length >= 1
    const hasPillar = typeof pillar === 'string' && pillar.trim().length > 0
    return hasSources || hasPillar ? 15 : 0
  }

  private scoreChosenHook(hooks: unknown): number {
    if (!hooks || typeof hooks !== 'object') return 0
    const h = hooks as { chosen?: unknown }
    return typeof h.chosen === 'string' && h.chosen.trim().length > 0 ? 10 : 0
  }
}
