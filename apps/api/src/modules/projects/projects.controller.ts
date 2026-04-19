import {
  Controller, Post, Get, Patch, Delete, Param, Body, Query, UseGuards, HttpCode,
} from '@nestjs/common'
import { ProjectsService } from './projects.service'
import { AdminGuard } from '../../guards/admin.guard'

@Controller('projects')
@UseGuards(AdminGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@Body() body: { title: string; organizationId: string }): Promise<any> {
    return this.projectsService.create(body)
  }

  @Get()
  findAll(@Query('organizationId') organizationId: string): Promise<any[]> {
    return this.projectsService.findAllByOrg(organizationId)
  }

  // Static routes BEFORE :id param routes
  @Get('rushes/library')
  listRushes(
    @Query('organizationId') organizationId: string,
    @Query('format') format?: string,
    @Query('themeId') themeId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ): Promise<any[]> {
    return this.projectsService.listRushes({ organizationId, format, themeId, status, search })
  }

  @Post('from-session/:sessionId')
  createFromSession(@Param('sessionId') sessionId: string): Promise<any> {
    return this.projectsService.createFromSession(sessionId)
  }

  @Patch('clips/:clipId/ranges')
  updateClipRanges(@Param('clipId') clipId: string, @Body() body: { visibleRanges: any }): Promise<any> {
    return this.projectsService.updateClipRanges(clipId, body.visibleRanges)
  }

  // Param routes
  @Get(':id')
  findOne(@Param('id') id: string): Promise<any> {
    return this.projectsService.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { title?: string; status?: string }): Promise<any> {
    return this.projectsService.update(id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string): Promise<void> {
    return this.projectsService.delete(id)
  }

  @Post(':id/clips')
  addClip(@Param('id') projectId: string, @Body() body: { recordingId: string }): Promise<any> {
    return this.projectsService.addClip(projectId, body.recordingId)
  }

  @Delete(':id/clips/:clipId')
  @HttpCode(204)
  removeClip(@Param('id') projectId: string, @Param('clipId') clipId: string): Promise<void> {
    return this.projectsService.removeClip(projectId, clipId)
  }

  @Patch(':id/clips/reorder')
  reorderClips(@Param('id') projectId: string, @Body() body: { clipIds: string[] }): Promise<any> {
    return this.projectsService.reorderClips(projectId, body.clipIds)
  }

  @Patch(':id/montage-settings')
  saveMontageSettings(@Param('id') id: string, @Body() body: { montageSettings: Record<string, unknown> }): Promise<any> {
    return this.projectsService.saveMontageSettings(id, body.montageSettings)
  }
}
