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

    const entries = await prisma.contentCalendar.findMany({
      where,
      orderBy: { scheduledDate: 'asc' },
      include: {
        topicEntity: {
          select: {
            id: true,
            name: true,
            status: true,
            brief: true,
            pillar: true,
            sessions: {
              select: { id: true, status: true, submittedAt: true },
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    })
    // Preserve the legacy `topic` string field on the wire so existing clients keep working.
    return entries.map((e) => ({ ...e, topic: e.topicEntity?.name ?? '' }))
  }

  async findOne(id: string): Promise<any> {
    const entry = await prisma.contentCalendar.findUnique({ where: { id } })
    if (!entry) throw new NotFoundException(`ContentCalendar ${id} not found`)
    return entry
  }

  async create(organizationId: string, dto: CreateContentCalendarDto): Promise<any> {
    const topicId = await this.resolveTopicId(organizationId, dto.topicId, dto.topic)
    return prisma.contentCalendar.create({
      data: {
        organizationId,
        scheduledDate: new Date(dto.scheduledDate),
        description: dto.description,
        format: dto.format,
        platforms: dto.platforms,
        topicId,
      },
    })
  }

  /**
   * Every ContentCalendar row requires a Topic now. We accept either an explicit
   * topicId or a topic name string (find-or-create within the organization).
   */
  private async resolveTopicId(
    organizationId: string,
    topicId: string | undefined,
    name: string | undefined,
  ): Promise<string> {
    if (topicId) {
      const existing = await prisma.topic.findFirst({ where: { id: topicId, organizationId } })
      if (!existing) throw new NotFoundException(`Sujet ${topicId} introuvable`)
      return existing.id
    }
    const cleanName = name?.trim()
    if (!cleanName) throw new NotFoundException('Il faut un topicId ou un topic pour créer une entrée')

    const existing = await prisma.topic.findFirst({
      where: {
        organizationId,
        name: { equals: cleanName, mode: 'insensitive' },
        status: { not: 'ARCHIVED' },
      },
    })
    if (existing) return existing.id

    const slug = `${cleanName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Date.now()}`
    const created = await prisma.topic.create({
      data: { organizationId, name: cleanName, slug },
    })
    return created.id
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
