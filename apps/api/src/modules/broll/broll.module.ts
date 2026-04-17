import { Module } from '@nestjs/common'
import { BRollController } from './broll.controller'
import { BRollService } from './broll.service'

@Module({
  controllers: [BRollController],
  providers: [BRollService],
})
export class BRollModule {}
