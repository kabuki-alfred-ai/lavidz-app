import { Module } from '@nestjs/common'
import { SessionsController } from './sessions.controller'
import { SessionsService } from './sessions.service'
import { StorageModule } from '../storage/storage.module'
import { BullModule } from '@nestjs/bullmq'

@Module({
  imports: [
    StorageModule,
    BullModule.registerQueue({ name: 'transcription' }),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
