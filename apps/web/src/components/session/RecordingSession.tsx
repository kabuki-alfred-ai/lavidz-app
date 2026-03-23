'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ThemeDto } from '@lavidz/types'

type Phase = 'intro' | 'reading' | 'countdown' | 'recording' | 'review' | 'uploading' | 'done'

function readingDuration(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(3, Math.min(10, Math.ceil(words * 0.45)))
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Props {
  theme: ThemeDto
  initialSessionId?: string
  mode?: 'default' | 'shared'
}

export function RecordingSession({ theme, initialSessionId, mode = 'default' }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('intro')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [readingCountdown, setReadingCountdown] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [starting, setStarting] = useState(false)
  const [introStep, setIntroStep] = useState<1 | 2>(1)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const readingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null)
  const questionAudioRef = useRef<HTMLAudioElement | null>(null)

  const QUESTION_VOICE_ID = 'MmafIMKg28Wr0yMh8CEB'

  const announceQuestion = async (text: string) => {
    try {
      questionAudioRef.current?.pause()
      questionAudioRef.current = null
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: QUESTION_VOICE_ID }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      questionAudioRef.current = audio
      audio.play()
      audio.onended = () => URL.revokeObjectURL(url)
    } catch {}
  }

  const questions = theme.questions ?? []
  const currentQuestion = questions[questionIndex]
  const accent = theme.brandColor ?? '#FF4D1C'

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (elapsedRef.current) clearInterval(elapsedRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
      if (readingRef.current) clearInterval(readingRef.current)
      questionAudioRef.current?.pause()
    }
  }, [])

  // Attach stream to video element whenever camera phase is active
  useEffect(() => {
    if (phase !== 'intro' && phase !== 'done' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.muted = true
    }
  }, [phase])

  const beginReading = (question: typeof currentQuestion) => {
    const duration = readingDuration(question?.text ?? '')
    setReadingCountdown(duration)
    setPhase('reading')
    if (question?.text) announceQuestion(question.text)
    let c = duration
    readingRef.current = setInterval(() => {
      c -= 1
      setReadingCountdown(c)
      if (c <= 0) {
        clearInterval(readingRef.current!)
        beginCountdown()
      }
    }, 1000)
  }

  const beginCountdown = () => {
    setPhase('countdown')
    setCountdown(3)
    let c = 3
    countdownRef.current = setInterval(() => {
      c -= 1
      if (c <= 0) {
        clearInterval(countdownRef.current!)
        doStartRecording()
      } else {
        setCountdown(c)
      }
    }, 1000)
  }

  const doStartRecording = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    setElapsed(0)
    setPhase('recording')

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'
    const recorder = new MediaRecorder(streamRef.current, { mimeType })
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.start(100)
    mediaRecorderRef.current = recorder

    elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }
    setPhase('review')
  }

  const redo = () => {
    chunksRef.current = []
    setElapsed(0)
    beginReading(currentQuestion)
  }

  const saveAndNext = async () => {
    if (!sessionIdRef.current || !currentQuestion || chunksRef.current.length === 0) return
    setPhase('uploading')
    setUploadError('')

    try {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const formData = new FormData()
      formData.append('video', blob, 'recording.webm')
      formData.append('questionId', currentQuestion.id)

      const res = await fetch(`${API}/api/sessions/${sessionIdRef.current}/recordings`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')

      chunksRef.current = []

      if (questionIndex < questions.length - 1) {
        setQuestionIndex((i) => i + 1)
        beginReading(questions[questionIndex + 1])
      } else {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        setPhase('done')
      }
    } catch {
      setUploadError('Erreur d\'envoi — réessayez')
      setPhase('review')
    }
  }

  const handleStart = async () => {
    if (starting) return
    setStarting(true)
    try {
      if (!initialSessionId) {
        const res = await fetch(`${API}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ themeId: theme.id }),
        })
        const session = await res.json()
        setSessionId(session.id)
        sessionIdRef.current = session.id
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      })
      streamRef.current = stream

      beginReading(questions[0])
    } catch (err) {
      console.error(err)
      setStarting(false)
    }
  }

  const handleSubmit = async () => {
    if (!sessionIdRef.current || submitting) return
    setSubmitting(true)
    try {
      await fetch(`${API}/api/sessions/${sessionIdRef.current}/submit`, { method: 'POST' })
      setSubmitted(true)
    } catch {
      setSubmitting(false)
    }
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ─── INTRO ────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    const noise = (
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
      />
    )

    const brand = (
      <div className="flex flex-col items-center gap-3 z-10">
        {theme.logoUrl ? (
          <img src={theme.logoUrl} alt={theme.brandName ?? ''} className="h-8 object-contain" />
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
            <span className="text-xs font-mono text-white/40 tracking-widest uppercase">
              {theme.brandName ?? 'Lavidz'}
            </span>
          </div>
        )}
      </div>
    )

    // Step 1: purpose of the interview
    if (introStep === 1) {
      return (
        <div
          className="fixed inset-0 flex flex-col items-center justify-between px-6 py-12 overflow-hidden"
          style={{ background: '#0a0a0a' }}
        >
          {noise}
          {brand}

          <div className="flex flex-col items-center gap-8 z-10 text-center max-w-sm w-full">
            <div className="flex flex-col gap-4">
              <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
                {theme.name}
              </h1>
              {theme.description && (
                <p className="text-sm text-white/50 leading-relaxed">
                  {theme.description}
                </p>
              )}
            </div>

            <p className="text-sm text-white/40 leading-relaxed">
              Vous allez répondre à{' '}
              <span className="text-white font-semibold">
                {questions.length} question{questions.length > 1 ? 's' : ''}
              </span>{' '}
              face caméra. Chaque réponse sera enregistrée en vidéo.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 z-10 w-full max-w-sm">
            <button
              onClick={() => setIntroStep(2)}
              className="w-full py-4 rounded-2xl font-bold text-base tracking-wide transition-all active:scale-95"
              style={{ background: accent, color: '#fff' }}
            >
              Continuer →
            </button>
            <p className="text-[10px] font-mono text-white/25 text-center">
              {questions.length} question{questions.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )
    }

    // Step 2: tips for good conditions
    const tips = [
      {
        icon: '☀️',
        title: 'Lumière naturelle',
        desc: 'Placez-vous face à une fenêtre ou une source lumineuse. Évitez d\'avoir la lumière dans le dos.',
      },
      {
        icon: '🔇',
        title: 'Pièce calme',
        desc: 'Choisissez un endroit sans bruit de fond — télé, musique, rue animée.',
      },
      {
        icon: '↩️',
        title: 'Pas de pression',
        desc: 'Vous pouvez refaire chaque réponse autant de fois que vous le souhaitez avant de passer à la suivante.',
      },
      {
        icon: '📱',
        title: 'Stabilité',
        desc: 'Posez votre téléphone ou tenez-le bien droit pour une image nette.',
      },
    ]

    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-between px-6 py-12 overflow-hidden"
        style={{ background: '#0a0a0a' }}
      >
        {noise}
        {brand}

        <div className="flex flex-col gap-6 z-10 w-full max-w-sm">
          <div className="text-center">
            <h2 className="text-2xl font-black text-white mb-2">Avant de commencer</h2>
            <p className="text-sm text-white/40">Quelques conseils pour une vidéo de qualité</p>
          </div>
          <div className="flex flex-col gap-3">
            {tips.map((tip) => (
              <div
                key={tip.title}
                className="flex items-start gap-4 px-4 py-4 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className="text-xl shrink-0 mt-0.5">{tip.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">{tip.title}</p>
                  <p className="text-xs text-white/40 leading-relaxed">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 z-10 w-full max-w-sm">
          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full py-4 rounded-2xl font-bold text-base tracking-wide transition-all active:scale-95 disabled:opacity-60"
            style={{ background: accent, color: '#fff' }}
          >
            {starting ? 'Démarrage...' : "C'est parti !"}
          </button>
          <button
            onClick={() => setIntroStep(1)}
            className="text-xs text-white/25 font-mono"
          >
            ← Retour
          </button>
        </div>
      </div>
    )
  }

  // ─── DONE ─────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    // Thank-you screen after submit in shared mode
    if (mode === 'shared' && submitted) {
      return (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center gap-8 px-8"
          style={{ background: '#0a0a0a' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4 4 10-10" stroke="rgb(52,211,153)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black text-white mb-2">Envoyé !</h1>
            <p className="text-sm text-white/40">Vos réponses ont bien été reçues.<br />Vous recevrez un email quand le montage sera prêt.</p>
          </div>
        </div>
      )
    }

    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-8 px-8"
        style={{ background: '#0a0a0a' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l4 4 10-10" stroke="rgb(52,211,153)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-black text-white mb-2">Dans la boîte.</h1>
          <p className="text-sm text-white/40">Toutes vos réponses ont été enregistrées.</p>
        </div>
        {mode === 'shared' ? (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-8 py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-60"
            style={{ background: accent, color: '#fff' }}
          >
            {submitting ? 'Envoi...' : 'Envoyer ✓'}
          </button>
        ) : (
          <button
            onClick={() => router.push(`/session/${theme.slug}/result?session=${sessionId}`)}
            className="px-8 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
          >
            Voir les résultats
          </button>
        )}
      </div>
    )
  }

  // ─── READING PHASE ────────────────────────────────────────────────────────
  if (phase === 'reading') {
    const total = readingDuration(currentQuestion?.text ?? '')
    const progress = ((total - readingCountdown) / total) * 100
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center px-8"
        style={{ background: '#0a0a0a' }}
      >
        {/* Progress bar */}
        <div className="absolute top-0 inset-x-0 h-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%`, background: accent }}
          />
        </div>

        {/* Question number */}
        <p className="text-xs font-mono uppercase tracking-widest mb-6" style={{ color: accent }}>
          Question {String(questionIndex + 1).padStart(2, '0')} / {questions.length}
        </p>

        {/* Question text */}
        <h1
          key={questionIndex}
          className="text-white font-black text-3xl leading-tight tracking-tight text-center max-w-sm"
          style={{ animation: 'fadeSlideIn 0.4s ease forwards' }}
        >
          {currentQuestion?.text}
        </h1>

        {currentQuestion?.hint && (
          <p className="text-white/40 text-sm mt-6 text-center max-w-xs leading-relaxed">
            {currentQuestion.hint}
          </p>
        )}

        {/* Countdown */}
        <div className="absolute bottom-16 flex flex-col items-center gap-2">
          <span
            key={readingCountdown}
            className="text-white font-black tabular-nums"
            style={{ fontSize: 64, lineHeight: 1, animation: 'countPop 0.8s ease forwards' }}
          >
            {readingCountdown}
          </span>
          <p className="text-white/30 text-xs font-mono tracking-widest uppercase">Enregistrement dans</p>
        </div>

        <style>{`
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes countPop {
            0% { opacity: 0; transform: scale(1.3); }
            20% { opacity: 1; transform: scale(1); }
            80% { opacity: 1; transform: scale(1); }
            100% { opacity: 0.6; transform: scale(0.95); }
          }
        `}</style>
      </div>
    )
  }

  // ─── CAMERA PHASES (countdown / recording / review / uploading) ───────────
  const isCountdown = phase === 'countdown'
  const isRecording = phase === 'recording'
  const isReview = phase === 'review'
  const isUploading = phase === 'uploading'

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#000' }}>
      {/* Camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Gradient overlays */}
      <div
        className="absolute inset-x-0 top-0 h-48 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-56 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
      />

      {/* Top: progress + question */}
      <div className="absolute inset-x-0 top-0 px-5 pt-12 flex flex-col gap-4">
        {/* Progress dots */}
        <div className="flex items-center gap-2">
          {questions.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                height: 3,
                flex: i === questionIndex ? '2' : '1',
                background: i < questionIndex
                  ? 'rgba(255,255,255,0.5)'
                  : i === questionIndex
                  ? '#fff'
                  : 'rgba(255,255,255,0.2)',
              }}
            />
          ))}
          <span className="text-[10px] font-mono text-white/50 ml-1 shrink-0">
            {questionIndex + 1}/{questions.length}
          </span>
        </div>

        {/* Question card */}
        <div
          className="rounded-2xl px-4 py-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: accent }}>
            Question {String(questionIndex + 1).padStart(2, '0')}
          </p>
          <p
            key={questionIndex}
            className="text-white font-bold text-base leading-snug"
            style={{ animation: 'fadeSlideIn 0.4s ease forwards' }}
          >
            {currentQuestion?.text}
          </p>
          {currentQuestion?.hint && (
            <p className="text-white/40 text-xs mt-2 leading-relaxed">{currentQuestion.hint}</p>
          )}
        </div>
      </div>

      {/* Countdown overlay */}
      {isCountdown && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ animation: 'fadeIn 0.2s ease' }}
        >
          <div
            key={countdown}
            className="text-white font-black leading-none"
            style={{ fontSize: 120, animation: 'countPop 0.8s ease forwards', textShadow: '0 0 40px rgba(255,255,255,0.3)' }}
          >
            {countdown}
          </div>
          <p className="text-white/50 text-sm font-mono tracking-widest uppercase">Préparez-vous</p>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* REC badge — subtle, at edge */}
        </div>
      )}

      {/* Review overlay */}
      {(isReview || isUploading) && (
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 pb-12 px-6 flex flex-col items-center gap-6">

        {/* REC timer */}
        {isRecording && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: accent, animation: 'recPulse 1.2s ease-in-out infinite' }}
            />
            <span className="text-white text-xs font-mono tabular-nums">{formatTime(elapsed)}</span>
          </div>
        )}

        {/* Review duration */}
        {(isReview || isUploading) && (
          <p className="text-white/50 text-xs font-mono">{formatTime(elapsed)} enregistré</p>
        )}

        {uploadError && (
          <p className="text-red-400 text-xs font-mono text-center">{uploadError}</p>
        )}

        {/* Record / Stop button */}
        {(isCountdown || isRecording) && (
          <button
            onClick={isRecording ? stopRecording : undefined}
            disabled={isCountdown}
            className="relative flex items-center justify-center transition-all active:scale-95"
            style={{ width: 80, height: 80 }}
          >
            {/* Outer ring */}
            <div
              className="absolute inset-0 rounded-full transition-all duration-300"
              style={{
                border: `3px solid ${isRecording ? accent : 'rgba(255,255,255,0.6)'}`,
                boxShadow: isRecording ? `0 0 0 4px ${accent}30` : 'none',
              }}
            />
            {/* Inner shape */}
            <div
              className="transition-all duration-300"
              style={{
                width: isRecording ? 28 : 56,
                height: isRecording ? 28 : 56,
                borderRadius: isRecording ? 6 : '50%',
                background: isRecording ? accent : 'rgba(255,255,255,0.9)',
              }}
            />
          </button>
        )}

        {/* Review: Refaire / Continuer */}
        {isReview && (
          <div className="flex gap-3 w-full max-w-sm">
            <button
              onClick={redo}
              className="flex-1 py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              ↩ Refaire
            </button>
            <button
              onClick={saveAndNext}
              className="flex-[2] py-4 rounded-2xl font-bold text-sm transition-all active:scale-95"
              style={{ background: accent, color: '#fff' }}
            >
              {questionIndex < questions.length - 1 ? 'Continuer →' : 'Terminer ✓'}
            </button>
          </div>
        )}

        {/* Uploading */}
        {isUploading && (
          <div className="flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${accent} transparent transparent transparent` }}
            />
            <span className="text-white/60 text-sm font-mono">Envoi en cours...</span>
          </div>
        )}

        {/* Hint */}
        {isRecording && (
          <p className="text-white/30 text-[10px] font-mono text-center tracking-wider uppercase">
            Appuyez pour arrêter
          </p>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes countPop {
          0% { opacity: 0; transform: scale(1.4); }
          20% { opacity: 1; transform: scale(1); }
          80% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.8); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes recPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
