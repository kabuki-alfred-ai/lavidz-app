import {
  Controller, Post, Get, Put, Patch, Delete, Param, Body, Query,
  UploadedFile, UseInterceptors, UseGuards, HttpCode,
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

  // Task 5.2 — soft-discard tous les recordings + PENDING (idempotent)
  @Post(':id/reset')
  reset(@Param('id') id: string): Promise<any> {
    return this.sessionsService.resetSession(id)
  }

  // Task 5.3 — marquer REPLACED + créer une nouvelle session (variante)
  @Post(':id/replace')
  replace(@Param('id') id: string): Promise<{ newSessionId: string }> {
    return this.sessionsService.replaceSession(id)
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

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  deleteSession(@Param('id') id: string): Promise<void> {
    return this.sessionsService.deleteSession(id)
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

  @Get(':id/recordings/:questionId/upload-url')
  getUploadUrl(
    @Param('id') sessionId: string,
    @Param('questionId') questionId: string,
    @Query('mimeType') mimeType: string,
  ): Promise<{ url: string; key: string }> {
    return this.sessionsService.getUploadUrl(sessionId, questionId, mimeType ?? 'video/webm')
  }

  @Post(':id/recordings/confirm')
  confirmRecording(
    @Param('id') sessionId: string,
    @Body() body: { questionId: string; key: string; mimeType: string },
  ): Promise<any> {
    return this.sessionsService.confirmRecording(sessionId, body.questionId, body.key, body.mimeType)
  }

  @Get(':sessionId/recordings/:recordingId/url')
  getRecordingUrl(@Param('recordingId') recordingId: string): Promise<string> {
    return this.sessionsService.getRecordingUrl(recordingId)
  }

  @Patch(':sessionId/recordings/:recordingId/raw-key')
  @UseGuards(AdminGuard)
  updateRawKey(
    @Param('recordingId') recordingId: string,
    @Body() body: { rawVideoKey: string },
  ): Promise<any> {
    return this.sessionsService.updateRawKey(recordingId, body.rawVideoKey)
  }

  @Get(':id/analysis')
  getAnalysis(@Param('id') id: string): Promise<any> {
    return this.sessionsService.getAnalysis(id)
  }

  @Post(':id/analysis/regenerate')
  @HttpCode(202)
  regenerateAnalysis(@Param('id') id: string): Promise<void> {
    return this.sessionsService.regenerateAnalysis(id)
  }

  // Task 10.3 — trigger manuel du take-analysis (compare les prises d'une
  // même question et stocke la kabouRecommendation sur le canonical).
  @Post(':id/analyze-takes')
  @HttpCode(202)
  analyzeTakes(@Param('id') id: string): Promise<void> {
    return this.sessionsService.analyzeTakes(id)
  }

  @Post(':id/recordings/:questionId/redo')
  @HttpCode(204)
  redoRecording(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ): Promise<void> {
    return this.sessionsService.redoRecording(id, questionId)
  }

  @Post(':id/montage-hints')
  @HttpCode(204)
  addMontageHint(
    @Param('id') id: string,
    @Body() body: { type: string; count?: number; note?: string },
  ): Promise<void> {
    return this.sessionsService.addMontageHint(id, body)
  }
}
