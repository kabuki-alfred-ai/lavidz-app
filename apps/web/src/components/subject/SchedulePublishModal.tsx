'use client'

import * as React from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  DatePicker,
  todayIso,
  nextMondayIso,
  inDaysIso,
} from '@/components/ui/date-picker'
import { Button } from '@/components/ui/button'

type Format =
  | 'QUESTION_BOX'
  | 'TELEPROMPTER'
  | 'HOT_TAKE'
  | 'STORYTELLING'
  | 'DAILY_TIP'
  | 'MYTH_VS_REALITY'

export interface SchedulePublishModalProps {
  open: boolean
  onClose: () => void
  topicId: string
  defaultFormat?: Format
  defaultPlatforms?: string[]
  onScheduled?: () => void
}

export function SchedulePublishModal({
  open,
  onClose,
  topicId,
  defaultFormat = 'HOT_TAKE',
  defaultPlatforms = ['linkedin'],
  onScheduled,
}: SchedulePublishModalProps) {
  const [date, setDate] = React.useState<string>(nextMondayIso())
  const [format, setFormat] = React.useState<Format>(defaultFormat)
  const [platforms, setPlatforms] = React.useState<string[]>(defaultPlatforms)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/schedule-publish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishAt: date, format, platforms }),
      })
      if (!res.ok) {
        const text = await res.text()
        setError(text || 'Erreur lors de la planification')
        return
      }
      onScheduled?.()
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>📅 Quand veux-tu PUBLIER ce contenu ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le tournage se fera quand tu auras le temps. Ça pose juste une deadline de publication.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4">
          <DatePicker value={date} onChange={setDate} min={todayIso()} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded-lg bg-surface-raised hover:bg-muted transition-colors"
              onClick={() => setDate(nextMondayIso())}
            >
              Lundi prochain
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded-lg bg-surface-raised hover:bg-muted transition-colors"
              onClick={() => setDate(inDaysIso(7))}
            >
              Dans 1 sem
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded-lg bg-surface-raised hover:bg-muted transition-colors"
              onClick={() => setDate(inDaysIso(14))}
            >
              Dans 2 sem
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="h-10 rounded-lg bg-surface px-3 text-sm"
            >
              <option value="HOT_TAKE">Hot take</option>
              <option value="QUESTION_BOX">Question box</option>
              <option value="TELEPROMPTER">Teleprompter</option>
              <option value="STORYTELLING">Storytelling</option>
              <option value="DAILY_TIP">Daily tip</option>
              <option value="MYTH_VS_REALITY">Mythe vs réalité</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Plateformes</label>
            <div className="flex flex-wrap gap-2">
              {['linkedin', 'tiktok', 'instagram', 'youtube'].map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    platforms.includes(p)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-raised text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Planification…' : `Planifier le ${date}`}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
