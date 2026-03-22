export interface ThemeDto {
  id: string
  name: string
  slug: string
  description: string | null
  active: boolean
  order: number
  brandName: string | null
  brandColor: string | null
  logoUrl: string | null
  questions: QuestionDto[]
  createdAt: string
  updatedAt: string
}

export interface QuestionDto {
  id: string
  themeId: string
  text: string
  hint: string | null
  order: number
  active: boolean
}

export interface SessionDto {
  id: string
  themeId: string
  theme: ThemeDto
  status: SessionStatus
  createdAt: string
}

export interface RecordingDto {
  id: string
  sessionId: string
  questionId: string
  rawVideoKey: string | null
  finalVideoKey: string | null
  transcript: string | null
  status: RecordingStatus
}

export type SessionStatus = 'PENDING' | 'RECORDING' | 'PROCESSING' | 'DONE' | 'FAILED'
export type RecordingStatus = 'PENDING' | 'TRANSCRIBING' | 'DONE' | 'FAILED'

export interface CreateThemeDto {
  name: string
  slug: string
  description?: string
  order?: number
}

export interface CreateQuestionDto {
  themeId: string
  text: string
  hint?: string
  order: number
}

export interface TranscriptionJobData {
  recordingId: string
  audioKey: string
}
