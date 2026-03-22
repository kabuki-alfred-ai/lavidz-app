import { IsString, IsOptional, IsInt, IsBoolean, Min } from 'class-validator'

export class CreateQuestionDto {
  @IsString()
  themeId!: string

  @IsString()
  text!: string

  @IsOptional()
  @IsString()
  hint?: string

  @IsInt()
  @Min(0)
  order!: number

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
