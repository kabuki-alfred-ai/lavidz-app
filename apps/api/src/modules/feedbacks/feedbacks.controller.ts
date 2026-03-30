import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common'
import { FeedbacksService } from './feedbacks.service'
import { AdminGuard } from '../../guards/admin.guard'

@Controller('feedbacks')
export class FeedbacksController {
  constructor(private readonly feedbacksService: FeedbacksService) {}

  @Post()
  create(
    @Body()
    body: {
      sessionId: string
      overallRating: number
      questionRating: number
      comment?: string
    },
  ) {
    return this.feedbacksService.create(body)
  }

  @Get()
  @UseGuards(AdminGuard)
  findAll() {
    return this.feedbacksService.findAll()
  }

  @Get('stats')
  @UseGuards(AdminGuard)
  getStats() {
    return this.feedbacksService.getStats()
  }
}
