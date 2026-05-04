'use client'

import { useState, useEffect } from 'react'
import { Loader2, Clock, X, MessageSquare } from 'lucide-react'
import { T } from './constants'
import type { ThreadPreview } from './types'

export function HistoryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [threads, setThreads] = useState<ThreadPreview[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/chat/threads')
      .then((r) => r.json())
      .then((data) => setThreads(data.threads ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffH = Math.floor(diffMs / 3600000)
    if (diffH < 1) return 'Il y a moins d\'1h'
    if (diffH < 24) return `Il y a ${diffH}h`
    const diffD = Math.floor(diffH / 24)
    if (diffD === 1) return 'Hier'
    if (diffD < 7) return `Il y a ${diffD}j`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
          zIndex: 100, backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.2s',
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        background: T.surface, borderRadius: '22px 22px 0 0',
        zIndex: 101, maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.3s',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 12px',
          borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color={T.primary} />
            <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Conversations Kabou</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: T.muted }}
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0 24px' }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 size={20} className="animate-spin" style={{ color: T.muted }} />
            </div>
          )}

          {!loading && threads.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 24px', color: T.muted }}>
              <MessageSquare size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: 14, margin: 0 }}>Aucune conversation pour l'instant</p>
            </div>
          )}

          {!loading && threads.map((thread) => (
            <div
              key={thread.threadId}
              style={{
                padding: '14px 20px',
                borderBottom: `1px solid ${T.border}`,
                cursor: 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', background: '#FFF7F0',
                  border: `1px solid ${T.primary}25`, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MessageSquare size={14} color={T.primary} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 13, color: T.ink, fontWeight: 500, margin: '0 0 4px',
                    lineHeight: 1.4, overflow: 'hidden',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {thread.preview || '(conversation sans texte)'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: T.muted }}>{formatDate(thread.lastAt)}</span>
                    <span style={{ fontSize: 11, color: T.muted }}>·</span>
                    <span style={{ fontSize: 11, color: T.muted }}>{thread.messageCount} messages</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
