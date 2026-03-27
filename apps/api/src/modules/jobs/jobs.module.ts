import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { TranscriptionProcessor } from './transcription.processor'
import { EnrichmentProcessor } from './enrichment.processor'
import { StorageModule } from '../storage/storage.module'
import { AiModule } from '../ai/ai.module'

const JOB_DEFAULT_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
}

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'transcription',
      defaultJobOptions: JOB_DEFAULT_OPTIONS,
    }),
    BullModule.registerQueue({
      name: 'enrichment',
      defaultJobOptions: JOB_DEFAULT_OPTIONS,
    }),
    StorageModule,
    AiModule,
  ],
  providers: [TranscriptionProcessor, EnrichmentProcessor],
})
export class JobsModule {}
