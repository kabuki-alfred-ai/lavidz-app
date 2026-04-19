export type SubtitleStyle =
  | 'hormozi' | 'minimal' | 'classic' | 'neon'
  | 'karaoke' | 'boxed' | 'outline' | 'tape' | 'glitch' | 'fire'

export interface SubtitleSettings {
  enabled: boolean
  style: SubtitleStyle
  size: number        // base font size in px (at 720p), e.g. 32–96
  position: number   // vertical % from top, 0–100
  wordsPerLine: number // 1–5 words shown at once
  offsetMs: number   // subtitle delay in ms, can be negative to advance
  /** Word-level emoji: emoji shown when a specific important word is active in subtitles */
  wordEmojis?: { word: string; emoji: string }[]
  /** Use Google Noto Animated Emoji (GIF) instead of static emoji — default true */
  animatedEmojis?: boolean
  /** Base (non-active) text color override. Falls back to each style's hardcoded default. */
  fontColor?: string
  /** Active/highlighted word color override (text or chip background, depending on style). */
  mainColor?: string
  /** Secondary accent override (box background, stroke, etc.). */
  secondColor?: string
  /** Tertiary accent override (gradient mid-color, shadow variant). */
  thirdColor?: string
}

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  enabled: true,
  style: 'hormozi',
  size: 64,
  position: 75,
  wordsPerLine: 3,
  offsetMs: 0,
}
