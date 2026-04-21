import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { PipelineController } from './pipeline.controller'
import { PipelineService } from './pipeline.service'

@Module({
  imports: [AiModule],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
