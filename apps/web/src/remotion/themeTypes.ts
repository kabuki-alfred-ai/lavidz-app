export type TransitionStyle = 'none' | 'zoom-punch' | 'slide-up' | 'flash'

export interface LowerThirdSettings {
  name: string
  title?: string
}

export interface MotionSettings {
  transitionStyle: TransitionStyle
  wordPop: boolean
  progressBar: boolean
  kenBurns: boolean
  lowerThird?: LowerThirdSettings
}

export const DEFAULT_MOTION_SETTINGS: MotionSettings = {
  transitionStyle: 'zoom-punch',
  wordPop: false,
  progressBar: false,
  kenBurns: false,
}

export interface TransitionTheme {
  backgroundColor: string
  textColor: string
  fontFamily: string
  fontWeight: number
}

export interface IntroSettings {
  enabled: boolean
  hookText: string
  logoUrl: string
  durationSeconds: number
}

export const FONT_OPTIONS = [
  { label: 'Impact',      value: "Impact, 'Arial Narrow', sans-serif",       weight: 400 },
  { label: 'Syne',        value: "'Syne', sans-serif",                        weight: 800 },
  { label: 'Arial Black', value: "'Arial Black', Gadget, sans-serif",         weight: 400 },
  { label: 'Georgia',     value: "Georgia, 'Times New Roman', serif",         weight: 700 },
  { label: 'Courier',     value: "'Courier New', Courier, monospace",         weight: 700 },
  { label: 'Trebuchet',   value: "'Trebuchet MS', Helvetica, sans-serif",     weight: 700 },
] as const

export const THEME_PRESETS = [
  { label: 'Dark',      backgroundColor: '#07070A', textColor: '#FFFFFF' },
  { label: 'Light',     backgroundColor: '#F5F5F0', textColor: '#0A0A0A' },
  { label: 'Brand',     backgroundColor: '#FF4D1C', textColor: '#FFFFFF' },
  { label: 'Midnight',  backgroundColor: '#070B1A', textColor: '#FFFFFF' },
  { label: 'Cream',     backgroundColor: '#FAF6EE', textColor: '#1A1209' },
] as const

export const DEFAULT_TRANSITION_THEME: TransitionTheme = {
  backgroundColor: '#07070A',
  textColor: '#FFFFFF',
  fontFamily: "Impact, 'Arial Narrow', sans-serif",
  fontWeight: 400,
}

export const DEFAULT_INTRO_SETTINGS: IntroSettings = {
  enabled: false,
  hookText: '',
  logoUrl: '',
  durationSeconds: 3,
}
