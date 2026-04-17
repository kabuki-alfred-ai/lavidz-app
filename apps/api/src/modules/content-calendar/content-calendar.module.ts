import { Module } from '@nestjs/common'
import { ContentCalendarController } from './content-calendar.controller'
import { ContentCalendarService } from './content-calendar.service'

@Module({
  controllers: [ContentCalendarController],
  providers: [ContentCalendarService],
  exports: [ContentCalendarService],
})
export class ContentCalendarModule {}
