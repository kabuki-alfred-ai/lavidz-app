import type { ContentFormat } from '@lavidz/types'
export type { ContentFormat }
export type FormatKind = 'histoire' | 'reaction' | 'interview' | 'conseil' | 'mythe' | 'guide'
export type FlowPhase = 'home' | 'clarifying' | 'proposal' | 'later' | 'rework' | 'launcher'
export type RecordState = 'idle' | 'recording' | 'transcribing' | 'done'
export type InputMode = 'voice' | 'text'

export interface KabouProposal {
  sujet: string
  mood: 'challenger' | 'authentique' | 'expert'
  moodLabel: string
  contentFormat: ContentFormat
  formatKind: FormatKind
  duration: string
  beatLabels: string[]
  beats: string[]
  coachingTip: string
}

export interface ThreadPreview {
  threadId: string
  preview: string
  lastAt: string
  messageCount: number
}
