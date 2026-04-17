import { Controller, Get, Put, Post, Body, Headers, UseGuards, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common'
import { AdminGuard } from '../../guards/admin.guard'
import { BrandKitService } from './brand-kit.service'
import { UpdateBrandKitDto } from './dto/update-brand-kit.dto'

@Controller('brand-kit')
export class BrandKitController {
  constructor(private readonly brandKitService: BrandKitService) {}

  @UseGuards(AdminGuard)
  @Get()
  get(@Headers('x-organization-id') organizationId: string) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.brandKitService.getByOrganization(organizationId)
  }

  @UseGuards(AdminGuard)
  @Put()
  upsert(
    @Headers('x-organization-id') organizationId: string,
    @Body() dto: UpdateBrandKitDto,
  ) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.brandKitService.upsert(organizationId, dto)
  }

  @UseGuards(AdminGuard)
  @Post('import-from-url')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  importFromUrl(@Headers('x-organization-id') organizationId: string, @Body() body: { url: string }) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return { message: 'Not implemented yet', url: body.url }
  }
}
