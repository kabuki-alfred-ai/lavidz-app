import { Module } from '@nestjs/common'
import { BrandKitController } from './brand-kit.controller'
import { BrandKitService } from './brand-kit.service'

@Module({
  controllers: [BrandKitController],
  providers: [BrandKitService],
  exports: [BrandKitService],
})
export class BrandKitModule {}
