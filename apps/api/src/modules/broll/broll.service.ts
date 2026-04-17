import { Injectable, Logger } from '@nestjs/common'
import { prisma } from '@lavidz/database'
import { CreateBRollDto } from './dto/create-broll.dto'

@Injectable()
export class BRollService {
  private readonly logger = new Logger(BRollService.name)

  async findByOrganization(organizationId: string, tags?: string[]): Promise<any[]> {
    const where: Record<string, unknown> = { organizationId }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags }
    }

    return prisma.bRoll.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
  }

  async searchPexels(query: string, perPage: number) {
    const apiKey = process.env.PEXELS_API_KEY
    if (!apiKey) {
      this.logger.warn('PEXELS_API_KEY is not set, returning empty results')
      return []
    }

    try {
      const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}`
      const response = await fetch(url, {
        headers: { Authorization: apiKey },
      })

      if (!response.ok) {
        this.logger.error(`Pexels API error: ${response.status} ${response.statusText}`)
        return []
      }

      const data: any = await response.json()
      return (data.videos ?? []).map((video: any) => ({
        pexelsId: video.id,
        url: video.video_files?.[0]?.link ?? video.url,
        thumbnailUrl: video.image,
        duration: video.duration,
        title: video.url?.split('/').pop()?.replace(/-/g, ' ') ?? '',
      }))
    } catch (error) {
      this.logger.error('Failed to search Pexels', error)
      return []
    }
  }

  async create(organizationId: string, dto: CreateBRollDto): Promise<any> {
    return prisma.bRoll.create({
      data: {
        organizationId,
        source: dto.source,
        url: dto.url,
        thumbnailUrl: dto.thumbnailUrl,
        tags: dto.tags ?? [],
        duration: dto.duration,
        title: dto.title,
      },
    })
  }

  async remove(id: string): Promise<any> {
    return prisma.bRoll.delete({ where: { id } })
  }
}
