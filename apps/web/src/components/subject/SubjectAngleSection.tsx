'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Check, Pencil, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubjectSection, SectionChip } from './SubjectSection'
import { AngleHelp } from './SubjectHelp'

interface SubjectAngleSectionProps {
  brief: string | null
  onSave: (value: string) => Promise<void>
  workedWithKabou?: boolean
  defaultOpen?: boolean
  /** Timestamp ISO du dernier event `brief_edited` par Kabou. Si présent, on
   * affiche un banner invitant à valider/retravailler la proposition. */
  kabouProposedAt?: string | null
  id?: string
}

export function SubjectAngleSection({
  brief,
  onSave,
  workedWithKabou,
  defaultOpen = true,
  kabouProposedAt,
  id,
}: SubjectAngleSectionProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(brief ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SubjectSection
      id={id}
      number="01"
      title="L'angle"
      subtitle="La prise de position que tu défends, et pour qui."
      help={<AngleHelp />}
      chip={
        kabouProposedAt ? (
          <SectionChip variant="primary">Proposé par Kabou · à valider</SectionChip>
        ) : workedWithKabou ? (
          <SectionChip variant="primary">Travaillé avec Kabou</SectionChip>
        ) : undefined
      }
      defaultOpen={defaultOpen || !!kabouProposedAt}
    >
      {!editing ? (
        <>
          {kabouProposedAt && brief && (
            <div className="mb-3 max-w-[680px] rounded-xl border border-primary/30 bg-primary/[0.06] p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] leading-relaxed">
                  <span className="font-medium">Kabou vient de rédiger cet angle.</span>{' '}
                  Relis-le : il est déjà enregistré, mais tu peux le raffiner ou le garder tel quel.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraft(brief ?? '')
                    setEditing(true)
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  Raffiner
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    // Valider = re-enregistrer à l'identique pour émettre un
                    // event brief_edited actor=user qui fait disparaître le banner.
                    await onSave(brief ?? '')
                  }}
                >
                  <Check className="h-3 w-3" />
                  Valider
                </Button>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-border bg-surface-raised/40 p-5 max-w-[680px]">
            {brief ? (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 text-[14.5px] leading-relaxed">
                <ReactMarkdown>{brief}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                Pas encore d'angle précis. Discute avec Kabou pour en faire émerger un — ou écris-le toi-même.
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(brief ?? '')
              setEditing(true)
            }}
            className="mt-3"
          >
            <Pencil className="h-3 w-3" />
            Éditer l'angle
          </Button>
        </>
      ) : (
        <div className="max-w-[680px]">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            placeholder="Quel est ton angle ? Pour qui ? Quel message veux-tu faire passer ?"
            className="w-full resize-y rounded-xl border border-border bg-surface-raised/40 px-4 py-3 text-[14.5px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Sauvegarder
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false)
                setDraft(brief ?? '')
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </SubjectSection>
  )
}
