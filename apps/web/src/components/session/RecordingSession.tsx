'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SwitchCamera } from 'lucide-react'
import type { ThemeDto } from '@lavidz/types'

type Phase = 'intro' | 'check' | 'reading' | 'countdown' | 'recording' | 'review' | 'uploading' | 'done'

function readingDuration(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(3, Math.min(10, Math.ceil(words * 0.45)))
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const MAX_DURATION = 180 // 3 minutes

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
  const [countdown, setCountdown] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [starting, setStarting] = useState(false)
  const [checkError, setCheckError] = useState('')
  const [micLevel, setMicLevel] = useState(0)
  const [introStep, setIntroStep] = useState<1 | 2 | 3 | 4>(1)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [flipping, setFlipping] = useState(false)
  const [connectionQuality, setConnectionQuality] = useState<'checking' | 'excellent' | 'good' | 'fair' | 'poor'>('checking')
  const [micDetected, setMicDetected] = useState(false)
  const [poorConnectionAcknowledged, setPoorConnectionAcknowledged] = useState(false)
  const [reviewVideoUrl, setReviewVideoUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [reviewPaused, setReviewPaused] = useState(false)
  const [confirmLast, setConfirmLast] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState<{ isIOS: boolean; isSafari: boolean } | null>(null)
  const [showMaxDurationWarning, setShowMaxDurationWarning] = useState(false)
  const [feedbackOverall, setFeedbackOverall] = useState(0)
  const [feedbackQuestion, setFeedbackQuestion] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackSending, setFeedbackSending] = useState(false)
  const introAnnouncedRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micRafRef = useRef<number | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null)
  const questionAudioRef = useRef<HTMLAudioElement | null>(null)
  const reviewVideoRef = useRef<HTMLVideoElement | null>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxDurationWarnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const checkVideoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasStreamRef = useRef<MediaStream | null>(null)
  const canvasRafRef = useRef<number | null>(null)
  const facingModeRef = useRef<'user' | 'environment'>('user')

  const QUESTION_VOICE_ID = 'MmafIMKg28Wr0yMh8CEB'

  const announceQuestion = async (text: string) => {
    try {
      questionAudioRef.current?.pause()
      questionAudioRef.current = null
      setIsAudioPlaying(false)
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
      setIsAudioPlaying(true)
      audio.play()
      audio.onended = () => {
        URL.revokeObjectURL(url)
        setIsAudioPlaying(false)
      }
    } catch {}
  }

  const questions = theme.questions ?? []
  const currentQuestion = questions[questionIndex]
  const accent = theme.brandColor ?? '#FF4D1C'

  const stopMicMeter = useCallback(() => {
    if (micRafRef.current) cancelAnimationFrame(micRafRef.current)
    audioContextRef.current?.close()
    audioContextRef.current = null
    setMicLevel(0)
    setMicDetected(false)
  }, [])

  const startMicMeter = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext()
      audioContextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((s, v) => s + v, 0) / data.length
        const level = Math.min(100, Math.round((avg / 128) * 100))
        setMicLevel(level)
        if (level > 0) setMicDetected(true)
        micRafRef.current = requestAnimationFrame(tick)
      }
      micRafRef.current = requestAnimationFrame(tick)
    } catch {
      // AudioContext unavailable — mic meter won't show but check phase still works
    }
  }, [])

  // Keep facingModeRef in sync for RAF loop access
  useEffect(() => { facingModeRef.current = facingMode }, [facingMode])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (elapsedRef.current) clearInterval(elapsedRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current)
      if (maxDurationWarnTimerRef.current) clearTimeout(maxDurationWarnTimerRef.current)
      if (canvasRafRef.current) cancelAnimationFrame(canvasRafRef.current)
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      questionAudioRef.current?.pause()
      stopMicMeter()
    }
  }, [stopMicMeter])

  // Warn user before leaving during recording or upload
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    if (phase === 'recording' || phase === 'uploading') {
      window.addEventListener('beforeunload', warn)
      return () => window.removeEventListener('beforeunload', warn)
    }
  }, [phase])

  // Attach stream to video element whenever a camera phase becomes active
  useEffect(() => {
    if (phase !== 'intro' && phase !== 'done' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.muted = true
    }
  }, [phase])

  // In check phase, the video ref mounts after the render — set srcObject on mount
  const checkVideoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    checkVideoRef.current = el
    if (el && streamRef.current) {
      el.srcObject = streamRef.current
      el.muted = true
    }
  }, [])

  const beginReading = (question: typeof currentQuestion) => {
    setPhase('reading')
    if (question?.text) announceQuestion(question.text)
  }

  const beginCountdown = () => {
    setPhase('countdown')
    setCountdown(3)
    try { navigator.vibrate(80) } catch {}
    let c = 3
    countdownRef.current = setInterval(() => {
      c -= 1
      if (c <= 0) {
        clearInterval(countdownRef.current!)
        doStartRecording()
      } else {
        setCountdown(c)
        try { navigator.vibrate(80) } catch {}
      }
    }, 1000)
  }

  const stopCanvasLoop = useCallback(() => {
    if (canvasRafRef.current) { cancelAnimationFrame(canvasRafRef.current); canvasRafRef.current = null }
  }, [])

  const startCanvasLoop = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const draw = () => {
      if (video.readyState >= 2) {
        ctx.save()
        if (facingModeRef.current === 'user') {
          ctx.translate(canvas.width, 0)
          ctx.scale(-1, 1)
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        ctx.restore()
      }
      canvasRafRef.current = requestAnimationFrame(draw)
    }
    canvasRafRef.current = requestAnimationFrame(draw)
  }, [])

  const doStartRecording = () => {
    if (!streamRef.current || !videoRef.current || !canvasRef.current) return
    try { navigator.vibrate([80, 40, 80]) } catch {}
    chunksRef.current = []
    setElapsed(0)
    setShowMaxDurationWarning(false)
    setPhase('recording')

    // Size canvas to match camera output
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720

    // Canvas stream carries the video frames; add camera's audio track
    const cs = canvas.captureStream(30)
    const audioTrack = streamRef.current.getAudioTracks()[0]
    if (audioTrack) cs.addTrack(audioTrack)
    canvasStreamRef.current = cs

    // Start drawing camera frames to canvas
    startCanvasLoop()

    const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')
      ? 'video/mp4;codecs=avc1,mp4a.40.2'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'
    const recorder = new MediaRecorder(cs, { mimeType })
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      if (chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setReviewVideoUrl(prev => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
      }
    }
    recorder.onerror = () => stopRecording()
    recorder.start(100)
    mediaRecorderRef.current = recorder

    // Stop recording gracefully if camera stream drops (permission revoked, battery, iOS background)
    streamRef.current.getVideoTracks().forEach(t => t.addEventListener('ended', () => stopRecording()))

    elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    maxDurationWarnTimerRef.current = setTimeout(() => {
      setShowMaxDurationWarning(true)
      try { navigator.vibrate([50, 30, 50, 30, 50]) } catch {}
    }, (MAX_DURATION - 30) * 1000)
    maxDurationTimerRef.current = setTimeout(() => stopRecording(), MAX_DURATION * 1000)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    stopCanvasLoop()
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }
    if (maxDurationTimerRef.current) { clearTimeout(maxDurationTimerRef.current); maxDurationTimerRef.current = null }
    if (maxDurationWarnTimerRef.current) { clearTimeout(maxDurationWarnTimerRef.current); maxDurationWarnTimerRef.current = null }
    setShowMaxDurationWarning(false)
    setReviewPaused(false)
    setPhase('review')
  }

  const redo = () => {
    chunksRef.current = []
    setElapsed(0)
    setReviewVideoUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setUploadError('')
    beginReading(currentQuestion)
  }

  const saveAndNext = async () => {
    if (!sessionIdRef.current || !currentQuestion || chunksRef.current.length === 0) return
    setPhase('uploading')
    setUploadError('')
    setUploadProgress(0)

    try {
      const recordedMimeType = mediaRecorderRef.current?.mimeType ?? 'video/webm'
      const blob = new Blob(chunksRef.current, { type: recordedMimeType })

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload failed: ${xhr.status}`))
        }
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.timeout = 10 * 60 * 1000
        xhr.ontimeout = () => reject(new Error('Upload timeout'))
        xhr.open('PUT', `/api/sessions/${sessionIdRef.current}/recordings/${currentQuestion.id}`)
        xhr.setRequestHeader('Content-Type', recordedMimeType)
        xhr.send(blob)
      })

      setReviewVideoUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
      chunksRef.current = []

      if (questionIndex < questions.length - 1) {
        setQuestionIndex((i) => i + 1)
        beginReading(questions[questionIndex + 1])
      } else {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        setPhase('done')
        if (mode === 'shared') handleSubmit()
      }
    } catch {
      setUploadError('Envoi échoué. Vérifiez votre connexion et réessayez.')
      setPhase('review')
    }
  }

  const measureConnection = useCallback(async () => {
    setConnectionQuality('checking')
    try {
      // Try Network Information API first (Chrome/Android)
      const conn = (navigator as any).connection
      if (conn?.effectiveType) {
        const map: Record<string, typeof connectionQuality> = {
          '4g': 'excellent', '3g': 'good', '2g': 'fair', 'slow-2g': 'poor',
        }
        const q = map[conn.effectiveType] ?? 'good'
        setConnectionQuality(q)
        return
      }
    } catch {}

    // Fallback: measure latency with 3 pings to the current origin
    try {
      const pings: number[] = []
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now()
        await fetch(`/?_ping=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
        pings.push(performance.now() - t0)
      }
      const avg = pings.reduce((a, b) => a + b, 0) / pings.length
      if (avg < 100) setConnectionQuality('excellent')
      else if (avg < 300) setConnectionQuality('good')
      else if (avg < 700) setConnectionQuality('fair')
      else setConnectionQuality('poor')
    } catch {
      setConnectionQuality('fair')
    }
  }, [])

  // Detect multiple cameras once (after first permission grant or on mount)
  const detectCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter((d) => d.kind === 'videoinput')
      setHasMultipleCameras(videoInputs.length > 1)
    } catch {}
  }, [])

  const flipCamera = useCallback(async () => {
    if (flipping) return
    setFlipping(true)
    const newFacing = facingMode === 'user' ? 'environment' : 'user'
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
        audio: false,
      })
      const newVideoTrack = newStream.getVideoTracks()[0]
      if (!newVideoTrack || !streamRef.current) return

      // Swap video track in the existing stream
      const oldVideoTrack = streamRef.current.getVideoTracks()[0]
      if (oldVideoTrack) {
        streamRef.current.removeTrack(oldVideoTrack)
        oldVideoTrack.stop()
      }
      streamRef.current.addTrack(newVideoTrack)

      setFacingMode(newFacing)
      // facingModeRef syncs via useEffect → RAF loop adapts mirror automatically

      // Refresh the active video element (preview)
      const activeEl = checkVideoRef.current ?? videoRef.current
      if (activeEl) {
        activeEl.srcObject = null
        activeEl.srcObject = streamRef.current
        activeEl.muted = true
      }
    } catch {}
    setFlipping(false)
  }, [facingMode, flipping])

  const handleStart = async () => {
    if (starting) return
    setStarting(true)
    setCheckError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
      }
      startMicMeter(stream)
      detectCameras()
      measureConnection()
      setPhase('check')
    } catch (err: any) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
      if (denied) {
        const isIOS = /iPhone|iPad/.test(navigator.userAgent)
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
        setPermissionDenied({ isIOS, isSafari })
      } else {
        setCheckError('Impossible d\'accéder à la caméra ou au micro.')
      }
    } finally {
      setStarting(false)
    }
  }

  const handleConfirmStart = async () => {
    stopMicMeter()
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
      beginReading(questions[0])
    } catch (err) {
      console.error(err)
    } finally {
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

  const startRecordingNow = () => {
    questionAudioRef.current?.pause()
    setIsAudioPlaying(false)
    beginCountdown()
  }

  // ─── INTRO ────────────────────────────────────────────────────────────────
  if (phase === 'intro' && permissionDenied) {
    const { isIOS, isSafari } = permissionDenied
    const instructions = isIOS
      ? 'Allez dans Réglages > Safari > Caméra et Micro → Autoriser, puis revenez ici.'
      : isSafari
      ? 'Cliquez sur l\'icône cadenas dans la barre d\'adresse → autorisez caméra et micro.'
      : 'Cliquez sur l\'icône caméra dans la barre d\'adresse → autorisez caméra et micro.'
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-8 gap-6" style={{ background: '#0a0a0a' }}>
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" stroke="#ef4444" strokeWidth="2" />
            <line x1="4" y1="4" x2="20" y2="20" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black text-white mb-3">Accès refusé</h2>
          <p className="text-sm text-white/50 leading-relaxed max-w-xs">{instructions}</p>
        </div>
        <button
          onClick={() => { setPermissionDenied(null); setCheckError('') }}
          className="mt-2 text-sm font-semibold px-6 py-3 rounded-2xl transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          J&apos;ai autorisé — Réessayer
        </button>
      </div>
    )
  }

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
          style={{ background: '#0a0a0a', animation: 'fadeIn 0.35s ease' }}
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
              Voir les conseils →
            </button>
            <p className="text-[10px] font-mono text-white/25 text-center">
              {questions.length} question{questions.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )
    }

    // Step 4: introduction vocale (only if introduction exists)
    if (introStep === 4 && theme.introduction) {
      if (!introAnnouncedRef.current) {
        introAnnouncedRef.current = true
        announceQuestion(theme.introduction)
      }
      return (
        <div
          className="fixed inset-0 flex flex-col items-center justify-between px-6 py-12 overflow-hidden"
          style={{ background: '#0a0a0a', animation: 'fadeIn 0.35s ease' }}
        >
          {noise}
          {/* Back button — top left */}
          <button
            onClick={() => setIntroStep(3)}
            className="absolute top-4 left-4 z-20 flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            aria-label="Retour"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div />

          <div
            className="w-full max-w-sm px-6 py-6 rounded-2xl z-10 text-center"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-base text-white/80 leading-relaxed">{theme.introduction}</p>
          </div>

          <div className="flex flex-col items-center gap-4 z-10 w-full max-w-sm">
            {checkError && (
              <p className="text-xs font-mono text-red-400 text-center">{checkError}</p>
            )}
            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full py-4 rounded-2xl font-bold text-base tracking-wide transition-all active:scale-95 disabled:opacity-60"
              style={{ background: accent, color: '#fff' }}
            >
              {starting ? 'Démarrage...' : 'Ouvrir la caméra →'}
            </button>
          </div>
        </div>
      )
    }

    // Step 3: questions preview
    if (introStep === 3) {
      return (
        <div
          className="fixed inset-0 flex flex-col px-6 overflow-hidden"
          style={{ background: '#0a0a0a', animation: 'fadeIn 0.35s ease', paddingTop: 'max(3rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
        >
          {noise}
          {/* Back button */}
          <button
            onClick={() => setIntroStep(2)}
            className="absolute top-4 left-4 z-20 flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            aria-label="Retour"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Header */}
          <div className="flex flex-col gap-1 z-10 mt-4 mb-6">
            <h2 className="text-2xl font-black text-white">Vos questions</h2>
            <p className="text-sm text-white/40">Prenez le temps de lire avant de commencer</p>
          </div>

          {/* Questions list */}
          <div className="flex flex-col gap-3 z-10 overflow-y-auto flex-1 pb-4">
            {questions.map((q, i) => (
              <div
                key={q.id}
                className="flex items-start gap-4 px-4 py-4 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span
                  className="text-xs font-mono font-bold shrink-0 mt-0.5 tabular-nums"
                  style={{ color: accent }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-sm text-white/90 leading-relaxed">{q.text}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="z-10 pt-4">
            <button
              onClick={() => theme.introduction ? setIntroStep(4) : handleStart()}
              disabled={starting}
              className="w-full py-4 rounded-2xl font-bold text-base tracking-wide transition-all active:scale-95 disabled:opacity-60"
              style={{ background: accent, color: '#fff' }}
            >
              {starting ? 'Démarrage...' : theme.introduction ? 'Écouter l\'introduction →' : 'Ouvrir la caméra →'}
            </button>
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
        style={{ background: '#0a0a0a', animation: 'fadeIn 0.35s ease' }}
      >
        {noise}
        {/* Back button — top left */}
        <button
          onClick={() => setIntroStep(1)}
          className="absolute top-4 left-4 z-20 flex items-center justify-center rounded-full transition-all active:scale-90"
          style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          aria-label="Retour"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
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
            onClick={() => setIntroStep(3)}
            className="w-full py-4 rounded-2xl font-bold text-base tracking-wide transition-all active:scale-95"
            style={{ background: accent, color: '#fff' }}
          >
            Voir les questions →
          </button>
        </div>
      </div>
    )
  }

  // ─── DONE ─────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    // Thank-you screen after submit in shared mode
    if (mode === 'shared' && submitted) {
      const handleFeedbackSubmit = async () => {
        if (!sessionIdRef.current || feedbackOverall === 0 || feedbackQuestion === 0) return
        setFeedbackSending(true)
        try {
          await fetch(`${API}/api/feedbacks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionIdRef.current,
              overallRating: feedbackOverall,
              questionRating: feedbackQuestion,
              comment: feedbackComment || undefined,
            }),
          })
          setFeedbackSent(true)
        } catch {
          setFeedbackSent(true)
        } finally {
          setFeedbackSending(false)
        }
      }

      const StarRow = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">{label}</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onClick={() => onChange(star)}
                className="transition-transform active:scale-90"
                style={{ fontSize: 28, lineHeight: 1, color: star <= value ? '#facc15' : 'rgba(255,255,255,0.15)' }}
              >
                &#9733;
              </button>
            ))}
          </div>
        </div>
      )

      if (feedbackSent) {
        return (
          <div className="fixed inset-0 flex flex-col items-center justify-center gap-8 px-8" style={{ background: '#0a0a0a' }}>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', animation: 'celebrateIcon 0.6s ease forwards' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l4 4 10-10" stroke="rgb(52,211,153)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-center" style={{ opacity: 0, animation: 'fadeSlideIn 0.5s ease 0.3s forwards' }}>
              <h1 className="text-3xl font-black text-white mb-2">Merci !</h1>
              <p className="text-sm text-white/40">Vos réponses et votre retour ont bien été reçus.<br />Vous recevrez un email quand le montage sera prêt.</p>
            </div>
          </div>
        )
      }

      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 px-8 overflow-y-auto" style={{ background: '#0a0a0a', paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', animation: 'celebrateIcon 0.6s ease forwards' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4 4 10-10" stroke="rgb(52,211,153)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-white mb-1">Envoyé !</h1>
            <p className="text-sm text-white/40">Aidez-nous à améliorer l&apos;expérience</p>
          </div>

          <div
            className="w-full max-w-sm flex flex-col gap-5 rounded-2xl p-5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <StarRow label="Expérience globale" value={feedbackOverall} onChange={setFeedbackOverall} />
            <StarRow label="Qualité des questions" value={feedbackQuestion} onChange={setFeedbackQuestion} />

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Commentaire (optionnel)</span>
              <textarea
                value={feedbackComment}
                onChange={e => setFeedbackComment(e.target.value)}
                placeholder="Des suggestions pour améliorer ?"
                rows={3}
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:ring-1"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>

            <button
              onClick={handleFeedbackSubmit}
              disabled={feedbackOverall === 0 || feedbackQuestion === 0 || feedbackSending}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.97] disabled:opacity-40"
              style={{ background: accent, color: '#fff' }}
            >
              {feedbackSending ? 'Envoi…' : 'Envoyer mon retour'}
            </button>

            <button
              onClick={() => setFeedbackSent(true)}
              className="text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Passer
            </button>
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
          style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', animation: 'celebrateIcon 0.6s ease forwards' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l4 4 10-10" stroke="rgb(52,211,153)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-center" style={{ opacity: 0, animation: 'fadeSlideIn 0.5s ease 0.3s forwards' }}>
          <h1 className="text-3xl font-black text-white mb-2">Dans la boîte.</h1>
          <p className="text-sm text-white/40">Toutes vos réponses ont été enregistrées.</p>
        </div>
        {mode === 'shared' ? (
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full border-2 shrink-0"
              style={{ borderColor: `${accent} transparent ${accent} transparent`, animation: 'spin 0.8s linear infinite' }}
            />
            <span className="text-white/40 text-sm font-mono">Envoi en cours…</span>
          </div>
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

  // ─── CHECK PHASE ──────────────────────────────────────────────────────────
  if (phase === 'check') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6 overflow-hidden" style={{ background: '#0a0a0a', animation: 'fadeIn 0.35s ease', paddingTop: 'max(3rem, env(safe-area-inset-top))', paddingBottom: 'max(3rem, env(safe-area-inset-bottom))' }}>
        {/* Back button — top left */}
        <button
          onClick={() => {
            stopMicMeter()
            streamRef.current?.getTracks().forEach(t => t.stop())
            streamRef.current = null
            setPhase('intro')
          }}
          className="absolute top-4 left-4 z-20 flex items-center justify-center rounded-full transition-all active:scale-90"
          style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          aria-label="Retour"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex flex-col items-center gap-6 w-full max-w-sm z-10">
          {/* Camera preview */}
          <div className="relative w-full rounded-2xl overflow-hidden bg-black border border-white/10" style={{ aspectRatio: '4/3' }}>
            <video
              ref={checkVideoCallbackRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
            <div className="absolute top-3 left-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-mono text-white/60 uppercase tracking-widest">Prévisualisation</span>
            </div>
            {hasMultipleCameras && (
              <button
                onClick={flipCamera}
                disabled={flipping}
                className="absolute top-3 right-3 flex items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-40"
                style={{ width: 36, height: 36, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}
                title="Changer de caméra"
              >
                <SwitchCamera size={18} style={{ opacity: flipping ? 0.4 : 1, transition: 'transform 0.3s', transform: flipping ? 'rotate(180deg)' : 'none' }} />
              </button>
            )}
          </div>

          {/* Mic meter */}
          {(() => {
            const needsPrompt = !!streamRef.current && !micDetected
            return (
              <div
                className="w-full flex flex-col gap-2 rounded-xl px-3 py-3 transition-all"
                style={needsPrompt ? { border: `1px solid ${accent}50`, background: `${accent}0d` } : {}}
              >
                <p
                  className="text-[10px] font-mono uppercase tracking-widest"
                  style={{ color: needsPrompt ? accent : 'rgba(255,255,255,0.4)', animation: needsPrompt ? 'recPulse 1.5s ease-in-out infinite' : 'none' }}
                >
                  Micro
                </p>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-75"
                    style={{
                      width: `${micLevel}%`,
                      background: micLevel > 70 ? '#ef4444' : micLevel > 30 ? accent : '#4ade80',
                    }}
                  />
                </div>
                <p
                  className="text-[10px] font-mono"
                  style={{ color: needsPrompt ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}
                >
                  {micLevel === 0 ? 'Parlez pour tester le micro…' : micLevel > 70 ? 'Niveau élevé' : 'Micro détecté ✓'}
                </p>
              </div>
            )
          })()}

          {/* Connection quality */}
          {(() => {
            const map = {
              checking: { label: 'Mesure en cours…', color: 'rgba(255,255,255,0.2)', bars: [1, 0, 0, 0] },
              poor:     { label: 'Connexion faible', color: '#ef4444', bars: [1, 0, 0, 0] },
              fair:     { label: 'Connexion moyenne', color: '#f59e0b', bars: [1, 1, 0, 0] },
              good:     { label: 'Bonne connexion', color: '#4ade80', bars: [1, 1, 1, 0] },
              excellent:{ label: 'Excellente connexion', color: '#4ade80', bars: [1, 1, 1, 1] },
            }
            const q = map[connectionQuality]
            return (
              <div className="w-full flex flex-col gap-2">
                <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Connexion</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-end gap-[3px]">
                    {q.bars.map((active, i) => (
                      <div
                        key={i}
                        className="rounded-sm transition-all duration-300"
                        style={{
                          width: 5,
                          height: 6 + i * 4,
                          background: active ? q.color : 'rgba(255,255,255,0.1)',
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] font-mono" style={{ color: q.color }}>{q.label}</p>
                </div>
              </div>
            )
          })()}

          {/* Blocking warnings */}
          {!streamRef.current && (
            <div className="w-full px-4 py-3 rounded-2xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <span className="text-red-400 mt-0.5 shrink-0">⚠️</span>
              <p className="text-xs text-red-300 font-mono leading-relaxed">Caméra ou micro non disponible. Vérifiez les autorisations dans les réglages de votre navigateur.</p>
            </div>
          )}
          {streamRef.current && !micDetected && (
            <div className="w-full px-4 py-3 rounded-2xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <span className="text-red-400 mt-0.5 shrink-0">⚠️</span>
              <p className="text-xs text-red-300 font-mono leading-relaxed">Micro non détecté. Parlez pour vérifier que votre micro fonctionne avant de continuer.</p>
            </div>
          )}

          {/* Non-blocking poor connection warning */}
          {connectionQuality === 'poor' && !poorConnectionAcknowledged && (
            <div className="w-full px-4 py-3 rounded-2xl flex items-start gap-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <span className="text-amber-400 mt-0.5 shrink-0">⚠️</span>
              <div className="flex flex-col gap-2 flex-1">
                <p className="text-xs text-amber-300 font-mono leading-relaxed">Connexion faible détectée. La qualité de votre enregistrement risque d'être affectée (coupures, lenteur d'upload).</p>
                <button
                  onClick={() => setPoorConnectionAcknowledged(true)}
                  className="self-start text-[10px] font-mono text-amber-400 underline underline-offset-2"
                >
                  Je comprends, continuer quand même
                </button>
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleConfirmStart}
            disabled={starting || !streamRef.current || !micDetected || (connectionQuality === 'poor' && !poorConnectionAcknowledged)}
            className="w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: accent, color: '#fff' }}
          >
            {starting ? 'Démarrage…' : 'Tout est bon — Commencer'}
          </button>

        </div>
      </div>
    )
  }

  // ─── CAMERA PHASES (reading / countdown / recording / review / uploading) ──
  const isReading = phase === 'reading'
  const isCountdown = phase === 'countdown'
  const isRecording = phase === 'recording'
  const isReview = phase === 'review'
  const isUploading = phase === 'uploading'

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#000' }}>
      {/* Hidden canvas — intermediate stream for MediaRecorder (continuous multi-camera) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
      />

      {/* Gradient overlays (not during reading — it has its own dark overlay) */}
      {!isReading && (
        <>
          <div
            className="absolute inset-x-0 top-0 h-48 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)' }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-56 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
          />
        </>
      )}

      {/* Reading: dark overlay */}
      {isReading && (
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.72)', zIndex: 2 }} />
      )}

      {/* Reading: question centered over camera */}
      {isReading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center px-8 gap-5 pointer-events-none"
          style={{ zIndex: 3 }}
        >
          <p className="text-xs font-mono uppercase tracking-widest" style={{ color: accent }}>
            Question {String(questionIndex + 1).padStart(2, '0')} / {questions.length}
          </p>
          <h1
            key={questionIndex}
            className="text-white font-black text-3xl leading-tight tracking-tight text-center max-w-sm"
            style={{ animation: 'fadeSlideIn 0.5s ease forwards' }}
          >
            {currentQuestion?.text}
          </h1>
          {currentQuestion?.hint && (
            <p className="text-white/40 text-sm text-center max-w-xs leading-relaxed">
              {currentQuestion.hint}
            </p>
          )}
          <div className="flex flex-col items-center gap-2 mt-1">
            {isAudioPlaying ? (
              <>
                <div className="flex items-end gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 4,
                        height: 16,
                        borderRadius: 2,
                        background: accent,
                        animation: 'wave 0.8s ease-in-out infinite',
                        animationDelay: `${i * 0.18}s`,
                      }}
                    />
                  ))}
                </div>
                <p className="text-white/40 text-xs font-mono">Écoute en cours…</p>
              </>
            ) : (
              <p className="text-white/40 text-xs font-mono">Prêt à répondre</p>
            )}
          </div>
        </div>
      )}

      {/* Top: progress + question card (slides in after reading, stays during countdown/recording) */}
      {!isReading && (
        <div className="absolute inset-x-0 top-0 px-5 flex flex-col gap-4" style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))', zIndex: 10 }}>
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

          {/* Question card — animates in from below when reading ends */}
          <div
            className="rounded-2xl px-4 py-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', animation: 'fadeSlideIn 0.4s ease forwards' }}
          >
            <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: accent }}>
              Question {String(questionIndex + 1).padStart(2, '0')}
            </p>
            <p
              key={questionIndex}
              className="text-white font-bold text-base leading-snug"
            >
              {currentQuestion?.text}
            </p>
            {currentQuestion?.hint && (
              <p className="text-white/40 text-xs mt-2 leading-relaxed">{currentQuestion.hint}</p>
            )}
          </div>
        </div>
      )}

      {/* Countdown overlay */}
      {isCountdown && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ animation: 'fadeIn 0.2s ease' }}
        >
          <div
            key={countdown}
            className="text-white font-black leading-none"
            style={{ fontSize: 120, animation: 'countPop 0.8s ease forwards', textShadow: '0 0 40px rgba(255,255,255,0.3)' }}
          >
            {countdown}
          </div>
        </div>
      )}

      {/* Recording indicator — top-right badge */}
      {isRecording && (
        <div
          className="absolute flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ zIndex: 11, top: 'max(1rem, env(safe-area-inset-top))', right: '1rem', background: 'rgba(0,0,0,0.5)' }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444', animation: 'recPulse 1.2s ease-in-out infinite' }} />
          <span className="text-white text-[11px] font-mono font-semibold tracking-wider">REC</span>
        </div>
      )}

      {/* Review overlay */}
      {isReview && reviewVideoUrl ? (
        <div
          className="absolute inset-0 bg-black"
          style={{ zIndex: 1 }}
          onClick={() => {
            const v = reviewVideoRef.current
            if (!v) return
            if (v.paused) { v.play(); setReviewPaused(false) }
            else { v.pause(); setReviewPaused(true) }
          }}
        >
          <video
            ref={reviewVideoRef}
            src={reviewVideoUrl}
            playsInline
            autoPlay
            className="w-full h-full object-contain"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />
          {reviewPaused && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      ) : (isReview || isUploading) ? (
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        />
      ) : null}

      {/* Bottom controls */}
      <div key={phase} className="absolute inset-x-0 bottom-0 px-6 flex flex-col items-center gap-6" style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom))', zIndex: 10, animation: 'fadeIn 0.3s ease' }}>

        {/* Reading: Je suis prêt */}
        {isReading && (
          <button
            onClick={startRecordingNow}
            className="px-8 py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.18)' }}
          >
            Je suis prêt →
          </button>
        )}

        {/* REC timer */}
        {isRecording && (
          <div className="flex flex-col items-center gap-2">
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
            {showMaxDurationWarning && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)' }}
              >
                <span className="text-amber-400 text-xs font-mono">30s restantes</span>
              </div>
            )}
          </div>
        )}

        {/* Review duration */}
        {(isReview || isUploading) && (
          <p className="text-white/50 text-xs font-mono">{formatTime(elapsed)} enregistré</p>
        )}

        {uploadError && (
          <div className="w-full max-w-sm px-4 py-3 rounded-2xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <span className="text-red-400 mt-0.5 shrink-0 text-xs">⚠</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-red-300 font-mono leading-relaxed">{uploadError}</p>
            </div>
          </div>
        )}

        {/* Record / Stop button + camera flip */}
        {(isCountdown || isRecording) && (
          <div className="flex items-center gap-6">
            {/* Spacer to keep record button centered when flip is visible */}
            {hasMultipleCameras && <div style={{ width: 52 }} />}

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

            {/* Flip camera — right of record button */}
            {hasMultipleCameras && (
              <button
                onClick={flipCamera}
                disabled={flipping || isCountdown}
                className="flex flex-col items-center justify-center gap-1 rounded-full transition-all active:scale-90 disabled:opacity-40"
                style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.1)', border: `1px solid ${facingMode === 'environment' ? `${accent}60` : 'rgba(255,255,255,0.15)'}` }}
                title="Changer de caméra"
              >
                <SwitchCamera size={18} style={{ opacity: flipping ? 0.4 : 1, transition: 'transform 0.3s', transform: flipping ? 'rotate(180deg)' : 'none' }} />
                <span className="text-[8px] font-mono text-white/60 leading-none">
                  {facingMode === 'user' ? 'Selfie' : 'Dos'}
                </span>
              </button>
            )}
          </div>
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
              onClick={() => {
                if (!uploadError && questionIndex === questions.length - 1 && !confirmLast) {
                  setConfirmLast(true)
                  confirmTimerRef.current = setTimeout(() => setConfirmLast(false), 3000)
                  return
                }
                setConfirmLast(false)
                saveAndNext()
              }}
              className="flex-[2] py-4 rounded-2xl font-bold text-sm transition-all active:scale-95"
              style={{ background: confirmLast ? '#f59e0b' : accent, color: '#fff' }}
            >
              {uploadError ? 'Réessayer l\'envoi' : confirmLast ? 'Confirmer l\'envoi ?' : questionIndex < questions.length - 1 ? 'Continuer →' : 'Terminer ✓'}
            </button>
          </div>
        )}

        {/* Uploading */}
        {isUploading && (
          <div className="w-full max-w-sm flex flex-col gap-2">
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%`, background: accent }}
              />
            </div>
            {uploadProgress < 100 ? (
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-xs font-mono">Envoi en cours…</span>
                <span className="text-white/50 text-xs font-mono tabular-nums">{uploadProgress}%</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full border-2 shrink-0"
                  style={{ borderColor: `${accent} transparent ${accent} transparent`, animation: 'spin 0.8s linear infinite' }}
                />
                <span className="text-white/50 text-xs font-mono">Traitement en cours…</span>
              </div>
            )}
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
        @keyframes wave {
          0%, 100% { transform: scaleY(0.4); opacity: 0.6; }
          50% { transform: scaleY(1.4); opacity: 1; }
        }
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
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes celebrateIcon {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  )
}
