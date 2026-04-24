'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Mic, RefreshCw, Sparkles, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Step = 0 | 1 | 2 | 3
type RecordState = 'idle' | 'recording' | 'transcribing' | 'done'

const QUESTIONS: Array<{ prompt: string; key: 'activity' | 'audience' | 'differentiator' }> = [
  { prompt: 'Raconte-moi en quelques phrases ce que tu fais.', key: 'activity' },
  { prompt: "À qui tu t'adresses en priorité ?", key: 'audience' },
  { prompt: 'Et ce qui te distingue des 10 autres qui font pareil ?', key: 'differentiator' },
]

export function OnboardingView({ firstName }: { firstName: string | null }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [answers, setAnswers] = useState({ activity: '', audience: '', differentiator: '' })
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [transcript, setTranscript] = useState('')
  const [saving, setSaving] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (blob.size < 1000) { setRecordState('idle'); return }
        setRecordState('transcribing')
        try {
          const fd = new FormData()
          fd.append('audio', blob)
          const res = await fetch('/api/chat/transcribe', { method: 'POST', body: fd })
          if (res.ok) {
            const { text } = await res.json()
            setTranscript(text?.trim() ?? '')
            setRecordState(text?.trim() ? 'done' : 'idle')
          } else {
            setRecordState('idle')
          }
        } catch {
          setRecordState('idle')
        }
      }
      mediaRecorder.start()
      setRecordState('recording')
    } catch { /* mic denied */ }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
  }, [])

  const confirmAnswer = useCallback(() => {
    const current = QUESTIONS[step]
    if (!current || !transcript.trim()) return
    setAnswers((prev) => ({ ...prev, [current.key]: transcript.trim() }))
    setTranscript('')
    setRecordState('idle')
    setStep((s) => (s + 1) as Step)
  }, [step, transcript])

  const redo = useCallback(() => {
    setTranscript('')
    setRecordState('idle')
  }, [])

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
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-6 py-10 md:py-16">

      {/* Header Kabou */}
      <header className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lavi-robot.png" alt="Kabou" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Kabou, ton compagnon créatif</p>
            <p className="text-sm font-semibold">Bienvenue{firstName ? `, ${firstName}` : ''}.</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Avant qu'on parle contenu, j'aimerais te connaître. Trois questions courtes — réponds à voix haute.
        </p>
      </header>

      {/* Progress dots */}
      {!isDone && (
        <div className="mb-10 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i < step ? 'bg-primary' : i === step ? 'bg-primary/40' : 'bg-muted/30'
              }`}
            />
          ))}
        </div>
      )}

      {/* Questions vocales */}
      {!isDone && (
        <section className="flex flex-1 flex-col">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            Question {step + 1} sur 3
          </p>
          <p className="mb-12 text-xl font-semibold leading-snug text-foreground sm:text-2xl">
            {QUESTIONS[step].prompt}
          </p>

          {/* État idle — bouton micro */}
          {recordState === 'idle' && (
            <div className="flex flex-col items-center gap-4 pt-4">
              <button
                onClick={startRecording}
                className="group flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary transition-all hover:scale-105 hover:bg-primary/20 active:scale-95"
              >
                <Mic size={36} className="transition-transform group-hover:scale-110" />
              </button>
              <p className="text-xs text-muted-foreground">Appuie pour parler</p>
            </div>
          )}

          {/* État recording — pulsation + stop */}
          {recordState === 'recording' && (
            <div className="flex flex-col items-center gap-4 pt-4">
              <button
                onClick={stopRecording}
                className="relative flex h-24 w-24 items-center justify-center rounded-full bg-red-500 text-white transition-all hover:bg-red-600 active:scale-95"
              >
                <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-30" />
                <Square size={28} fill="white" />
              </button>
              <p className="text-xs text-muted-foreground animate-pulse">En écoute...</p>
            </div>
          )}

          {/* État transcription en cours */}
          {recordState === 'transcribing' && (
            <div className="flex flex-col items-center gap-4 pt-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                <Loader2 size={28} className="animate-spin text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">Je t'écoute...</p>
            </div>
          )}

          {/* État done — transcript + confirmer/recommencer */}
          {recordState === 'done' && (
            <div className="flex flex-col gap-6">
              <div className="rounded-2xl border border-border/50 bg-surface-raised/40 px-5 py-4">
                <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Ce que j'ai entendu
                </p>
                <p className="text-sm leading-relaxed text-foreground">{transcript}</p>
              </div>
              <div className="flex gap-3">
                <Button size="lg" onClick={confirmAnswer} className="flex-1">
                  <Check className="h-4 w-4" />
                  {step === 2 ? 'Terminer' : 'Continuer'}
                </Button>
                <Button size="lg" variant="outline" onClick={redo}>
                  <RefreshCw className="h-4 w-4" />
                  Recommencer
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Récap final */}
      {isDone && (
        <section className="flex-1">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" /> Voilà ce que j'ai compris
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            On retravaillera tout ça ensemble. Pour l'instant, j'ai la matière pour te proposer des Sujets qui te ressemblent.
          </p>

          <div className="space-y-4 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">Ton activité</p>
              <p className="text-sm">{answers.activity}</p>
            </div>
            {answers.audience && (
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">Ton audience</p>
                <p className="text-sm">{answers.audience}</p>
              </div>
            )}
            {answers.differentiator && (
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">Ce qui te distingue</p>
                <p className="text-sm">{answers.differentiator}</p>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            <Button size="lg" onClick={handleFinish} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              C'est bon, on démarre
            </Button>
            <Button size="lg" variant="ghost" onClick={() => { setStep(0); setRecordState('idle'); setTranscript('') }} disabled={saving}>
              Je recommence
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
