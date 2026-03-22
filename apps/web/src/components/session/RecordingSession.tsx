'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ThemeDto } from '@lavidz/types'

type Phase = 'intro' | 'countdown' | 'recording' | 'review' | 'uploading' | 'done'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Props {
  theme: ThemeDto
}

export function RecordingSession({ theme }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('intro')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [starting, setStarting] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const questions = theme.questions ?? []
  const currentQuestion = questions[questionIndex]
  const accent = theme.brandColor ?? '#FF4D1C'

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (elapsedRef.current) clearInterval(elapsedRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  // Attach stream to video element whenever camera phase is active
  useEffect(() => {
    if (phase !== 'intro' && phase !== 'done' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.muted = true
    }
  }, [phase])

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
    beginCountdown()
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
        beginCountdown()
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
      const res = await fetch(`${API}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: theme.id }),
      })
      const session = await res.json()
      setSessionId(session.id)
      sessionIdRef.current = session.id

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      })
      streamRef.current = stream

      beginCountdown()
    } catch (err) {
      console.error(err)
      setStarting(false)
    }
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ─── INTRO ────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-between px-6 py-12 overflow-hidden"
        style={{ background: '#0a0a0a' }}
      >
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
        />

        {/* Brand */}
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

        {/* Center content */}
        <div className="flex flex-col items-center gap-8 z-10 text-center max-w-sm w-full">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
              {theme.name}
            </h1>
            {theme.description && (
              <p className="text-sm text-white/40 leading-relaxed">
                {theme.description}
              </p>
            )}
          </div>

          {/* Questions preview */}
          <div className="flex flex-col gap-2 w-full">
            {questions.slice(0, 4).map((q, i) => (
              <div
                key={q.id}
                className="flex items-start gap-3 px-4 py-3 rounded-xl text-left"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <span className="text-[10px] font-mono mt-0.5 shrink-0" style={{ color: accent }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">{q.text}</p>
              </div>
            ))}
            {questions.length > 4 && (
              <p className="text-[10px] font-mono text-white/30 text-center">
                +{questions.length - 4} autres questions
              </p>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4 z-10 w-full max-w-sm">
          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full py-4 rounded-2xl font-bold text-base tracking-wide transition-all active:scale-95 disabled:opacity-60"
            style={{ background: accent, color: '#fff' }}
          >
            {starting ? 'Démarrage...' : 'Commencer'}
          </button>
          <p className="text-[10px] font-mono text-white/25 text-center">
            {questions.length} question{questions.length > 1 ? 's' : ''} · Accès caméra requis
          </p>
        </div>
      </div>
    )
  }

  // ─── DONE ─────────────────────────────────────────────────────────────────
  if (phase === 'done') {
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
        <button
          onClick={() => router.push(`/session/${theme.slug}/result?session=${sessionId}`)}
          className="px-8 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
        >
          Voir les résultats
        </button>
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
