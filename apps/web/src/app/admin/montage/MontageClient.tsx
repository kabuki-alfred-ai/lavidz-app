'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ThemeDto } from '@lavidz/types'

interface SubmittedSession {
  id: string
  status: string
  recipientEmail?: string
  recipientName?: string
  finalVideoKey?: string
  submittedAt?: string
  deliveredAt?: string
  theme: { id: string; name: string; slug: string }
}

interface Props {
  themes: ThemeDto[]
  initialSessions: SubmittedSession[]
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: 'Soumise', color: '#f59e0b' },
  PROCESSING: { label: 'En cours', color: '#3b82f6' },
  DONE: { label: 'Envoyée', color: 'rgb(52,211,153)' },
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function MontageClient({ themes, initialSessions }: Props) {
  const [sessions, setSessions] = useState<SubmittedSession[]>(initialSessions)

  // Form state
  const [themeId, setThemeId] = useState(themes[0]?.id ?? '')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [creating, setCreating] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [createError, setCreateError] = useState('')

  // Deliver state
  const [delivering, setDelivering] = useState<string | null>(null)
  const [deliverSuccess, setDeliverSuccess] = useState<string | null>(null)
  const [deliverError, setDeliverError] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setShareUrl(null)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId, recipientEmail, recipientName: recipientName || undefined }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setShareUrl(data.shareUrl)
      setRecipientEmail('')
      setRecipientName('')
    } catch (err) {
      setCreateError(String(err))
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDeliver = async (sessionId: string) => {
    setDelivering(sessionId)
    setDeliverSuccess(null)
    setDeliverError(null)
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/deliver`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      setDeliverSuccess(sessionId)
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, status: 'DONE' } : s))
    } catch (err) {
      setDeliverError(String(err))
    } finally {
      setDelivering(null)
    }
  }

  return (
    <div className="max-w-4xl animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
      {/* Header */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
          Workflow
        </p>
        <h1 className="font-sans font-extrabold text-3xl text-foreground tracking-tight">
          Montage
        </h1>
      </div>

      {/* ── Create link section ── */}
      <section>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
          Créer un lien
        </p>
        <div className="border border-border p-6" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Theme */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Thème
                </label>
                <select
                  value={themeId}
                  onChange={(e) => setThemeId(e.target.value)}
                  required
                  className="text-xs font-mono bg-background border border-border text-foreground px-3 py-2 focus:outline-none focus:border-primary"
                >
                  {themes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Recipient name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Nom (optionnel)
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Marie Dupont"
                  className="text-xs font-mono bg-background border border-border text-foreground px-3 py-2 focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Email du destinataire
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="marie@example.com"
                required
                className="text-xs font-mono bg-background border border-border text-foreground px-3 py-2 focus:outline-none focus:border-primary placeholder:text-muted-foreground"
              />
            </div>

            {createError && (
              <p className="text-xs font-mono" style={{ color: '#f87171' }}>{createError}</p>
            )}

            <button
              type="submit"
              disabled={creating || themes.length === 0}
              className="self-start px-4 py-2 text-xs font-mono uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {creating ? 'Création...' : 'Créer le lien'}
            </button>
          </form>

          {/* Share URL */}
          {shareUrl && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                background: 'rgba(52,211,153,0.06)',
                border: '1px solid rgba(52,211,153,0.2)',
              }}
            >
              <code className="text-xs text-foreground flex-1 truncate">{shareUrl}</code>
              <button
                onClick={handleCopy}
                className="text-[10px] font-mono uppercase tracking-widest shrink-0 px-3 py-1.5 border border-border hover:bg-surface-raised transition-colors"
                style={{ color: copied ? 'rgb(52,211,153)' : undefined }}
              >
                {copied ? 'Copié ✓' : 'Copier'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Submitted sessions ── */}
      <section>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
          Sessions soumises
        </p>

        {sessions.filter((s) => s.status !== 'DONE').length === 0 ? (
          <div className="border border-border border-dashed p-12 text-center">
            <p className="text-xs font-mono text-muted-foreground">Aucune session soumise pour l'instant.</p>
          </div>
        ) : (
          <SessionTable
            sessions={sessions.filter((s) => s.status !== 'DONE')}
            delivering={delivering}
            deliverSuccess={deliverSuccess}
            onDeliver={handleDeliver}
          />
        )}

        {deliverError && (
          <p className="text-xs font-mono mt-3" style={{ color: '#f87171' }}>{deliverError}</p>
        )}
      </section>

      {/* ── History ── */}
      <section>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
          Historique
        </p>

        {sessions.filter((s) => s.status === 'DONE').length === 0 ? (
          <div className="border border-border border-dashed p-12 text-center">
            <p className="text-xs font-mono text-muted-foreground">Aucune vidéo envoyée pour l'instant.</p>
          </div>
        ) : (
          <SessionTable
            sessions={sessions.filter((s) => s.status === 'DONE')}
            delivering={delivering}
            deliverSuccess={deliverSuccess}
            onDeliver={handleDeliver}
          />
        )}
      </section>
    </div>
  )
}

function SessionTable({
  sessions,
  delivering,
  deliverSuccess,
  onDeliver,
}: {
  sessions: SubmittedSession[]
  delivering: string | null
  deliverSuccess: string | null
  onDeliver: (id: string) => void
}) {
  return (
    <div className="border border-border overflow-hidden">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 100px 160px' }} className="border-b border-border bg-surface">
        {['Destinataire', 'Thème', 'Soumise le', 'Statut', 'Actions'].map((h) => (
          <div key={h} className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {h}
          </div>
        ))}
      </div>

      {sessions.map((session, i) => {
        const statusInfo = STATUS_LABELS[session.status] ?? { label: session.status, color: 'rgba(255,255,255,0.4)' }
        const canDeliver = session.status === 'PROCESSING' || (session.finalVideoKey != null && session.status !== 'DONE')
        return (
          <div
            key={session.id}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 100px 160px' }}
            className={`items-center border-b border-border last:border-0 hover:bg-surface-raised transition-colors ${i % 2 === 0 ? '' : 'bg-surface/50'}`}
          >
            <div className="px-4 py-3.5">
              <p className="font-sans font-semibold text-sm text-foreground">{session.recipientName ?? '—'}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{session.recipientEmail}</p>
            </div>
            <div className="px-4 py-3.5">
              <span className="text-xs text-foreground">{session.theme?.name}</span>
            </div>
            <div className="px-4 py-3.5">
              <span className="text-[11px] font-mono text-muted-foreground">{formatDate(session.submittedAt)}</span>
            </div>
            <div className="px-4 py-3.5">
              <span
                className="text-[10px] font-mono uppercase tracking-wider px-2 py-1"
                style={{ color: statusInfo.color, background: `${statusInfo.color}18`, border: `1px solid ${statusInfo.color}30` }}
              >
                {statusInfo.label}
              </span>
            </div>
            <div className="px-4 py-3.5 flex items-center gap-2 flex-wrap">
              <Link
                href={`/process/${session.id}`}
                className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
              >
                Montage →
              </Link>
              {canDeliver && (
                <button
                  onClick={() => onDeliver(session.id)}
                  disabled={delivering === session.id}
                  className="text-[10px] font-mono uppercase tracking-widest transition-colors whitespace-nowrap disabled:opacity-50"
                  style={{ color: 'rgb(52,211,153)' }}
                >
                  {delivering === session.id ? 'Envoi...' : 'Envoyer ✉'}
                </button>
              )}
              {deliverSuccess === session.id && (
                <span className="text-[10px] font-mono" style={{ color: 'rgb(52,211,153)' }}>Email envoyé ✓</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
