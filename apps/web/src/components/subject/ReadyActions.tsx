'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
type Format =
  | 'QUESTION_BOX'
  | 'TELEPROMPTER'
  | 'HOT_TAKE'
  | 'STORYTELLING'
  | 'DAILY_TIP'
  | 'MYTH_VS_REALITY'

export interface ReadyActionsProps {
  topicId: string
  defaultFormat?: Format
  onChanged?: () => void
}

export function ReadyActions({ topicId, defaultFormat, onChanged: _onChanged }: ReadyActionsProps) {
  const router = useRouter()
  const [recording, setRecording] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const recordNow = async () => {
    setRecording(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/record-now`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultFormat ? { format: defaultFormat } : {}),
      })
      if (!res.ok) {
        const text = await res.text()
        setError(text || 'Impossible de démarrer la session')
        return
      }
      const data = (await res.json()) as { sessionId: string }
      router.push(`/s/${data.sessionId}`)
    } catch (err) {
      setError(String(err))
    } finally {
      setRecording(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-surface p-6 flex flex-col gap-4">
      <Button onClick={recordNow} disabled={recording} size="lg">
        🎬 {recording ? 'Démarrage…' : 'Tourner maintenant'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
