import {
  Controller, Get, Post, Delete, Param, Body, Query,
  Headers, UseGuards, HttpCode, BadRequestException,
} from '@nestjs/common'
import { BRollService } from './broll.service'
import { CreateBRollDto } from './dto/create-broll.dto'
import { AdminGuard } from '../../guards/admin.guard'

@Controller('broll')
export class BRollController {
  constructor(private readonly brollService: BRollService) {}

  @Get()
  @UseGuards(AdminGuard)
  async findAll(
    @Headers('x-organization-id') organizationId: string,
    @Query('tags') tags?: string,
  ): Promise<any[]> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    const parsedTags = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined
    return this.brollService.findByOrganization(organizationId, parsedTags)
  }

  @Get('search')
  @UseGuards(AdminGuard)
  searchPexels(
    @Query('q') q: string,
    @Query('perPage') perPage?: string,
  ) {
    if (!q) throw new BadRequestException('Query param "q" is required')
    return this.brollService.searchPexels(q, perPage ? parseInt(perPage, 10) : 10)
  }

  @Post()
  @UseGuards(AdminGuard)
  async create(
    @Headers('x-organization-id') organizationId: string,
    @Body() dto: CreateBRollDto,
  ): Promise<any> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.brollService.create(organizationId, dto)
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.brollService.remove(id)
  }
}
