'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Step = 0 | 1 | 2 | 3

const QUESTIONS: Array<{
  prompt: string
  placeholder: string
  key: 'activity' | 'audience' | 'differentiator'
  minLen: number
}> = [
  {
    prompt: 'Raconte-moi en quelques phrases ce que tu fais.',
    placeholder: 'Ex : je suis consultante en stratégie digitale pour des PME du retail…',
    key: 'activity',
    minLen: 20,
  },
  {
    prompt: 'À qui tu t\'adresses en priorité ?',
    placeholder: 'Ex : les dirigeants de PME qui sentent que le digital leur échappe…',
    key: 'audience',
    minLen: 15,
  },
  {
    prompt: 'Et ce qui te distingue des 10 autres qui font pareil ?',
    placeholder: 'Ex : j\'ai été moi-même dirigeante avant de pivoter, je parle leur langue…',
    key: 'differentiator',
    minLen: 15,
  },
]

export function OnboardingView({ firstName }: { firstName: string | null }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [answers, setAnswers] = useState({ activity: '', audience: '', differentiator: '' })
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const handleNext = useCallback(() => {
    const current = QUESTIONS[step]
    if (!current) return
    const value = draft.trim()
    if (value.length < current.minLen) return
    setAnswers((prev) => ({ ...prev, [current.key]: value }))
    setDraft('')
    setStep((s) => (s + 1) as Step)
  }, [step, draft])

  const handleFinish = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(answers),
      })
      if (res.ok) {
        router.push('/home')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }, [answers, router])

  const isDone = step === 3

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-8 md:py-16">
      <header className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lavi-robot.png" alt="Kabou" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Kabou, ton compagnon créatif</p>
            <p className="text-sm font-semibold">
              Bienvenue{firstName ? `, ${firstName}` : ''}.
            </p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Avant qu\'on parle contenu, j\'aimerais te connaître. Trois questions courtes. Tu peux répondre en
          quelques phrases — ou une page entière. Je m\'adapte.
        </p>
      </header>

      {/* Progress dots */}
      <div className="mb-8 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step
                ? 'bg-primary'
                : i === step
                  ? 'bg-primary/40'
                  : 'bg-muted/30'
            }`}
          />
        ))}
      </div>

      {/* Step 0-2: questions */}
      {step < 3 && (
        <section className="flex-1">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            Question {step + 1} sur 3
          </h2>
          <p className="mb-6 text-xl font-semibold leading-snug text-foreground sm:text-2xl">
            {QUESTIONS[step].prompt}
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={QUESTIONS[step].placeholder}
            rows={6}
            autoFocus
            className="mb-4 w-full resize-y rounded-xl border border-border/40 bg-surface-raised/40 px-4 py-3 text-base leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {draft.trim().length < QUESTIONS[step].minLen
                ? `Quelques mots de plus pour que je saisisse bien (${QUESTIONS[step].minLen - draft.trim().length} mini).`
                : 'Parfait, tu peux passer à la suite.'}
            </p>
            <Button
              size="lg"
              onClick={handleNext}
              disabled={draft.trim().length < QUESTIONS[step].minLen}
            >
              {step === 2 ? 'Je synthétise' : 'Question suivante'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* Step 3: synthesis */}
      {isDone && (
        <section className="flex-1">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" /> Voilà ce que j\'ai compris
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            On retravaillera tout ça ensemble. Pour l\'instant, j\'ai la matière pour te proposer des Sujets qui
            te ressemblent.
          </p>

          <div className="space-y-4 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                Ton activité
              </p>
              <p className="text-sm">{answers.activity}</p>
            </div>
            {answers.audience && (
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                  Ton audience
                </p>
                <p className="text-sm">{answers.audience}</p>
              </div>
            )}
            {answers.differentiator && (
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                  Ce qui te distingue
                </p>
                <p className="text-sm">{answers.differentiator}</p>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            <Button size="lg" onClick={handleFinish} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              C\'est bon, on démarre
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => {
                setStep(0)
                setDraft(answers.activity)
              }}
              disabled={saving}
            >
              Je reprends mes réponses
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
