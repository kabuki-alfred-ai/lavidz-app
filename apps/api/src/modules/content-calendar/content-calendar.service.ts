import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma } from '@lavidz/database'
import { CreateContentCalendarDto } from './dto/create-content-calendar.dto'
import { UpdateContentCalendarDto } from './dto/update-content-calendar.dto'

@Injectable()
export class ContentCalendarService {
  async findByOrganization(organizationId: string, from?: string, to?: string): Promise<any[]> {
    const where: Record<string, unknown> = { organizationId }

    if (from || to) {
      const scheduledDate: Record<string, Date> = {}
      if (from) scheduledDate.gte = new Date(from)
      if (to) scheduledDate.lte = new Date(to)
      where.scheduledDate = scheduledDate
    }

    return prisma.contentCalendar.findMany({
      where,
      orderBy: { scheduledDate: 'asc' },
      include: {
        topicEntity: { select: { id: true, status: true } },
      },
    })
  }

  async findOne(id: string): Promise<any> {
    const entry = await prisma.contentCalendar.findUnique({ where: { id } })
    if (!entry) throw new NotFoundException(`ContentCalendar ${id} not found`)
    return entry
  }

  async create(organizationId: string, dto: CreateContentCalendarDto): Promise<any> {
    return prisma.contentCalendar.create({
      data: {
        organizationId,
        scheduledDate: new Date(dto.scheduledDate),
        topic: dto.topic,
        description: dto.description,
        format: dto.format,
        platforms: dto.platforms,
      },
    })
  }

  async update(id: string, dto: UpdateContentCalendarDto): Promise<any> {
    try {
      const data: Record<string, unknown> = { ...dto }
      if (dto.scheduledDate) data.scheduledDate = new Date(dto.scheduledDate)
      return await prisma.contentCalendar.update({ where: { id }, data })
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException(`ContentCalendar ${id} not found`)
      throw e
    }
  }

  async updateStatus(id: string, status: string): Promise<any> {
    try {
      return await prisma.contentCalendar.update({
        where: { id },
        data: { status: status as any },
      })
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException(`ContentCalendar ${id} not found`)
      throw e
    }
  }

  async remove(id: string): Promise<any> {
    try {
      return await prisma.contentCalendar.delete({ where: { id } })
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException(`ContentCalendar ${id} not found`)
      throw e
    }
  }
}
