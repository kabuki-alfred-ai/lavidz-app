import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { TranscriptionProcessor } from './transcription.processor'
import { EnrichmentProcessor } from './enrichment.processor'
import { StorageModule } from '../storage/storage.module'
import { AiModule } from '../ai/ai.module'

@Module({
  imports: [
    BullModule.registerQueue({ name: 'transcription' }),
    BullModule.registerQueue({ name: 'enrichment' }),
    StorageModule,
    AiModule,
  ],
  providers: [TranscriptionProcessor, EnrichmentProcessor],
})
export class JobsModule {}
