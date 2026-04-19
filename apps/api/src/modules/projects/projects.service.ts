import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma, type Project } from '@lavidz/database'

@Injectable()
export class ProjectsService {
  async create(data: {
    title: string
    organizationId: string
    sessionId?: string
  }): Promise<Project> {
    return prisma.project.create({ data })
  }

  async findAllByOrg(organizationId: string): Promise<Project[]> {
    return prisma.project.findMany({
      where: { organizationId },
      include: {
        clips: {
          orderBy: { order: 'asc' },
          include: {
            recording: {
              include: {
                question: true,
                session: { select: { id: true, contentFormat: true, theme: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string): Promise<any> {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        clips: {
          orderBy: { order: 'asc' },
          include: {
            recording: {
              include: {
                question: true,
                session: { select: { id: true, contentFormat: true, theme: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
    })
    if (!project) throw new NotFoundException(`Project ${id} not found`)
    return project
  }

  async update(id: string, data: { title?: string; status?: string }): Promise<Project> {
    await this.findOne(id)
    return prisma.project.update({ where: { id }, data: data as any })
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id)
    await prisma.project.delete({ where: { id } })
  }

  async addClip(projectId: string, recordingId: string): Promise<any> {
    await this.findOne(projectId)

    const maxOrder = await prisma.projectClip.aggregate({
      where: { projectId },
      _max: { order: true },
    })
    const nextOrder = (maxOrder._max.order ?? -1) + 1

    return prisma.projectClip.create({
      data: { projectId, recordingId, order: nextOrder },
      include: {
        recording: {
          include: {
            question: true,
            session: { select: { id: true, contentFormat: true, theme: { select: { id: true, name: true } } } },
          },
        },
      },
    })
  }

  async removeClip(projectId: string, clipId: string): Promise<void> {
    const clip = await prisma.projectClip.findFirst({
      where: { id: clipId, projectId },
    })
    if (!clip) throw new NotFoundException(`Clip ${clipId} not found in project`)
    await prisma.projectClip.delete({ where: { id: clipId } })

    // Reorder remaining clips
    const remaining = await prisma.projectClip.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    })
    await Promise.all(
      remaining.map((c, i) => prisma.projectClip.update({ where: { id: c.id }, data: { order: i } })),
    )
  }

  async reorderClips(projectId: string, clipIds: string[]): Promise<any> {
    await this.findOne(projectId)

    await Promise.all(
      clipIds.map((clipId, index) =>
        prisma.projectClip.update({ where: { id: clipId }, data: { order: index } }),
      ),
    )

    return this.findOne(projectId)
  }

  async updateClipRanges(clipId: string, visibleRanges: any): Promise<any> {
    return prisma.projectClip.update({
      where: { id: clipId },
      data: { visibleRanges },
    })
  }

  async saveMontageSettings(projectId: string, settings: Record<string, unknown>): Promise<Project> {
    await this.findOne(projectId)
    return prisma.project.update({
      where: { id: projectId },
      data: { montageSettings: settings as any },
    })
  }

  async listRushes(filters: {
    organizationId: string
    format?: string
    themeId?: string
    status?: string
    search?: string
  }): Promise<any[]> {
    const where: any = {
      session: {
        theme: { organizationId: filters.organizationId },
      },
      rawVideoKey: { not: null },
    }

    if (filters.format) {
      where.session.contentFormat = filters.format
    }
    if (filters.themeId) {
      where.session.themeId = filters.themeId
    }
    if (filters.status) {
      where.status = filters.status
    }
    if (filters.search) {
      where.transcript = { contains: filters.search, mode: 'insensitive' }
    }

    return prisma.recording.findMany({
      where,
      include: {
        question: { select: { id: true, text: true } },
        session: {
          select: {
            id: true,
            createdAt: true,
            contentFormat: true,
            theme: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createFromSession(sessionId: string): Promise<Project> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        theme: { select: { name: true, organizationId: true } },
        recordings: { orderBy: { createdAt: 'asc' }, select: { id: true } },
      },
    })
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`)
    if (!session.theme?.organizationId) throw new NotFoundException('Session has no organization')

    const project = await prisma.project.create({
      data: {
        title: session.theme.name,
        organizationId: session.theme.organizationId,
        sessionId,
        clips: {
          create: session.recordings.map((rec, index) => ({
            recordingId: rec.id,
            order: index,
          })),
        },
      },
      include: {
        clips: {
          orderBy: { order: 'asc' },
          include: { recording: true },
        },
      },
    })

    return project
  }
}
