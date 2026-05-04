import type { FormatKind, ContentFormat } from './types'

// Can't use h-full inside overflow-y-auto — use dvh minus nav + safe area.
export const FULL_H = 'calc(100dvh - var(--nav-height, 64px) - env(safe-area-inset-bottom, 0px))'
// Top padding: clears status bar + Dynamic Island + breathing room
export const TOP_SAFE = 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))'

export const T = {
  bg:      '#FAFAF7',
  surface: '#FFFFFF',
  ink:     '#0A0A0A',
  muted:   '#737373',
  primary: '#FF6B2E',
  border:  'rgba(0,0,0,0.08)',
  good:    '#22c55e',
  warn:    '#F59E0B',
}

export const FORMAT_META: Record<FormatKind, { label: string; emoji: string; bg: string; color: string }> = {
  histoire:  { label: 'Histoire',         emoji: '📖', bg: '#FEF3C7', color: '#92400E' },
  reaction:  { label: 'Réaction',         emoji: '🔥', bg: '#FEF2F2', color: '#DC2626' },
  interview: { label: 'Interview',        emoji: '❓', bg: '#EDE9FE', color: '#6D28D9' },
  conseil:   { label: 'Conseil',          emoji: '💡', bg: '#DCFCE7', color: '#15803D' },
  mythe:     { label: 'Mythe vs Réalité', emoji: '🪞', bg: '#DBEAFE', color: '#1E40AF' },
  guide:     { label: 'Guide',            emoji: '📜', bg: '#FCE7F3', color: '#9D174D' },
}

export const CONTENT_FORMAT_MAP: Record<FormatKind, ContentFormat> = {
  histoire:  'STORYTELLING',
  reaction:  'HOT_TAKE',
  interview: 'QUESTION_BOX',
  conseil:   'DAILY_TIP',
  mythe:     'MYTH_VS_REALITY',
  guide:     'TELEPROMPTER',
}

export const REWORK_CHIPS = [
  'Trop long', 'Pas mon ton', 'Format différent', 'Angle plus tranchant', 'Autre',
]
