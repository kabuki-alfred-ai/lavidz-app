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
  /** Context-aware emoji moments: emoji shown above subtitles during a time range based on thematic context */
  contextEmojis?: { startInSeconds: number; endInSeconds: number; emoji: string }[]
  /** Use Google Noto Animated Emoji (GIF) instead of static emoji — default true */
  animatedEmojis?: boolean
}

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  enabled: true,
  style: 'hormozi',
  size: 64,
  position: 75,
  wordsPerLine: 3,
  offsetMs: 0,
}
