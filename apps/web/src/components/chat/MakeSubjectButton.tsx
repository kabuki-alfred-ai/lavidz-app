'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'

interface MakeSubjectButtonProps {
  text: string
  sourceThreadId: string | null
}

/**
 * Inline CTA rendered under assistant messages in the inspiration chat.
 * Turns a message into a seed Topic in one click — distilled by the AI into
 * a name + brief, then opens the Sujet workspace so the entrepreneur can
 * keep working on it without losing flow.
 */
export function MakeSubjectButton({ text, sourceThreadId }: MakeSubjectButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const trimmed = text.trim()
  if (trimmed.length < 30) return null

  const handleClick = async () => {
    setLoading(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/topics/from-insight', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ insight: trimmed, sourceThreadId }),
      })
      if (!res.ok) {
        setFeedback('Impossible pour le moment.')
        return
      }
      const data = (await res.json()) as { topicId: string; name: string }
      router.push(`/sujets/${data.topicId}`)
    } catch {
      setFeedback('Impossible pour le moment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        Faire un sujet de ça
      </button>
      {feedback && (
        <span className="ml-2 text-[11px] italic text-muted-foreground">{feedback}</span>
      )}
    </div>
  )
}
