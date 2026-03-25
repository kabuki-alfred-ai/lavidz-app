import {
  Controller, Post, Get, Put, Patch, Param, Body,
  UploadedFile, UseInterceptors, UseGuards,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { SessionsService } from './sessions.service'
import { AdminGuard } from '../../guards/admin.guard'

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@Body() body: { themeId: string; recipientEmail?: string; recipientName?: string }): Promise<any> {
    return this.sessionsService.create(body.themeId, body.recipientEmail, body.recipientName)
  }

  @Get('submitted')
  @UseGuards(AdminGuard)
  getSubmitted(): Promise<any[]> {
    return this.sessionsService.getSubmitted()
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<any> {
    return this.sessionsService.findOne(id)
  }

  @Post(':id/submit')
  submit(@Param('id') id: string): Promise<any> {
    return this.sessionsService.submit(id)
  }

  @Put(':id/final-video-key')
  @UseGuards(AdminGuard)
  saveFinalVideoKey(@Param('id') id: string, @Body() body: { key: string }): Promise<any> {
    return this.sessionsService.saveFinalVideoKey(id, body.key)
  }

  @Patch(':id/montage-settings')
  @UseGuards(AdminGuard)
  saveMontageSettings(@Param('id') id: string, @Body() body: { montageSettings: Record<string, unknown> }): Promise<any> {
    return this.sessionsService.saveMontageSettings(id, body.montageSettings)
  }

  @Post(':sessionId/recordings/:recordingId/cache')
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('file'))
  uploadRecordingCache(
    @Param('sessionId') sessionId: string,
    @Param('recordingId') recordingId: string,
    @Body() body: { type: 'tts' | 'processed'; voiceId?: string; processingHash?: string },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    return this.sessionsService.uploadRecordingCache(
      sessionId,
      recordingId,
      file.buffer,
      file.mimetype,
      body.type,
      body.voiceId,
      body.processingHash,
    )
  }

  @Get(':sessionId/recordings/:recordingId/tts-url')
  @UseGuards(AdminGuard)
  getRecordingTtsUrl(@Param('recordingId') recordingId: string): Promise<string> {
    return this.sessionsService.getRecordingTtsUrl(recordingId)
  }

  @Get(':sessionId/recordings/:recordingId/processed-url')
  @UseGuards(AdminGuard)
  getRecordingProcessedUrl(@Param('recordingId') recordingId: string): Promise<string> {
    return this.sessionsService.getRecordingProcessedUrl(recordingId)
  }

  @Post(':id/invite')
  @UseGuards(AdminGuard)
  sendInvite(@Param('id') id: string, @Body() body: { shareUrl: string }): Promise<void> {
    return this.sessionsService.sendInvite(id, body.shareUrl)
  }

  @Post(':id/deliver')
  @UseGuards(AdminGuard)
  deliver(@Param('id') id: string): Promise<any> {
    return this.sessionsService.deliver(id)
  }

  @Get(':id/final-url')
  getFinalVideoUrl(@Param('id') id: string): Promise<string> {
    return this.sessionsService.getFinalVideoUrl(id)
  }

  @Post(':id/recordings')
  @UseInterceptors(FileInterceptor('video'))
  uploadRecording(
    @Param('id') sessionId: string,
    @Body() body: { questionId: string },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    return this.sessionsService.uploadRecording(
      sessionId,
      body.questionId,
      file.buffer,
      file.mimetype,
    )
  }

  @Get(':sessionId/recordings/:recordingId/url')
  getRecordingUrl(@Param('recordingId') recordingId: string): Promise<string> {
    return this.sessionsService.getRecordingUrl(recordingId)
  }
}
