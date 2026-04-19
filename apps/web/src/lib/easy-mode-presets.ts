import type { MotionSettings } from '@/remotion/themeTypes'
import type { SubtitleSettings } from '@/remotion/subtitleTypes'

export type EnergyLevel = 'zen' | 'dynamique' | 'punchy'

export interface EnergyPreset {
  label: string
  icon: string
  desc: string
  motionSettings: Partial<MotionSettings>
  subtitleOverrides: Partial<SubtitleSettings>
  silenceThreshold: number
  fillerCut: boolean
}

export const ENERGY_PRESETS: Record<EnergyLevel, EnergyPreset> = {
  zen: {
    label: 'Zen',
    icon: '🧘',
    desc: 'Transitions douces, rythme calme',
    motionSettings: {
      transitionStyle: 'none',
      wordPop: false,
      progressBar: false,
      kenBurns: true,
      dynamicZoom: false,
    },
    subtitleOverrides: {
      style: 'minimal',
      wordsPerLine: 4,
    },
    silenceThreshold: -40,
    fillerCut: false,
  },
  dynamique: {
    label: 'Dynamique',
    icon: '⚡',
    desc: 'Zoom, transitions, coupes serrees',
    motionSettings: {
      transitionStyle: 'slide-up',
      wordPop: true,
      progressBar: true,
      kenBurns: true,
      dynamicZoom: true,
    },
    subtitleOverrides: {
      style: 'hormozi',
      wordsPerLine: 3,
    },
    silenceThreshold: -30,
    fillerCut: true,
  },
  punchy: {
    label: 'Punchy',
    icon: '🔥',
    desc: 'Zoom agressif, glitch, shake',
    motionSettings: {
      transitionStyle: 'glitch-cut',
      wordPop: true,
      progressBar: true,
      kenBurns: true,
      dynamicZoom: true,
    },
    subtitleOverrides: {
      style: 'hormozi',
      wordsPerLine: 2,
    },
    silenceThreshold: -25,
    fillerCut: true,
  },
}

export const SUBTITLE_STYLE_OPTIONS = [
  { id: 'hormozi', label: 'Hormozi', icon: '💪' },
  { id: 'minimal', label: 'Minimal', icon: '✨' },
  { id: 'karaoke', label: 'Karaoke', icon: '🎤' },
  { id: 'boxed', label: 'Encadre', icon: '🔲' },
  { id: 'neon', label: 'Neon', icon: '💜' },
] as const

export const MUSIC_MOOD_OPTIONS = [
  { id: 'chill', label: 'Chill', icon: '☁️', tags: ['BACKGROUND'] },
  { id: 'upbeat', label: 'Energique', icon: '🎵', tags: ['BACKGROUND'] },
  { id: 'cinematic', label: 'Cinematique', icon: '🎬', tags: ['BACKGROUND'] },
  { id: 'none', label: 'Aucune', icon: '🔇', tags: [] },
] as const
