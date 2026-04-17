import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common'
import { ContentCalendarService } from './content-calendar.service'
import { CreateContentCalendarDto } from './dto/create-content-calendar.dto'
import { UpdateContentCalendarDto } from './dto/update-content-calendar.dto'
import { AdminGuard } from '../../guards/admin.guard'

@Controller('content-calendar')
export class ContentCalendarController {
  constructor(private readonly contentCalendarService: ContentCalendarService) {}

  @UseGuards(AdminGuard)
  @Get()
  findAll(
    @Headers('x-organization-id') organizationId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.contentCalendarService.findByOrganization(organizationId, from, to)
  }

  @UseGuards(AdminGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contentCalendarService.findOne(id)
  }

  @UseGuards(AdminGuard)
  @Post()
  create(
    @Headers('x-organization-id') organizationId: string,
    @Body() dto: CreateContentCalendarDto,
  ) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.contentCalendarService.create(organizationId, dto)
  }

  @UseGuards(AdminGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContentCalendarDto) {
    return this.contentCalendarService.update(id, dto)
  }

  @UseGuards(AdminGuard)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.contentCalendarService.updateStatus(id, status)
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contentCalendarService.remove(id)
  }
}
