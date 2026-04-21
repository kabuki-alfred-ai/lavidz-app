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

  /**
   * Target publication date (FIX F2 — sémantique claire).
   * Nullable: only set when user explicitly schedules a publication.
   * For record-now flows, publishAt = null (tournage is not a publication event).
   */
  @IsOptional()
  @IsDateString()
  publishAt?: string

  // One of `topicId` (preferred) or `topic` (name, find-or-create) must be provided.
  @IsOptional()
  @IsString()
  topicId?: string

  @IsOptional()
  @IsString()
  topic?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(ContentFormat)
  format!: ContentFormat

  @IsArray()
  @IsString({ each: true })
  platforms!: string[]
}
