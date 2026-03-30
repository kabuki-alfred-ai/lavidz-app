import { Injectable, BadRequestException } from '@nestjs/common'
import { prisma } from '@lavidz/database'

@Injectable()
export class FeedbacksService {
  async create(data: {
    sessionId: string
    overallRating: number
    questionRating: number
    comment?: string
  }) {
    if (data.overallRating < 1 || data.overallRating > 5 || data.questionRating < 1 || data.questionRating > 5) {
      throw new BadRequestException('Ratings must be between 1 and 5')
    }

    const existing = await prisma.feedback.findUnique({ where: { sessionId: data.sessionId } })
    if (existing) {
      throw new BadRequestException('Feedback already submitted for this session')
    }

    return prisma.feedback.create({
      data: {
        sessionId: data.sessionId,
        overallRating: data.overallRating,
        questionRating: data.questionRating,
        comment: data.comment ?? null,
      },
    })
  }

  async findAll() {
    return prisma.feedback.findMany({
      include: {
        session: {
          select: {
            recipientName: true,
            recipientEmail: true,
            theme: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getStats() {
    const feedbacks = await prisma.feedback.findMany({
      select: { overallRating: true, questionRating: true },
    })
    const count = feedbacks.length
    if (count === 0) return { count: 0, avgOverall: 0, avgQuestion: 0 }
    const avgOverall = feedbacks.reduce((s, f) => s + f.overallRating, 0) / count
    const avgQuestion = feedbacks.reduce((s: number, f) => s + f.questionRating, 0) / count
    return {
      count,
      avgOverall: Math.round(avgOverall * 10) / 10,
      avgQuestion: Math.round(avgQuestion * 10) / 10,
    }
  }
}
