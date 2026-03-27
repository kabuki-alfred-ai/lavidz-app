import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma, type Theme } from '@lavidz/database'
import { CreateThemeDto } from './dto/create-theme.dto'
import { UpdateThemeDto } from './dto/update-theme.dto'

@Injectable()
export class ThemesService {
  findAll(): Promise<any[]> {
    return prisma.theme.findMany({
      orderBy: { order: 'asc' },
      include: {
        questions: {
          where: { active: true },
          orderBy: { order: 'asc' },
        },
      },
    })
  }

  findActive(): Promise<any[]> {
    return prisma.theme.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
      include: {
        questions: {
          where: { active: true },
          orderBy: { order: 'asc' },
        },
      },
    })
  }

  async findOne(id: string): Promise<any> {
    const theme = await prisma.theme.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
    })
    if (!theme) throw new NotFoundException(`Theme ${id} not found`)
    return theme
  }

  async findBySlug(slug: string): Promise<any> {
    const theme = await prisma.theme.findUnique({
      where: { slug },
      include: {
        questions: {
          where: { active: true },
          orderBy: { order: 'asc' },
        },
      },
    })
    if (!theme) throw new NotFoundException(`Theme ${slug} not found`)
    return theme
  }

  create(dto: CreateThemeDto): Promise<Theme> {
    return prisma.theme.create({ data: dto })
  }

  async update(id: string, dto: UpdateThemeDto): Promise<Theme> {
    try {
      return await prisma.theme.update({ where: { id }, data: dto })
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException(`Theme ${id} not found`)
      throw e
    }
  }

  async remove(id: string): Promise<Theme> {
    try {
      return await prisma.theme.delete({ where: { id } })
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException(`Theme ${id} not found`)
      throw e
    }
  }
}
