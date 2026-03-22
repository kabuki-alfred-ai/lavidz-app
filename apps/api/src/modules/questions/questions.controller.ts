import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { type Question } from '@lavidz/database'
import { QuestionsService } from './questions.service'
import { CreateQuestionDto } from './dto/create-question.dto'
import { UpdateQuestionDto } from './dto/update-question.dto'
import { AdminGuard } from '../../guards/admin.guard'

@UseGuards(AdminGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get('theme/:themeId')
  findByTheme(@Param('themeId') themeId: string): Promise<Question[]> {
    return this.questionsService.findByTheme(themeId)
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Question> {
    return this.questionsService.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateQuestionDto): Promise<Question> {
    return this.questionsService.create(dto)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuestionDto): Promise<Question> {
    return this.questionsService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<Question> {
    return this.questionsService.remove(id)
  }

  @Put('theme/:themeId/reorder')
  reorder(@Param('themeId') themeId: string, @Body() body: { orderedIds: string[] }): Promise<Question[]> {
    return this.questionsService.reorder(themeId, body.orderedIds)
  }
}
