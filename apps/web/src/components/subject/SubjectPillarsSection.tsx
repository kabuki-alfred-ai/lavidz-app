'use client'

import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubjectSection, SectionChip } from './SubjectSection'
import { PillarsHelp } from './SubjectHelp'
import type { NarrativeAnchor } from '@/lib/narrative-anchor'

interface SubjectPillarsSectionProps {
  anchor: NarrativeAnchor | null
  onSave: (bullets: string[]) => Promise<void>
  defaultOpen?: boolean
  id?: string
}

export function SubjectPillarsSection({
  anchor,
  onSave,
  defaultOpen = false,
  id,
}: SubjectPillarsSectionProps) {
  const initialBullets = anchor?.bullets.filter((b) => b.trim().length > 0) ?? []
  const count = initialBullets.length
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>(
    initialBullets.length > 0 ? initialBullets : [''],
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const cleaned = draft.map((b) => b.trim()).filter((b) => b.length > 0)
      await onSave(cleaned)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SubjectSection
      id={id}
      number="02"
      title="Les piliers à défendre"
      subtitle="Le fond qui survit à tous les formats — l'ancre narrative."
      help={<PillarsHelp />}
      chip={
        count > 0 ? (
          <SectionChip>{count} point{count > 1 ? 's' : ''}</SectionChip>
        ) : undefined
      }
      defaultOpen={defaultOpen}
    >
      {!editing ? (
        <>
          {initialBullets.length > 0 ? (
            <ol className="rounded-xl border border-border bg-surface-raised/40 p-5 space-y-3 max-w-[680px]">
              {initialBullets.map((bullet, i) => (
                <li key={i} className="flex gap-3 text-[14px] leading-relaxed">
                  <span className="font-mono text-[11px] text-muted-foreground/70 mt-1 w-5 shrink-0">
                    {String(i + 1).padStart(2, '0')}.
                  </span>
                  <p>{bullet}</p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface-raised/20 p-5 max-w-[680px]">
              <p className="text-sm italic text-muted-foreground">
                Aucun pilier posé. Demande à Kabou d'en extraire depuis ton angle — ou liste-les toi-même.
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(initialBullets.length > 0 ? initialBullets : [''])
              setEditing(true)
            }}
            className="mt-3"
          >
            <Plus className="h-3 w-3" />
            {initialBullets.length > 0 ? 'Éditer les piliers' : 'Poser les piliers'}
          </Button>
        </>
      ) : (
        <div className="rounded-xl border border-border bg-surface-raised/40 p-4 max-w-[680px] space-y-2">
          {draft.map((bullet, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-mono text-[11px] text-muted-foreground/70 mt-3 w-5 shrink-0">
                {String(i + 1).padStart(2, '0')}.
              </span>
              <textarea
                value={bullet}
                onChange={(e) => {
                  const next = [...draft]
                  next[i] = e.target.value
                  setDraft(next)
                }}
                rows={2}
                placeholder="Un pilier qui doit survivre à tous les formats…"
                className="flex-1 resize-y rounded-lg border border-border bg-background px-3 py-2 text-[14px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              {draft.length > 1 && (
                <button
                  type="button"
                  onClick={() => setDraft(draft.filter((_, idx) => idx !== i))}
                  className="mt-2 text-muted-foreground/60 hover:text-destructive transition"
                  aria-label="Retirer ce pilier"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft([...draft, ''])}>
              <Plus className="h-3 w-3" />
              Ajouter un point
            </Button>
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Sauvegarder
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false)
                  setDraft(initialBullets.length > 0 ? initialBullets : [''])
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}
    </SubjectSection>
  )
}
