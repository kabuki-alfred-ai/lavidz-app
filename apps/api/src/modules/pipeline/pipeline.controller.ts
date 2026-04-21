import { BadRequestException, Controller, Get, Headers, UseGuards } from '@nestjs/common'
import { AdminGuard } from '../../guards/admin.guard'
import { PipelineService, type PipelineResponse } from './pipeline.service'

@Controller('pipeline')
@UseGuards(AdminGuard)
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get()
  async getPipeline(
    @Headers('x-organization-id') organizationId: string,
  ): Promise<PipelineResponse> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.pipelineService.getPipeline(organizationId)
  }
}
