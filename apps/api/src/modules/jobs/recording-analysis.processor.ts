import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { RecordingAnalysisService } from '../ai/services/recording-analysis.service'

export type RecordingAnalysisJobData = {
  sessionId: string
  reason?: 'post_submit' | 'manual_regeneration'
}

/**
 * Generates the post-recording analysis asynchronously so the entrepreneur
 * lands on the after-tournage screen instantly and sees the analysis arrive
 * within 20-40s.
 *
 * Runs with low concurrency (1) to respect rate limits of the underlying
 * LLM provider — we prioritize quality over throughput.
 */
@Processor('recording-analysis', { concurrency: 1 })
export class RecordingAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(RecordingAnalysisProcessor.name)

  constructor(private readonly service: RecordingAnalysisService) {
    super()
  }

  async process(job: Job<RecordingAnalysisJobData>): Promise<void> {
    const { sessionId, reason } = job.data
    this.logger.log(
      `Analyse post-tournage démarrée pour la session ${sessionId} (${reason ?? 'default'})`,
    )

    try {
      await this.service.analyzeSession(sessionId)
      this.logger.log(`Analyse post-tournage terminée pour la session ${sessionId}`)
    } catch (error) {
      this.logger.error(
        `Échec de l'analyse post-tournage pour la session ${sessionId}`,
        error as Error,
      )
      // The service has already persisted the FAILED state — rethrow so BullMQ can retry.
      throw error
    }
  }
}
