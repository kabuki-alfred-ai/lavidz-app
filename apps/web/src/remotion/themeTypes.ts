export interface WordTimestamp {
  word: string
  start: number  // seconds
  end: number    // seconds
}

export type TransitionStyle = 'none' | 'zoom-punch' | 'slide-up' | 'flash' | 'wipe-right' | 'spin-scale' | 'glitch-cut' | 'blur-in' | 'shake'

export type QuestionCardStyle = 'default' | 'flash-word' | 'brut' | 'split-color' | 'typewriter' | 'cinematic' | 'pop-art' | 'word-slam' | 'kinetic' | 'neon-pulse'

export interface LowerThirdSettings {
  name: string
  title?: string
}

export interface SfxTrack {
  prompt: string
  url: string
  volume: number
}

export interface AudioSettings {
  bgMusic?: SfxTrack
  transitionSfx?: SfxTrack
  introSfx?: SfxTrack
  outroSfx?: SfxTrack
  ttsVolume?: number  // volume of the TTS voice (0–2), default 1
}

export interface MotionSettings {
  transitionStyle: TransitionStyle
  wordPop: boolean
  progressBar: boolean
  kenBurns: boolean
  questionCardStyle?: QuestionCardStyle
  questionCardTransition?: TransitionStyle
  questionCardBgPattern?: SlideBgPattern
  lowerThird?: LowerThirdSettings
  questionCardColors?: string[]
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

export type SlideBgPattern = 'solid' | 'dots' | 'grid' | 'diagonal' | 'radial' | 'noise' | 'confetti' | 'stripes' | 'scanlines' | 'gradient-sweep' | 'aurora' | 'halftone' | 'vhs' | 'plasma' | 'synthwave' | 'burst' | 'liquid' | 'eq'
export type SlideTextAnimation = 'spring-up' | 'flash' | 'typewriter' | 'word-stack' | 'zoom-blast' | 'glitch' | 'scramble' | 'letter-stack' | 'highlight' | 'flip-3d' | 'neon-flicker' | 'blur-reveal' | 'stamp' | 'wave' | 'cascade' | 'split-reveal'

export type SlideDecorator = 'none' | 'ticker' | 'frame-border' | 'corner-label'
export type SlidePreset = 'konbini' | 'brut' | 'magazine' | 'neon' | 'viral' | 'minimal' | 'cinema' | 'retro' | 'editorial' | 'custom'

export interface IntroSettings {
  enabled: boolean
  hookText: string
  logoUrl: string
  durationSeconds: number
  bgColor?: string            // overrides theme.backgroundColor
  accentColor?: string        // color for pattern + decorative elements, default '#FFFFFF'
  bgPattern?: SlideBgPattern  // default 'solid'
  textAnimation?: SlideTextAnimation // default 'spring-up'
  textSize?: number           // px, default 72
  logoSize?: number           // px height, default 64
  preset?: SlidePreset
  decorator?: SlideDecorator
  decoratorText?: string
  fontFamily?: string
  fontWeight?: number
}

export const FONT_OPTIONS = [
  // System / classic
  { label: 'Impact',            value: "Impact, 'Arial Narrow', sans-serif",         weight: 400 },
  { label: 'Arial Black',       value: "'Arial Black', Gadget, sans-serif",           weight: 400 },
  { label: 'Georgia',           value: "Georgia, 'Times New Roman', serif",           weight: 700 },
  { label: 'Courier',           value: "'Courier New', Courier, monospace",           weight: 700 },
  { label: 'Trebuchet',         value: "'Trebuchet MS', Helvetica, sans-serif",       weight: 700 },
  // Google — condensed / display
  { label: 'Anton',             value: "'Anton', Impact, sans-serif",                  weight: 400 },
  { label: 'Bebas Neue',        value: "'Bebas Neue', Impact, sans-serif",             weight: 400 },
  { label: 'Oswald',            value: "'Oswald', Arial, sans-serif",                  weight: 700 },
  { label: 'Barlow Condensed',  value: "'Barlow Condensed', Arial, sans-serif",        weight: 900 },
  { label: 'Teko',              value: "'Teko', Arial, sans-serif",                    weight: 700 },
  // Google — modern sans
  { label: 'Syne',              value: "'Syne', sans-serif",                           weight: 800 },
  { label: 'Space Grotesk',     value: "'Space Grotesk', system-ui, sans-serif",       weight: 700 },
  { label: 'DM Sans',           value: "'DM Sans', system-ui, sans-serif",             weight: 700 },
  { label: 'Raleway',           value: "'Raleway', sans-serif",                        weight: 900 },
  // Google — serif / editorial
  { label: 'Playfair Display',  value: "'Playfair Display', Georgia, serif",           weight: 900 },
  // Google — handwriting / personality
  { label: 'Permanent Marker',  value: "'Permanent Marker', cursive",                  weight: 400 },
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
  bgColor: undefined,
  accentColor: undefined,
  bgPattern: 'solid',
  textAnimation: 'spring-up',
  textSize: 72,
  logoSize: 64,
  preset: 'custom',
  decorator: 'none',
  decoratorText: '',
}

export interface OutroSettings {
  enabled: boolean
  ctaText: string       // e.g. "Abonne-toi pour plus 🔥"
  subText: string       // e.g. "@handle" or secondary CTA
  logoUrl: string
  durationSeconds: number
  bgColor?: string            // overrides theme.backgroundColor
  accentColor?: string        // color for pattern + decorative elements, default '#FFFFFF'
  bgPattern?: SlideBgPattern  // default 'solid'
  textAnimation?: SlideTextAnimation // default 'spring-up'
  textSize?: number           // px, default 68
  logoSize?: number           // px height, default 56
  preset?: SlidePreset
  decorator?: SlideDecorator
  decoratorText?: string
  fontFamily?: string
  fontWeight?: number
}

export const DEFAULT_OUTRO_SETTINGS: OutroSettings = {
  enabled: false,
  ctaText: '',
  subText: '',
  logoUrl: '',
  durationSeconds: 3,
  bgColor: undefined,
  accentColor: undefined,
  bgPattern: 'solid',
  textAnimation: 'spring-up',
  textSize: 68,
  logoSize: 56,
  preset: 'custom',
  decorator: 'none',
  decoratorText: '',
}

export const SLIDE_PRESETS: Record<Exclude<SlidePreset, 'custom'>, {
  bgColor: string; accentColor: string; bgPattern: SlideBgPattern
  textAnimation: SlideTextAnimation; textSize: number; logoSize: number
  decorator: SlideDecorator
}> = {
  konbini:  { bgColor: '#FF2D55', accentColor: '#FFD60A', bgPattern: 'confetti',       textAnimation: 'flash',        textSize: 90, logoSize: 72, decorator: 'ticker' },
  brut:     { bgColor: '#000000', accentColor: '#FFFFFF', bgPattern: 'noise',           textAnimation: 'letter-stack', textSize: 80, logoSize: 64, decorator: 'frame-border' },
  magazine: { bgColor: '#F5F0E8', accentColor: '#1A1209', bgPattern: 'solid',           textAnimation: 'highlight',    textSize: 62, logoSize: 56, decorator: 'corner-label' },
  neon:     { bgColor: '#0D0D0D', accentColor: '#00FF88', bgPattern: 'scanlines',       textAnimation: 'glitch',       textSize: 80, logoSize: 64, decorator: 'ticker' },
  viral:    { bgColor: '#FF6B00', accentColor: '#FFFFFF', bgPattern: 'stripes',         textAnimation: 'zoom-blast',   textSize: 88, logoSize: 72, decorator: 'none' },
  minimal:  { bgColor: '#FFFFFF', accentColor: '#0A0A0A', bgPattern: 'solid',           textAnimation: 'spring-up',    textSize: 56, logoSize: 48, decorator: 'none' },
  cinema:   { bgColor: '#0A0A0A', accentColor: '#D4AF37', bgPattern: 'aurora',    textAnimation: 'blur-reveal',   textSize: 74, logoSize: 60, decorator: 'frame-border' },
  retro:    { bgColor: '#1A0A2E', accentColor: '#FF6EFF', bgPattern: 'vhs',       textAnimation: 'neon-flicker',  textSize: 82, logoSize: 64, decorator: 'ticker' },
  editorial:{ bgColor: '#FAFAFA', accentColor: '#111111', bgPattern: 'halftone',  textAnimation: 'stamp',         textSize: 78, logoSize: 56, decorator: 'corner-label' },
}
