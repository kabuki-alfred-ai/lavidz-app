import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { ProfileService } from './services/profile.service'
import { QuestionnaireService } from './services/questionnaire.service'
import { MemoryService } from './services/memory.service'
import { EnrichmentService } from './services/enrichment.service'
import { LinkedinService } from './services/linkedin.service'

@Module({
  controllers: [AiController],
  providers: [ProfileService, QuestionnaireService, MemoryService, EnrichmentService, LinkedinService],
  exports: [ProfileService, QuestionnaireService, MemoryService, EnrichmentService, LinkedinService],
})
export class AiModule {}
