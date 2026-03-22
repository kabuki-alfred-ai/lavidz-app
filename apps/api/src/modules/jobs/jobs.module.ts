import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { TranscriptionProcessor } from './transcription.processor'
import { StorageModule } from '../storage/storage.module'

@Module({
  imports: [
    BullModule.registerQueue({ name: 'transcription' }),
    StorageModule,
  ],
  providers: [TranscriptionProcessor],
})
export class JobsModule {}
