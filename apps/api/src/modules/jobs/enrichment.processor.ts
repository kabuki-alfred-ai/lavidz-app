import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { EnrichmentJobData } from '@lavidz/types'
import { EnrichmentService } from '../ai/services/enrichment.service'

@Processor('enrichment', { concurrency: 2 })
export class EnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichmentProcessor.name)

  constructor(private readonly enrichmentService: EnrichmentService) {
    super()
  }

  async process(job: Job<EnrichmentJobData>): Promise<void> {
    const { sessionId, profileId } = job.data
    this.logger.log(`Traitement du job d'enrichissement pour la session ${sessionId}`)

    try {
      await this.enrichmentService.enrichFromSession(sessionId, profileId)
      this.logger.log(`Job d'enrichissement terminé pour la session ${sessionId}`)
    } catch (error) {
      this.logger.error(`Échec du job d'enrichissement pour la session ${sessionId}`, error)
      throw error
    }
  }
}
