import { IsString, IsOptional, IsBoolean, IsInt, Min, Matches } from 'class-validator'

export class CreateThemeDto {
  @IsString()
  name!: string

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase with hyphens only' })
  slug!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsBoolean()
  active?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number
}
