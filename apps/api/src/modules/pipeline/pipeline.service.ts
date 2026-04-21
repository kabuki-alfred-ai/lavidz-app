import { Injectable } from '@nestjs/common'
import { prisma } from '@lavidz/database'
import { derivePipelineStage, type PipelineStage } from './pipeline-stage.util'
import { TopicReadinessService } from '../ai/services/topic-readiness.service'

const REGULARITY_WINDOW_DAYS = 7

export type PipelineTopicSummary = {
  id: string
  name: string
  slug: string
  status: string
  stage: PipelineStage
  readinessScore: number
  calendarEntries: Array<{
    id: string
    status: string
    scheduledDate: Date
    publishAt: Date | null
    format: string
    sessionId: string | null
  }>
  sessions: Array<{ id: string; status: string; publishedAt: Date | null; contentFormat: string | null }>
  projects: Array<{ id: string; status: string; sessionId: string | null }>
}

export type PipelineResponse = {
  topics: PipelineTopicSummary[]
  regularityAlert: boolean
}

@Injectable()
export class PipelineService {
  constructor(private readonly readinessService: TopicReadinessService) {}

  async getPipeline(organizationId: string): Promise<PipelineResponse> {
    const topics = await prisma.topic.findMany({
      where: { organizationId, status: { not: 'ARCHIVED' } },
      include: {
        calendarEntries: {
          select: {
            id: true,
            status: true,
            scheduledDate: true,
            publishAt: true,
            format: true,
            sessionId: true,
          },
        },
        sessions: {
          select: { id: true, status: true, publishedAt: true, contentFormat: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const sessionIds = topics.flatMap((t) => t.sessions.map((s) => s.id))
    const projects = sessionIds.length
      ? await prisma.project.findMany({
          where: { sessionId: { in: sessionIds } },
          select: { id: true, status: true, sessionId: true },
        })
      : []

    const projectsBySession = new Map<string, Array<{ id: string; status: string; sessionId: string | null }>>()
    for (const p of projects) {
      if (!p.sessionId) continue
      const arr = projectsBySession.get(p.sessionId) ?? []
      arr.push(p)
      projectsBySession.set(p.sessionId, arr)
    }

    const summaries: PipelineTopicSummary[] = topics.map((topic) => {
      const topicProjects = topic.sessions.flatMap((s) => projectsBySession.get(s.id) ?? [])
      const stage = derivePipelineStage({
        topicStatus: topic.status as 'DRAFT' | 'READY' | 'ARCHIVED',
        sessions: topic.sessions.map((s) => ({ status: s.status, publishedAt: s.publishedAt })),
        projects: topicProjects.map((p) => ({ status: p.status as any })),
        calendarEntries: topic.calendarEntries.map((c) => ({ status: c.status as any })),
      })

      const readiness = this.readinessService.computeScore(topic)

      return {
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        status: topic.status,
        stage,
        readinessScore: readiness.score,
        calendarEntries: topic.calendarEntries,
        sessions: topic.sessions,
        projects: topicProjects,
      }
    })

    const regularityAlert = this.computeRegularityAlert(summaries)

    return { topics: summaries, regularityAlert }
  }

  private computeRegularityAlert(summaries: PipelineTopicSummary[]): boolean {
    const now = new Date()
    const threshold = new Date(now)
    threshold.setDate(threshold.getDate() + REGULARITY_WINDOW_DAYS)

    const hasReadyTopic = summaries.some((s) => s.status === 'READY')
    const hasUpcomingPlanned = summaries.some((s) =>
      s.calendarEntries.some(
        (c) => c.status === 'PLANNED' && c.publishAt !== null && c.publishAt <= threshold,
      ),
    )
    return !hasReadyTopic && !hasUpcomingPlanned
  }
}
