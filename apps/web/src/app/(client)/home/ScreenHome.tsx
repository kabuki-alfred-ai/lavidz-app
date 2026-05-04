'use client'

import { Clock } from 'lucide-react'
import { T, FULL_H, TOP_SAFE } from './constants'
import { KabouAvatar, MicSVG } from './KabouAvatar'

export function ScreenHome({ onTalk, onWrite, onShowHistory }: {
  onTalk: () => void
  onWrite: () => void
  onShowHistory: () => void
}) {
  return (
    <div style={{ background: T.bg, minHeight: FULL_H, display: 'flex', flexDirection: 'column', paddingTop: TOP_SAFE, paddingLeft: 22, paddingRight: 22, paddingBottom: 28, boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <KabouAvatar size={44} ring />
        <div style={{ paddingTop: 6, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>Kabou</div>
          <div style={{ fontSize: 11, color: T.good, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.good, display: 'inline-block' }} />
            à l'écoute
          </div>
        </div>
        <button
          type="button"
          onClick={onShowHistory}
          style={{
            background: 'rgba(0,0,0,0.05)', borderRadius: 14,
            width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: T.muted, flexShrink: 0, border: 'none',
          }}
          title="Historique des conversations"
        >
          <Clock size={20} />
        </button>
      </div>

      <h1 style={{
        fontSize: 30, fontWeight: 700, color: T.ink,
        lineHeight: 1.15, margin: '20px 0 0', letterSpacing: -0.6,
      }}>
        Sur quoi tu veux<br />
        <span style={{ color: T.muted, fontWeight: 400 }}>tourner </span>
        aujourd'hui&nbsp;?
      </h1>
      <p style={{ fontSize: 14, color: T.muted, marginTop: 14, lineHeight: 1.55 }}>
        Une anecdote client, une opinion forte, un conseil — choisis-en une.
      </p>

      <div style={{ flex: 1 }} />

      {/* Big mic CTA */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <button
          type="button"
          onClick={onTalk}
          style={{
            width: 132, height: 132, borderRadius: '50%',
            background: T.primary, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 0 12px ${T.primary}1F, 0 0 0 24px ${T.primary}0E, 0 16px 40px ${T.primary}66`,
          }}
        >
          <MicSVG size={42} />
        </button>
        <div style={{ fontSize: 13, color: T.ink, fontWeight: 600, letterSpacing: 0.3 }}>
          APPUIE · PARLE À KABOU
        </div>
      </div>

      <button
        type="button"
        onClick={onWrite}
        style={{
          background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 16,
          padding: '16px 20px', fontSize: 14, color: T.muted, fontWeight: 600, cursor: 'pointer',
          minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        ⌨ Préférer écrire
      </button>
    </div>
  )
}
