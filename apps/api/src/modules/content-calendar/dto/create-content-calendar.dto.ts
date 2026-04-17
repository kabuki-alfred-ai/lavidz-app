import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum, IsArray } from 'class-validator'

export enum ContentFormat {
  QUESTION_BOX = 'QUESTION_BOX',
  TELEPROMPTER = 'TELEPROMPTER',
  HOT_TAKE = 'HOT_TAKE',
  STORYTELLING = 'STORYTELLING',
  DAILY_TIP = 'DAILY_TIP',
  MYTH_VS_REALITY = 'MYTH_VS_REALITY',
}

export class CreateContentCalendarDto {
  @IsDateString()
  scheduledDate!: string

  @IsString()
  @IsNotEmpty()
  topic!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(ContentFormat)
  format!: ContentFormat

  @IsArray()
  @IsString({ each: true })
  platforms!: string[]
}
