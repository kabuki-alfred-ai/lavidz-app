import { IsEnum, IsHexColor, IsObject, IsOptional, IsString, IsUrl } from 'class-validator'

export enum VoiceTone {
  PROFESSIONAL = 'PROFESSIONAL',
  CASUAL = 'CASUAL',
  EXPERT = 'EXPERT',
  ENERGETIC = 'ENERGETIC',
  INSPIRATIONAL = 'INSPIRATIONAL',
}

export class UpdateBrandKitDto {
  @IsOptional()
  @IsHexColor()
  primaryColor?: string

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string

  @IsOptional()
  @IsHexColor()
  accentColor?: string

  @IsOptional()
  @IsString()
  fontTitle?: string

  @IsOptional()
  @IsString()
  fontBody?: string

  @IsOptional()
  @IsUrl()
  logoUrl?: string

  @IsOptional()
  @IsUrl()
  introVideoUrl?: string

  @IsOptional()
  @IsUrl()
  outroVideoUrl?: string

  @IsOptional()
  @IsObject()
  watermark?: Record<string, any>

  @IsOptional()
  @IsEnum(VoiceTone)
  voiceTone?: VoiceTone
}
