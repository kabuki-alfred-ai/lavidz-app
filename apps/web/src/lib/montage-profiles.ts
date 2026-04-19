import type { ContentFormat } from '@lavidz/types'

export interface MontageProfile {
  label: string
  icon: string
  showQuestionCards: boolean
  showTTS: boolean
  showTransitions: boolean
  showBRolls: boolean
  showColdOpen: boolean
  showInlays: boolean
  subtitleStyle: 'standard' | 'animated'
  musicMood: 'light' | 'energetic' | 'upbeat' | 'crescendo' | 'suspense'
  autoCutMode: 'silence' | 'silence+filler' | 'aggressive'
  durationHint: string
  sidebarSections: SidebarSection[]
}

export type SidebarSection =
  | 'auto-cleanup'
  | 'voice-tts'
  | 'style-cards'
  | 'subtitles'
  | 'brolls'
  | 'music'
  | 'cold-open'
  | 'export'

const FULL_SECTIONS: SidebarSection[] = ['auto-cleanup', 'voice-tts', 'style-cards', 'subtitles', 'brolls', 'music', 'cold-open', 'export']
const MINIMAL_SECTIONS: SidebarSection[] = ['auto-cleanup', 'subtitles', 'music', 'export']

export const MONTAGE_PROFILES: Record<ContentFormat, MontageProfile> = {
  QUESTION_BOX: {
    label: 'Boite a questions',
    icon: '📦',
    showQuestionCards: true,
    showTTS: true,
    showTransitions: true,
    showBRolls: true,
    showColdOpen: true,
    showInlays: true,
    subtitleStyle: 'standard',
    musicMood: 'light',
    autoCutMode: 'silence+filler',
    durationHint: '60-90s',
    sidebarSections: FULL_SECTIONS,
  },
  TELEPROMPTER: {
    label: 'Teleprompter',
    icon: '🎤',
    showQuestionCards: false,
    showTTS: false,
    showTransitions: false,
    showBRolls: true,
    showColdOpen: true,
    showInlays: false,
    subtitleStyle: 'standard',
    musicMood: 'light',
    autoCutMode: 'silence',
    durationHint: '60-90s',
    sidebarSections: ['auto-cleanup', 'subtitles', 'brolls', 'music', 'cold-open', 'export'],
  },
  HOT_TAKE: {
    label: 'Take chaud',
    icon: '🔥',
    showQuestionCards: false,
    showTTS: false,
    showTransitions: false,
    showBRolls: false,
    showColdOpen: false,
    showInlays: false,
    subtitleStyle: 'animated',
    musicMood: 'energetic',
    autoCutMode: 'aggressive',
    durationHint: '30-45s',
    sidebarSections: MINIMAL_SECTIONS,
  },
  DAILY_TIP: {
    label: 'Conseil du jour',
    icon: '💡',
    showQuestionCards: false,
    showTTS: false,
    showTransitions: false,
    showBRolls: false,
    showColdOpen: true,
    showInlays: false,
    subtitleStyle: 'animated',
    musicMood: 'upbeat',
    autoCutMode: 'aggressive',
    durationHint: '30-45s',
    sidebarSections: ['auto-cleanup', 'subtitles', 'music', 'cold-open', 'export'],
  },
  STORYTELLING: {
    label: 'Storytelling',
    icon: '📖',
    showQuestionCards: true,
    showTTS: false,
    showTransitions: true,
    showBRolls: true,
    showColdOpen: true,
    showInlays: true,
    subtitleStyle: 'standard',
    musicMood: 'crescendo',
    autoCutMode: 'silence+filler',
    durationHint: '60-90s',
    sidebarSections: ['auto-cleanup', 'style-cards', 'subtitles', 'brolls', 'music', 'cold-open', 'export'],
  },
  MYTH_VS_REALITY: {
    label: 'Mythe vs Realite',
    icon: '🆚',
    showQuestionCards: true,
    showTTS: false,
    showTransitions: true,
    showBRolls: true,
    showColdOpen: true,
    showInlays: true,
    subtitleStyle: 'standard',
    musicMood: 'suspense',
    autoCutMode: 'silence+filler',
    durationHint: '45-75s',
    sidebarSections: ['auto-cleanup', 'style-cards', 'subtitles', 'brolls', 'music', 'cold-open', 'export'],
  },
}

export const MIXED_PROFILE: MontageProfile = {
  label: 'Projet mixte',
  icon: '🎬',
  showQuestionCards: true,
  showTTS: true,
  showTransitions: true,
  showBRolls: true,
  showColdOpen: true,
  showInlays: true,
  subtitleStyle: 'standard',
  musicMood: 'light',
  autoCutMode: 'silence+filler',
  durationHint: 'variable',
  sidebarSections: FULL_SECTIONS,
}

export const DEFAULT_PROFILE: MontageProfile = MONTAGE_PROFILES.QUESTION_BOX

export function getMontageProfile(format?: string | null): MontageProfile {
  if (!format) return DEFAULT_PROFILE
  if (format === 'MIXED') return MIXED_PROFILE
  return MONTAGE_PROFILES[format as ContentFormat] ?? DEFAULT_PROFILE
}
