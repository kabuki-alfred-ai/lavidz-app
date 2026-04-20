import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { ProfileService } from './services/profile.service'
import { QuestionnaireService } from './services/questionnaire.service'
import { MemoryService } from './services/memory.service'
import { EnrichmentService } from './services/enrichment.service'
import { LinkedinService } from './services/linkedin.service'
import { CalendarService } from './services/calendar.service'
import { RecordingAnalysisService } from './services/recording-analysis.service'
import { UnstuckService } from './services/unstuck.service'
import { VoiceGuardianService } from './services/voice-guardian.service'
import { WeeklyReviewService } from './services/weekly-review.service'
import { SubjectHookService } from './services/subject-hook.service'
import { SourcesService } from './services/sources.service'
import { TopicFromInsightService } from './services/topic-from-insight.service'
import { NarrativeArcService } from './services/narrative-arc.service'

@Module({
  controllers: [AiController],
  providers: [
    ProfileService,
    QuestionnaireService,
    MemoryService,
    EnrichmentService,
    LinkedinService,
    CalendarService,
    RecordingAnalysisService,
    UnstuckService,
    VoiceGuardianService,
    WeeklyReviewService,
    SubjectHookService,
    SourcesService,
    TopicFromInsightService,
    NarrativeArcService,
  ],
  exports: [
    ProfileService,
    QuestionnaireService,
    MemoryService,
    EnrichmentService,
    LinkedinService,
    CalendarService,
    RecordingAnalysisService,
    UnstuckService,
    VoiceGuardianService,
    WeeklyReviewService,
    SubjectHookService,
    SourcesService,
    TopicFromInsightService,
    NarrativeArcService,
  ],
})
export class AiModule {}
