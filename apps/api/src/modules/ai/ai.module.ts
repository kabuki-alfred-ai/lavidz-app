import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { ProfileService } from './services/profile.service'
import { QuestionnaireService } from './services/questionnaire.service'
import { MemoryService } from './services/memory.service'
import { EnrichmentService } from './services/enrichment.service'

@Module({
  controllers: [AiController],
  providers: [ProfileService, QuestionnaireService, MemoryService, EnrichmentService],
  exports: [ProfileService, QuestionnaireService, MemoryService, EnrichmentService],
})
export class AiModule {}
