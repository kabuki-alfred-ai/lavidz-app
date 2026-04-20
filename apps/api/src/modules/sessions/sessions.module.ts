import { Module } from '@nestjs/common'
import { SessionsController } from './sessions.controller'
import { SessionsService } from './sessions.service'
import { StorageModule } from '../storage/storage.module'
import { AiModule } from '../ai/ai.module'
import { BullModule } from '@nestjs/bullmq'

@Module({
  imports: [
    StorageModule,
    AiModule,
    BullModule.registerQueue({ name: 'transcription' }),
    BullModule.registerQueue({ name: 'enrichment' }),
    BullModule.registerQueue({ name: 'recording-analysis' }),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
