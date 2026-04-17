export interface ThemeDto {
  id: string
  name: string
  slug: string
  description: string | null
  introduction: string | null
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

export type RecordingMode = 'questions' | 'teleprompter' | 'freeform'

export interface SessionDto {
  id: string
  themeId: string
  theme: ThemeDto
  status: SessionStatus
  contentFormat?: ContentFormat | null
  targetPlatforms?: string[]
  teleprompterScript?: string | null
  createdAt: string
}

export type PromptMode = 'script' | 'keypoints' | 'none'

export interface FormatConfig {
  id: ContentFormat
  label: string
  description: string
  icon: string
  recordingMode: RecordingMode
  promptMode: PromptMode
  defaultDurationSec: number
  maxQuestions: number
  hasTTS: boolean
  hasTeleprompter: boolean
}

export const FORMAT_CONFIGS: Record<ContentFormat, FormatConfig> = {
  QUESTION_BOX: {
    id: 'QUESTION_BOX',
    label: 'Boite a questions',
    description: "L'IA pose des questions, tu reponds naturellement",
    icon: '📦',
    recordingMode: 'questions',
    promptMode: 'none',
    defaultDurationSec: 60,
    maxQuestions: 5,
    hasTTS: true,
    hasTeleprompter: false,
  },
  TELEPROMPTER: {
    id: 'TELEPROMPTER',
    label: 'Teleprompter',
    description: "Points cles generes par l'IA pour te guider",
    icon: '🎤',
    recordingMode: 'teleprompter',
    promptMode: 'keypoints',
    defaultDurationSec: 90,
    maxQuestions: 1,
    hasTTS: false,
    hasTeleprompter: true,
  },
  HOT_TAKE: {
    id: 'HOT_TAKE',
    label: 'Take chaud',
    description: 'Reagis a un sujet trending en 60s',
    icon: '🔥',
    recordingMode: 'freeform',
    promptMode: 'none',
    defaultDurationSec: 45,
    maxQuestions: 3,
    hasTTS: false,
    hasTeleprompter: false,
  },
  STORYTELLING: {
    id: 'STORYTELLING',
    label: 'Storytelling',
    description: 'Raconte une histoire en 3 actes',
    icon: '📖',
    recordingMode: 'questions',
    promptMode: 'none',
    defaultDurationSec: 90,
    maxQuestions: 3,
    hasTTS: true,
    hasTeleprompter: false,
  },
  DAILY_TIP: {
    id: 'DAILY_TIP',
    label: 'Conseil du jour',
    description: 'Un tip actionnable en 30-45 secondes',
    icon: '💡',
    recordingMode: 'freeform',
    promptMode: 'none',
    defaultDurationSec: 35,
    maxQuestions: 2,
    hasTTS: false,
    hasTeleprompter: false,
  },
  MYTH_VS_REALITY: {
    id: 'MYTH_VS_REALITY',
    label: 'Mythe vs Realite',
    description: '"On croit que X... en fait Y"',
    icon: '🆚',
    recordingMode: 'questions',
    promptMode: 'none',
    defaultDurationSec: 60,
    maxQuestions: 4,
    hasTTS: true,
    hasTeleprompter: false,
  },
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

export type SoundTag = 'TRANSITION' | 'INTRO' | 'OUTRO' | 'BACKGROUND'

export interface SoundAssetDto {
  id: string
  name: string
  tag: SoundTag
  fileKey: string
  signedUrl?: string
  createdAt: string
}

export interface FeedbackDto {
  id: string
  sessionId: string
  overallRating: number
  questionRating: number
  comment: string | null
  createdAt: string
  session?: {
    recipientName?: string | null
    recipientEmail?: string | null
    theme?: { name: string } | null
  }
}

export interface CreateFeedbackDto {
  sessionId: string
  overallRating: number
  questionRating: number
  comment?: string
}

export interface TranscriptionJobData {
  recordingId: string
  audioKey: string
}

export interface EnrichmentJobData {
  sessionId: string
  profileId: string
}

// ============================================
// Personal Branding V1 — New Types
// ============================================

export type VoiceTone = 'PROFESSIONAL' | 'CASUAL' | 'EXPERT' | 'ENERGETIC' | 'INSPIRATIONAL'

export interface BrandKitDto {
  id: string
  organizationId: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontTitle: string
  fontBody: string
  logoUrl: string | null
  introVideoUrl: string | null
  outroVideoUrl: string | null
  watermark: { position: string; opacity: number; size: number } | null
  voiceTone: VoiceTone
  createdAt: string
  updatedAt: string
}

export interface CreateBrandKitDto {
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  fontTitle?: string
  fontBody?: string
  logoUrl?: string
  introVideoUrl?: string
  outroVideoUrl?: string
  watermark?: { position: string; opacity: number; size: number }
  voiceTone?: VoiceTone
}

export interface UpdateBrandKitDto extends Partial<CreateBrandKitDto> {}

export type BRollSource = 'USER' | 'PEXELS' | 'UNSPLASH'

export interface BRollDto {
  id: string
  organizationId: string
  source: BRollSource
  url: string
  thumbnailUrl: string | null
  tags: string[]
  duration: number | null
  title: string | null
  createdAt: string
}

export type ContentFormat = 'QUESTION_BOX' | 'TELEPROMPTER' | 'HOT_TAKE' | 'STORYTELLING' | 'DAILY_TIP' | 'MYTH_VS_REALITY'

export type ContentCalendarStatus = 'PLANNED' | 'RECORDED' | 'EDITING' | 'DELIVERED' | 'PUBLISHED' | 'SKIPPED'

export interface ContentCalendarDto {
  id: string
  organizationId: string
  scheduledDate: string
  topic: string
  description: string | null
  format: ContentFormat
  platforms: string[]
  status: ContentCalendarStatus
  sessionId: string | null
  aiSuggestions: {
    hook?: string
    questions?: string[]
    script?: string
    angle?: string
  } | null
  createdAt: string
}

export interface CreateContentCalendarDto {
  scheduledDate: string
  topic: string
  description?: string
  format: ContentFormat
  platforms: string[]
}

export type CompositionStatus = 'DRAFT' | 'RENDERING' | 'DONE' | 'FAILED'

export interface CompositionDto {
  id: string
  organizationId: string
  sessionId: string | null
  title: string | null
  platform: string | null
  aspectRatio: string
  status: CompositionStatus
  outputUrl: string | null
  createdAt: string
}
