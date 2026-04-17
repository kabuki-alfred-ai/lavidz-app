import { IsString, IsEnum, IsUrl, IsOptional, IsArray, IsNumber } from 'class-validator'

export enum BRollSource {
  USER = 'USER',
  PEXELS = 'PEXELS',
  UNSPLASH = 'UNSPLASH',
}

export class CreateBRollDto {
  @IsEnum(BRollSource)
  source!: BRollSource

  @IsUrl()
  url!: string

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsNumber()
  duration?: number

  @IsOptional()
  @IsString()
  title?: string
}
