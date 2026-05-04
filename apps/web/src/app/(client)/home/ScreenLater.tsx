'use client'

import { T, FULL_H, TOP_SAFE } from './constants'
import { FormatBadge } from './KabouAvatar'
import type { KabouProposal } from './types'

export function ScreenLater({ proposal, onGoToSujets, onBrainstorm, onGoToUnivers }: {
  proposal: KabouProposal
  onGoToSujets: () => void
  onBrainstorm: () => void
  onGoToUnivers: () => void
}) {
  return (
    <div style={{ background: T.bg, minHeight: FULL_H, display: 'flex', flexDirection: 'column', paddingTop: TOP_SAFE, paddingLeft: 22, paddingRight: 22, paddingBottom: 24, boxSizing: 'border-box' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', background: '#FFF7F0',
          border: `2px solid ${T.primary}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'pop 0.4s',
        }}>
          <span style={{ fontSize: 36 }}>📌</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.ink, margin: 0, lineHeight: 1.2, letterSpacing: -0.5 }}>
          Mis dans ta file de tournage.
        </h1>
        <p style={{ fontSize: 15, color: T.muted, margin: 0, lineHeight: 1.55, maxWidth: 280 }}>
          Tu retrouveras ce sujet — script, coaching et tout — dans <b style={{ color: T.ink }}>Mes sujets</b> quand tu seras prêt à tourner.
        </p>

        <div style={{
          marginTop: 8, background: T.surface, borderRadius: 16, padding: 16,
          width: '100%', maxWidth: 300,
          display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left',
        }}>
          <FormatBadge kind={proposal.formatKind} />
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.35 }}>
            {proposal.sujet}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.warn, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.warn, display: 'inline-block' }} />
            En attente de tournage
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onGoToSujets}
        style={{
          background: T.primary, color: '#fff', border: 'none', borderRadius: 16,
          padding: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer',
          boxShadow: `0 8px 24px ${T.primary}40`,
        }}
      >
        Voir ma file →
      </button>
      <button
        type="button"
        onClick={onBrainstorm}
        style={{
          background: 'none', border: 'none', color: T.muted, fontSize: 13,
          padding: 12, marginTop: 4, cursor: 'pointer',
        }}
      >
        Continuer à brainstormer
      </button>
      <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 8, paddingTop: 14, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: T.muted, margin: '0 0 8px' }}>
          Plus Kabou te connaît, plus ses propositions seront précises.
        </p>
        <button
          type="button"
          onClick={onGoToUnivers}
          style={{ background: 'none', border: 'none', color: T.primary, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 4 }}
        >
          Enrichir mon Univers →
        </button>
      </div>
    </div>
  )
}
