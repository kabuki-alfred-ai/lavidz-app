import { Injectable } from '@nestjs/common'
import { prisma } from '@lavidz/database'
import { UpdateBrandKitDto } from './dto/update-brand-kit.dto'

@Injectable()
export class BrandKitService {
  async getByOrganization(organizationId: string): Promise<any> {
    return prisma.brandKit.findUnique({ where: { organizationId } })
  }

  async upsert(organizationId: string, data: UpdateBrandKitDto): Promise<any> {
    return prisma.brandKit.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    })
  }
}
