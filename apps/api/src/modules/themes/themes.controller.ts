import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ThemesService } from './themes.service'
import { CreateThemeDto } from './dto/create-theme.dto'
import { UpdateThemeDto } from './dto/update-theme.dto'
import { AdminGuard } from '../../guards/admin.guard'

@Controller('themes')
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  @Get()
  findActive() {
    return this.themesService.findActive()
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.themesService.findBySlug(slug)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.themesService.findOne(id)
  }

  @UseGuards(AdminGuard)
  @Get('admin/all')
  findAll() {
    return this.themesService.findAll()
  }

  @UseGuards(AdminGuard)
  @Post()
  create(@Body() dto: CreateThemeDto) {
    return this.themesService.create(dto)
  }

  @UseGuards(AdminGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateThemeDto) {
    return this.themesService.update(id, dto)
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.themesService.remove(id)
  }
}
