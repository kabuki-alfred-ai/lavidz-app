import {
  Controller, Post, Get, Param, Body,
  UploadedFile, UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Multer } from 'multer'
import { SessionsService } from './sessions.service'

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@Body() body: { themeId: string }): Promise<any> {
    return this.sessionsService.create(body.themeId)
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<any> {
    return this.sessionsService.findOne(id)
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
