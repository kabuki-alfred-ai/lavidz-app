'use client'

import { useState, useCallback } from 'react'
import { MessageCircle, Send, Trash2, Clock } from 'lucide-react'

export interface TimelineComment {
  id: string
  timestamp: number
  text: string
  author: string
  authorRole: 'client' | 'editor'
  resolved: boolean
  createdAt: string
}

interface Props {
  comments: TimelineComment[]
  currentTime: number
  duration: number
  userRole: 'client' | 'editor'
  accentColor?: string
  onAddComment: (timestamp: number, text: string) => void
  onResolveComment: (commentId: string) => void
  onDeleteComment: (commentId: string) => void
  onSeekTo?: (timeInSeconds: number) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'A l\'instant'
  if (mins < 60) return `Il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `Il y a ${days}j`
}

export default function TimelineComments({
  comments,
  currentTime,
  duration,
  userRole,
  accentColor = '#FF4D1C',
  onAddComment,
  onResolveComment,
  onDeleteComment,
  onSeekTo,
}: Props) {
  const [newCommentText, setNewCommentText] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  const handleSubmit = useCallback(() => {
    const text = newCommentText.trim()
    if (!text) return
    onAddComment(currentTime, text)
    setNewCommentText('')
  }, [newCommentText, currentTime, onAddComment])

  const activeComments = comments.filter((c) => !c.resolved)
  const resolvedComments = comments.filter((c) => c.resolved)
  const displayComments = showResolved ? comments : activeComments

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={13} className="text-white/40" />
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
            Commentaires
          </p>
          {activeComments.length > 0 && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: accentColor + '20', color: accentColor }}
            >
              {activeComments.length}
            </span>
          )}
        </div>
        {resolvedComments.length > 0 && (
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-[10px] text-white/30 hover:text-white/60 transition-colors font-mono"
          >
            {showResolved ? 'Masquer resolus' : `${resolvedComments.length} resolu${resolvedComments.length > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-2">
        {displayComments.length === 0 ? (
          <div className="text-center py-6">
            <MessageCircle size={20} className="text-white/10 mx-auto mb-2" />
            <p className="text-xs text-white/30">Pas de commentaires.</p>
            <p className="text-[10px] text-white/20 mt-1">
              Ajoute un commentaire au timestamp actuel.
            </p>
          </div>
        ) : (
          displayComments
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((comment) => (
              <div
                key={comment.id}
                className={`rounded-lg p-3 border transition-all ${
                  comment.resolved
                    ? 'border-white/5 opacity-50'
                    : 'border-white/8 hover:border-white/15'
                }`}
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <button
                    onClick={() => onSeekTo?.(comment.timestamp)}
                    className="text-[10px] font-mono hover:text-white transition-colors"
                    style={{ color: accentColor }}
                  >
                    ▶ {formatTime(comment.timestamp)}
                  </button>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: comment.authorRole === 'client' ? '#3b82f620' : '#8b5cf620',
                      color: comment.authorRole === 'client' ? '#3b82f6' : '#8b5cf6',
                    }}
                  >
                    {comment.authorRole === 'client' ? 'Client' : 'Monteur'}
                  </span>
                  <span className="text-[9px] text-white/20 font-mono flex items-center gap-0.5">
                    <Clock size={8} />
                    {timeAgo(comment.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">{comment.text}</p>
                <div className="flex items-center gap-2 mt-2">
                  {!comment.resolved && (
                    <button
                      onClick={() => onResolveComment(comment.id)}
                      className="text-[10px] font-mono text-emerald-400/60 hover:text-emerald-400 transition-colors flex items-center gap-1"
                    >
                      ✓ Resoudre
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteComment(comment.id)}
                    className="text-[10px] font-mono text-white/20 hover:text-red-400 transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={9} />
                  </button>
                </div>
              </div>
            ))
        )}
      </div>

      {/* New comment input */}
      <div className="px-4 pb-3 pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-white/30 shrink-0">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Ajouter un commentaire..."
              className="flex-1 bg-transparent text-xs text-white/70 placeholder:text-white/20 outline-none"
            />
            <button
              onClick={handleSubmit}
              disabled={!newCommentText.trim()}
              className="text-white/30 hover:text-white disabled:opacity-20 transition-colors"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
