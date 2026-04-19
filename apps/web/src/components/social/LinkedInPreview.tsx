'use client'

import { useState } from 'react'
import { ThumbsUp, MessageCircle, Repeat2, Send, MoreHorizontal, Globe2 } from 'lucide-react'

interface Props {
  authorName: string
  authorTitle?: string
  content: string
  avatarUrl?: string | null
  timeAgo?: string
}

/**
 * Pixel-ish LinkedIn feed card preview. Mimics LinkedIn's post layout :
 * - Avatar + name + title + time/globe
 * - Content with "...voir plus" collapse after 3 lines
 * - Action bar: J'aime / Commenter / Republier / Envoyer
 */
export function LinkedInPreview({ authorName, authorTitle, content, avatarUrl, timeAgo = '1 h' }: Props) {
  const [expanded, setExpanded] = useState(false)

  // LinkedIn collapses after roughly 3 lines ~ 200 chars. We approximate by chars when not expanded.
  const shouldCollapse = content.length > 210 && !expanded
  const displayContent = shouldCollapse ? content.slice(0, 210).trimEnd() + '…' : content

  const initials = authorName
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E1E4E7',
      borderRadius: 8,
      width: '100%',
      maxWidth: 555,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      color: 'rgba(0,0,0,0.9)',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 16px 0' }}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={authorName}
            width={48}
            height={48}
            style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #0A66C2 0%, #0073B1 100%)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 16, letterSpacing: 0.5,
            }}
          >
            {initials || 'U'}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, lineHeight: '18px', color: 'rgba(0,0,0,0.9)' }}>
            {authorName}
          </div>
          {authorTitle && (
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)', lineHeight: '16px', marginTop: 1 }}>
              {authorTitle}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)', lineHeight: '16px', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <span>{timeAgo}</span>
            <span aria-hidden>•</span>
            <Globe2 size={12} />
          </div>
        </div>

        <button
          aria-label="Plus d'options"
          style={{
            border: 'none', background: 'transparent', cursor: 'default',
            padding: 4, color: 'rgba(0,0,0,0.6)', display: 'flex',
          }}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 16px 8px', fontSize: 14, lineHeight: '20px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {displayContent}
        {shouldCollapse && (
          <>
            {' '}
            <button
              onClick={() => setExpanded(true)}
              style={{
                background: 'transparent', border: 'none', padding: 0,
                color: 'rgba(0,0,0,0.6)', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              }}
            >
              …voir plus
            </button>
          </>
        )}
      </div>

      {/* Reaction summary placeholder (blank to keep minimal) */}
      <div style={{ padding: '0 16px 6px', height: 18 }} />

      {/* Divider */}
      <div style={{ height: 1, background: '#E1E4E7', marginLeft: 16, marginRight: 16 }} />

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '4px 8px' }}>
        {[
          { icon: ThumbsUp, label: "J'aime" },
          { icon: MessageCircle, label: 'Commenter' },
          { icon: Repeat2, label: 'Republier' },
          { icon: Send, label: 'Envoyer' },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 4px', border: 'none', background: 'transparent',
              color: 'rgba(0,0,0,0.6)', fontSize: 13, fontWeight: 600, borderRadius: 4,
              cursor: 'default',
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
