'use client'

import { useState } from 'react'
import { T, FULL_H, TOP_SAFE, REWORK_CHIPS } from './constants'
import { KabouAvatar } from './KabouAvatar'

export function ScreenRework({ isBusy, onChip, onBack }: {
  isBusy: boolean
  onChip: (text: string) => void
  onBack: () => void
}) {
  const [textInput, setTextInput] = useState('')
  return (
    <div style={{ background: T.bg, minHeight: FULL_H, display: 'flex', flexDirection: 'column', paddingTop: TOP_SAFE, paddingLeft: 18, paddingRight: 18, paddingBottom: 18, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottom: `1px solid ${T.border}`, marginBottom: 16 }}>
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: 22, color: T.ink, cursor: 'pointer' }}
        >‹</button>
        <KabouAvatar size={30} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Kabou</div>
          <div style={{ fontSize: 11, color: T.primary, fontWeight: 600 }}>on retravaille</div>
        </div>
      </div>

      {/* Kabou question */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <KabouAvatar size={26} />
        <div style={{
          background: T.surface, padding: '12px 16px',
          borderRadius: '20px 20px 20px 4px', fontSize: 14, lineHeight: 1.5, color: T.ink,
          fontWeight: 500,
        }}>
          OK, dis-moi : qu'est-ce qui ne va pas ? Le format, le ton, l'angle ?
        </div>
      </div>

      {/* Quick chips */}
      <div style={{ marginLeft: 34, display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {REWORK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onChip(chip)}
            disabled={isBusy}
            style={{
              background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 999,
              padding: '11px 18px', fontSize: 13, fontWeight: 600, color: T.ink,
              cursor: 'pointer', opacity: isBusy ? 0.5 : 1, minHeight: 44,
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, background: T.surface, borderRadius: 16, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && textInput.trim()) {
                onChip(textInput.trim())
                setTextInput('')
              }
            }}
            placeholder="Ou écris ce que tu veux changer…"
            disabled={isBusy}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, color: T.ink,
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (textInput.trim()) {
              onChip(textInput.trim())
              setTextInput('')
            }
          }}
          disabled={!textInput.trim() || isBusy}
          style={{
            background: T.ink, color: '#fff', border: 'none', borderRadius: 16,
            padding: '0 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            opacity: !textInput.trim() || isBusy ? 0.5 : 1,
            minHeight: 52, minWidth: 80,
          }}
        >
          Voir →
        </button>
      </div>
    </div>
  )
}
