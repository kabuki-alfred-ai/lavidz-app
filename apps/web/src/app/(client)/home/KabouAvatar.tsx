'use client'

import { T, FORMAT_META } from './constants'
import type { FormatKind } from './types'

export function KabouAvatar({ size = 32, ring = false }: { size?: number; ring?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      background: T.surface, flexShrink: 0,
      boxShadow: ring ? `0 0 0 4px ${T.primary}25` : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lavi-robot.png" alt="Kabou" style={{ width: '78%', height: '78%', objectFit: 'contain' }} />
    </div>
  )
}

export function MicSVG({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 18 20" fill="none">
      <rect x="6" y="2" width="6" height="11" rx="3" fill={color} />
      <path d="M2 11a7 7 0 0014 0M9 18v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function FormatBadge({ kind, size = 'sm' }: { kind: FormatKind; size?: 'sm' | 'md' }) {
  const meta = FORMAT_META[kind]
  const padding = size === 'md' ? '6px 12px' : '4px 9px'
  const fs = size === 'md' ? 13 : 11
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding, borderRadius: 999, background: meta.bg, color: meta.color,
      fontSize: fs, fontWeight: 600, letterSpacing: 0.1,
    }}>
      <span>{meta.emoji}</span>{meta.label}
    </span>
  )
}
