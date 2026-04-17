import { PartialType } from '@nestjs/mapped-types'
import { CreateContentCalendarDto } from './create-content-calendar.dto'

export class UpdateContentCalendarDto extends PartialType(CreateContentCalendarDto) {}
