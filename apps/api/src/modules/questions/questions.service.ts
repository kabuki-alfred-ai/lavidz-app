import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma, type Question } from '@lavidz/database'
import { CreateQuestionDto } from './dto/create-question.dto'
import { UpdateQuestionDto } from './dto/update-question.dto'

@Injectable()
export class QuestionsService {
  findByTheme(themeId: string): Promise<Question[]> {
    return prisma.question.findMany({
      where: { themeId },
      orderBy: { order: 'asc' },
    })
  }

  async findOne(id: string): Promise<Question> {
    const question = await prisma.question.findUnique({ where: { id } })
    if (!question) throw new NotFoundException(`Question ${id} not found`)
    return question
  }

  create(dto: CreateQuestionDto): Promise<Question> {
    return prisma.question.create({ data: dto })
  }

  async update(id: string, dto: UpdateQuestionDto): Promise<Question> {
    await this.findOne(id)
    return prisma.question.update({ where: { id }, data: dto })
  }

  async remove(id: string): Promise<Question> {
    await this.findOne(id)
    await prisma.recording.deleteMany({ where: { questionId: id } })
    return prisma.question.delete({ where: { id } })
  }

  async reorder(themeId: string, orderedIds: string[]): Promise<Question[]> {
    await Promise.all(
      orderedIds.map((id, index) =>
        prisma.question.update({ where: { id, themeId }, data: { order: index } }),
      ),
    )
    return this.findByTheme(themeId)
  }
}
