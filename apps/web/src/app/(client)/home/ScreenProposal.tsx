'use client'

import { Loader2 } from 'lucide-react'
import { T, FULL_H, TOP_SAFE } from './constants'
import { KabouAvatar, FormatBadge } from './KabouAvatar'
import type { KabouProposal } from './types'

export function ScreenProposal({
  proposal, saving, error,
  onAccept, onLater, onRework, onDeepen,
}: {
  proposal: KabouProposal
  saving: boolean
  error: string | null
  onAccept: () => void
  onLater: () => void
  onRework: () => void
  onDeepen: () => void
}) {
  return (
    <div style={{ background: T.bg, minHeight: FULL_H, display: 'flex', flexDirection: 'column', paddingTop: TOP_SAFE, paddingLeft: 18, paddingRight: 18, paddingBottom: 14, boxSizing: 'border-box' }}>
      {/* Top */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <KabouAvatar size={28} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>Kabou</div>
          <div style={{ fontSize: 11, color: T.muted }}>voilà ce que je te propose</div>
        </div>
      </div>

      {/* Proposal card */}
      <div style={{
        background: T.surface, borderRadius: 22, overflow: 'hidden',
        animation: 'slideUp 0.4s',
      }}>
        {/* Header band */}
        <div style={{ background: T.ink, padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999, background: 'rgba(252,165,165,0.15)',
            color: '#FCA5A5', fontSize: 11, fontWeight: 600,
          }}>
            {proposal.moodLabel}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, letterSpacing: 0.4 }}>
            {proposal.duration} · LinkedIn
          </span>
        </div>

        <div style={{ padding: 18 }}>
          <FormatBadge kind={proposal.formatKind} size="md" />

          <h2 style={{
            fontSize: 20, fontWeight: 700, color: T.ink, margin: '12px 0 0',
            lineHeight: 1.22, letterSpacing: -0.4,
          }}>
            {proposal.sujet}
          </h2>

          {/* Script de poche */}
          <div style={{
            marginTop: 16, padding: 14, background: T.bg, borderRadius: 14,
          }}>
            <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 10 }}>
              Script de poche · 3 beats
            </div>
            <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {proposal.beats.map((beat, i) => (
                <li key={i} style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
                  <b>{proposal.beatLabels[i]}</b> — {beat}
                </li>
              ))}
            </ol>
          </div>

          {/* Coaching tip */}
          <div style={{
            marginTop: 12, padding: '12px 14px', background: '#FFF7F0', borderRadius: 12,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 16 }}>🎯</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#E2541A', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 3 }}>
                Coaching Kabou
              </div>
              <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.45, fontWeight: 500 }}>
                {proposal.coachingTip}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* CTAs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
            padding: '10px 14px', fontSize: 13, color: '#DC2626', fontWeight: 500,
          }}>
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={onAccept}
          disabled={saving}
          style={{
            background: T.primary, color: '#fff', border: 'none', borderRadius: 16,
            padding: 17, fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 10px 28px ${T.primary}50`, letterSpacing: -0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <span>▶</span>}
          On tourne maintenant
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onLater}
            disabled={saving}
            style={{
              flex: 1, background: 'rgba(0,0,0,0.05)', color: T.ink, border: 'none',
              borderRadius: 16, padding: '18px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              minHeight: 56,
            }}
          >
            📌 Plus tard
          </button>
          <button
            type="button"
            onClick={onRework}
            style={{
              flex: 1, background: 'rgba(0,0,0,0.05)', color: T.ink, border: 'none',
              borderRadius: 16, padding: '18px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              minHeight: 56,
            }}
          >
            ↺ Retravailler
          </button>
        </div>
        <button
          type="button"
          onClick={onDeepen}
          style={{
            background: 'transparent', color: T.primary,
            border: `2px solid ${T.primary}`, borderRadius: 16,
            padding: '15px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            minHeight: 56,
          }}
        >
          ✨ Approfondir (3 questions)
        </button>
      </div>
    </div>
  )
}
