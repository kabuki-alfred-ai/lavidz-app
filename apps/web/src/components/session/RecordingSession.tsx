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

type VideoQuality = '480p' | '720p' | '1080p'
const VIDEO_PRESETS: Record<VideoQuality, { label: string; width: number; height: number; bitrate: number; hint: string }> = {
  '480p':  { label: '480p',  width: 854,  height: 480,  bitrate: 1_000_000, hint: 'Upload rapide' },
  '720p':  { label: '720p',  width: 1280, height: 720,  bitrate: 2_500_000, hint: 'Recommandé' },
  '1080p': { label: '1080p', width: 1920, height: 1080, bitrate: 5_000_000, hint: 'Haute qualité' },
}

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
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [selectedAudioId, setSelectedAudioId] = useState('')
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
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('1080p')
  const [openPicker, setOpenPicker] = useState<'video' | 'audio' | null>(null)
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

    // Size canvas to match camera output (preserve actual aspect ratio — mobile can be portrait)
    const video = videoRef.current
    const canvas = canvasRef.current
    const preset = VIDEO_PRESETS[videoQuality]
    const vw = video.videoWidth || preset.width
    const vh = video.videoHeight || preset.height
    // Scale down to preset bounds while preserving aspect ratio
    const scale = Math.min(preset.width / vw, preset.height / vh, 1)
    canvas.width = Math.round(vw * scale)
    canvas.height = Math.round(vh * scale)

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
    const recorder = new MediaRecorder(cs, { mimeType, videoBitsPerSecond: preset.bitrate })
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

      // 1. Obtenir la presigned PUT URL (via proxy Next.js → NestJS)
      const urlRes = await fetch(
        `/api/sessions/${sessionIdRef.current}/recordings/${currentQuestion.id}?mimeType=${encodeURIComponent(recordedMimeType)}`,
      )
      if (!urlRes.ok) throw new Error('Failed to get upload URL')
      const { url, key } = await urlRes.json()

      // 2. Upload direct vers MinIO (aucun passage par Next.js)
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
        xhr.open('PUT', url)
        xhr.setRequestHeader('Content-Type', recordedMimeType)
        xhr.send(blob)
      })

      // 3. Confirmer les métadonnées côté backend (via proxy Next.js)
      await fetch(`/api/sessions/${sessionIdRef.current}/recordings/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: currentQuestion.id, key, mimeType: recordedMimeType }),
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
  const detectDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter(d => d.kind === 'videoinput')
      const audioInputs = devices.filter(d => d.kind === 'audioinput')
      setHasMultipleCameras(videoInputs.length > 1)
      setVideoDevices(videoInputs)
      setAudioDevices(audioInputs)
      // Sync selected IDs with the currently active tracks
      const videoTrack = streamRef.current?.getVideoTracks()[0]
      const audioTrack = streamRef.current?.getAudioTracks()[0]
      if (videoTrack) setSelectedVideoId(videoTrack.getSettings().deviceId ?? videoInputs[0]?.deviceId ?? '')
      if (audioTrack) setSelectedAudioId(audioTrack.getSettings().deviceId ?? audioInputs[0]?.deviceId ?? '')
    } catch {}
  }, [])

  const flipCamera = useCallback(async () => {
    if (flipping) return
    setFlipping(true)
    const newFacing = facingMode === 'user' ? 'environment' : 'user'
    try {
      const preset = VIDEO_PRESETS[videoQuality]
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacing,
          width: { ideal: preset.width },
          height: { ideal: preset.height },
        },
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

  const switchVideoDevice = useCallback(async (deviceId: string) => {
    if (!streamRef.current) return
    try {
      const preset = VIDEO_PRESETS[videoQuality]
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: preset.width }, height: { ideal: preset.height } },
        audio: false,
      })
      const newTrack = newStream.getVideoTracks()[0]
      if (!newTrack) return
      const oldTrack = streamRef.current.getVideoTracks()[0]
      if (oldTrack) { streamRef.current.removeTrack(oldTrack); oldTrack.stop() }
      streamRef.current.addTrack(newTrack)
      setSelectedVideoId(deviceId)
      const el = checkVideoRef.current ?? videoRef.current
      if (el) { el.srcObject = null; el.srcObject = streamRef.current; el.muted = true }
    } catch {}
  }, [videoQuality])

  const switchAudioDevice = useCallback(async (deviceId: string) => {
    if (!streamRef.current) return
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false,
      })
      const newTrack = newStream.getAudioTracks()[0]
      if (!newTrack) return
      const oldTrack = streamRef.current.getAudioTracks()[0]
      if (oldTrack) { streamRef.current.removeTrack(oldTrack); oldTrack.stop() }
      streamRef.current.addTrack(newTrack)
      setSelectedAudioId(deviceId)
      setMicDetected(false)
      setMicLevel(0)
      stopMicMeter()
      startMicMeter(streamRef.current)
    } catch {}
  }, [stopMicMeter, startMicMeter])

  const handleStart = async () => {
    if (starting) return
    setStarting(true)
    setCheckError('')
    try {
      const preset = VIDEO_PRESETS[videoQuality]
      const audioConstraint: MediaTrackConstraints = selectedAudioId
        ? { deviceId: { exact: selectedAudioId } }
        : true as unknown as MediaTrackConstraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: preset.width },
          height: { ideal: preset.height },
        },
        audio: audioConstraint,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
      }
      startMicMeter(stream)
      detectDevices()
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
          <div className="flex items-center gap-1.5 group cursor-pointer">
            <div className="relative w-6 h-6 flex items-center justify-center">
              <span className="block w-3 h-3 bg-primary animate-logo-morph shadow-[0_0_10px_rgba(var(--primary),0.2)]" />
            </div>
            <span className="font-sans font-black text-lg tracking-tighter text-white uppercase">
              {theme.brandName ?? 'LAVIDZ'}
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
                <p className="text-base text-white/70 leading-relaxed">
                  {theme.description}
                </p>
              )}
            </div>

            <p className="text-base text-white/60 leading-relaxed">
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
            onClick={() => setIntroStep(2)}
            className="absolute top-4 left-4 z-20 flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            aria-label="Retour"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div />

          <div className="w-full max-w-sm px-6 z-10 text-center">
            <p className="text-2xl font-semibold text-white leading-snug tracking-tight">{theme.introduction}</p>
          </div>

          <div className="flex flex-col items-center gap-4 z-10 w-full max-w-sm">
            {checkError && (
              <p className="text-xs font-mono text-red-400 text-center">{checkError}</p>
            )}
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
            onClick={() => theme.introduction ? setIntroStep(4) : setIntroStep(2)}
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
          <div className="relative flex-1 min-h-0 z-10">
            <div className="flex flex-col gap-14 overflow-y-auto h-full pt-8 pb-24">
              {questions.map((q, i) => (
                <div key={q.id} className="flex items-start gap-4">
                  <span
                    className="text-xs font-mono font-bold shrink-0 mt-1 tabular-nums"
                    style={{ color: accent }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-xl font-semibold text-white leading-snug tracking-tight">{q.text}</p>
                </div>
              ))}
            </div>
            {/* Bottom fade */}
            <div className="absolute bottom-0 inset-x-0 h-20 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent, #0a0a0a)' }} />
          </div>

          {/* CTA */}
          <div className="z-10 pt-4">
            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full py-4 rounded-2xl font-bold text-base tracking-wide transition-all active:scale-95 disabled:opacity-60"
              style={{ background: accent, color: '#fff' }}
            >
              {starting ? 'Démarrage...' : 'Tester le matériel →'}
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

        <div className="flex flex-col gap-8 z-10 w-full max-w-sm flex-1 min-h-0 pt-8">
          <div className="shrink-0">
            <h2 className="text-3xl font-black text-white mb-2">Avant de commencer</h2>
            <p className="text-base text-white/40">Quelques conseils pour une vidéo de qualité</p>
          </div>
          
          <div className="relative flex-1 min-h-0">
            <div className="flex flex-col gap-8 overflow-y-auto h-full py-4 pb-32 scrollbar-hide">
              {tips.map((tip) => (
                <div key={tip.title} className="flex items-start gap-5">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {tip.icon}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white leading-tight mb-1">{tip.title}</p>
                    <p className="text-sm text-white/50 leading-relaxed">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Gradient sombre vers le bouton */}
            <div className="absolute bottom-0 inset-x-0 h-40 pointer-events-none bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent z-10" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 z-10 w-full max-w-sm">
          <button
            onClick={() => theme.introduction ? setIntroStep(4) : setIntroStep(3)}
            className="w-full py-4 rounded-2xl font-bold text-base tracking-wide transition-all active:scale-95"
            style={{ background: accent, color: '#fff' }}
          >
            {theme.introduction ? 'Écouter l\'introduction →' : 'Voir les questions →'}
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

      // Écran final après envoi du feedback
      if (feedbackSent) {
        return (
          <div
            className="fixed inset-0 flex flex-col items-center justify-center gap-8 px-8"
            style={{ background: '#0a0a0a' }}
          >
            <style>{`
              @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
              @keyframes celebrateIcon { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
            `}</style>
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', animation: 'celebrateIcon 0.6s ease forwards' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l4 4 10-10" stroke="rgb(52,211,153)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-center" style={{ opacity: 0, animation: 'fadeSlideIn 0.5s ease 0.3s forwards' }}>
              <h1 className="text-4xl font-black text-white mb-3">Merci !</h1>
              <p className="text-base text-white/40 leading-relaxed">Vos réponses et votre retour<br />ont bien été reçus.</p>
            </div>
          </div>
        )
      }

      // Formulaire feedback mobile-first
      return (
        <div
          className="fixed inset-0 flex flex-col"
          style={{
            background: '#0a0a0a',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {/* Header fixe */}
          <div className="flex flex-col items-center gap-4 pt-10 pb-6 px-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l4 4 10-10" stroke="rgb(52,211,153)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black text-white">Envoyé !</h1>
              <p className="text-sm text-white/40 mt-1">Quelques secondes pour nous aider à m&apos;améliorer&nbsp;?</p>
            </div>
          </div>

          {/* Contenu scrollable */}
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="flex flex-col gap-6 max-w-sm mx-auto">

              {/* Note globale */}
              <div
                className="flex flex-col gap-4 rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p className="text-sm font-bold text-white">Comment s&apos;est passée l&apos;expérience globale ?</p>
                <div className="flex justify-between gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackOverall(star)}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all active:scale-90"
                      style={{
                        background: feedbackOverall === star ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${feedbackOverall === star ? 'rgba(250,204,21,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      <span style={{ fontSize: 32, lineHeight: 1, color: feedbackOverall >= star ? '#facc15' : 'rgba(255,255,255,0.15)' }}>★</span>
                      <span className="text-[10px] font-mono" style={{ color: feedbackOverall === star ? '#facc15' : 'rgba(255,255,255,0.25)' }}>
                        {star === 1 ? 'Mauvais' : star === 2 ? 'Moyen' : star === 3 ? 'Bien' : star === 4 ? 'Super' : 'Parfait'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Qualité des questions */}
              <div
                className="flex flex-col gap-4 rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p className="text-sm font-bold text-white">Les questions étaient pertinentes ?</p>
                <div className="flex justify-between gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackQuestion(star)}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all active:scale-90"
                      style={{
                        background: feedbackQuestion === star ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${feedbackQuestion === star ? 'rgba(250,204,21,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      <span style={{ fontSize: 32, lineHeight: 1, color: feedbackQuestion >= star ? '#facc15' : 'rgba(255,255,255,0.15)' }}>★</span>
                      <span className="text-[10px] font-mono" style={{ color: feedbackQuestion === star ? '#facc15' : 'rgba(255,255,255,0.25)' }}>
                        {star === 1 ? 'Non' : star === 2 ? 'Peu' : star === 3 ? 'Oui' : star === 4 ? 'Très' : 'Top !'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Commentaire */}
              <div
                className="flex flex-col gap-3 rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p className="text-sm font-bold text-white">Un commentaire ? <span className="font-normal text-white/40">(optionnel)</span></p>
                <textarea
                  value={feedbackComment}
                  onChange={e => setFeedbackComment(e.target.value)}
                  placeholder="Des suggestions pour améliorer…"
                  rows={4}
                  className="w-full rounded-xl px-4 py-3 text-base text-white placeholder-white/25 resize-none focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    fontSize: 16, // évite le zoom iOS
                  }}
                />
              </div>

            </div>
          </div>

          {/* CTA fixe en bas */}
          <div
            className="px-6 pt-4 pb-6 flex flex-col gap-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)' }}
          >
            <div className="max-w-sm mx-auto w-full flex flex-col gap-3">
              <button
                onClick={handleFeedbackSubmit}
                disabled={feedbackOverall === 0 || feedbackQuestion === 0 || feedbackSending}
                className="w-full font-black text-base tracking-wide transition-all active:scale-[0.97] disabled:opacity-30"
                style={{ background: accent, color: '#fff', padding: '18px 24px', borderRadius: 16 }}
              >
                {feedbackSending ? 'Envoi en cours…' : 'Envoyer mon retour'}
              </button>
              <button
                onClick={() => setFeedbackSent(true)}
                className="w-full font-medium text-sm transition-all active:scale-[0.97]"
                style={{ color: 'rgba(255,255,255,0.25)', padding: '14px 24px' }}
              >
                Passer
              </button>
            </div>
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
    const currentVideoLabel = videoDevices.find(d => d.deviceId === selectedVideoId)?.label || 'Caméra'
    const currentAudioLabel = audioDevices.find(d => d.deviceId === selectedAudioId)?.label || 'Micro'

    return (
      <div
        className="fixed inset-0 flex flex-col"
        style={{ background: '#0a0a0a', animation: 'fadeIn 0.35s ease', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={() => setOpenPicker(null)}
      >
        {/* Back button */}
        <button
          onClick={e => {
            e.stopPropagation()
            stopMicMeter()
            streamRef.current?.getTracks().forEach(t => t.stop())
            streamRef.current = null
            setPhase('intro')
          }}
          className="absolute z-30 flex items-center justify-center rounded-full transition-all active:scale-90"
          style={{ top: 'max(1rem, env(safe-area-inset-top))', left: '1rem', width: 44, height: 44, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
          aria-label="Retour"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Camera preview — takes most of screen */}
        <div className="relative flex-1 overflow-hidden bg-black">
          <video
            ref={checkVideoCallbackRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />

          {/* Connection quality — top-right */}
          {(() => {
            const cfg = {
              checking:  { bars: 1, color: 'rgba(255,255,255,0.35)' },
              poor:      { bars: 1, color: '#ef4444' },
              fair:      { bars: 2, color: '#f59e0b' },
              good:      { bars: 3, color: '#4ade80' },
              excellent: { bars: 4, color: '#4ade80' },
            }[connectionQuality] ?? { bars: 1, color: 'rgba(255,255,255,0.35)' }
            return (
              <div
                className="absolute top-3 right-3 flex items-end gap-[3px] px-2.5 py-2 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {[1,2,3,4].map(i => (
                  <div
                    key={i}
                    style={{
                      width: 4,
                      height: 5 + i * 4,
                      borderRadius: 2,
                      background: i <= cfg.bars ? cfg.color : 'rgba(255,255,255,0.18)',
                      transition: 'background 0.3s',
                    }}
                  />
                ))}
              </div>
            )
          })()}

          {/* No camera overlay */}
          {!streamRef.current && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: 'rgba(0,0,0,0.7)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5">
                <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                <line x1="1" y1="1" x2="23" y2="23" stroke="#ef4444" strokeWidth="2"/>
              </svg>
              <p className="text-xs text-white/40 text-center px-8">Accès caméra refusé.<br/>Vérifiez les autorisations du navigateur.</p>
            </div>
          )}

          {/* Device controls bar — overlaid at bottom of preview */}
          <div
            className="absolute bottom-0 inset-x-0 flex items-center gap-2 px-4 py-4"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Mic button */}
            <div className="relative flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setOpenPicker(p => p === 'audio' ? null : 'audio')}
                className="w-full min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all active:scale-95 overflow-hidden"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: `1px solid ${openPicker === 'audio' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)'}` }}
              >
                {/* Mic icon + level */}
                <div className="relative shrink-0 flex items-center justify-center" style={{ width: 20, height: 20 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={micLevel > 0 ? 'white' : 'rgba(255,255,255,0.4)'} strokeWidth="2" strokeLinecap="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                  {micLevel > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: micLevel > 70 ? '#ef4444' : '#4ade80' }} />
                  )}
                </div>
                <span className="flex-1 min-w-0 text-xs text-white/70 truncate text-left">{currentAudioLabel.replace(/\(.*\)/, '').trim()}</span>
                {audioDevices.length > 1 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                )}
              </button>

              {/* Mic picker dropdown */}
              {openPicker === 'audio' && audioDevices.length > 1 && (
                <div
                  className="absolute bottom-full mb-2 left-0 right-0 rounded-xl overflow-hidden z-20"
                  style={{ background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  {audioDevices.map((d, i) => (
                    <button
                      key={d.deviceId}
                      type="button"
                      onClick={() => { switchAudioDevice(d.deviceId); setOpenPicker(null) }}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-all active:scale-[0.98] text-left"
                      style={{ borderBottom: i < audioDevices.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                    >
                      <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center" style={{ background: selectedAudioId === d.deviceId ? accent : 'rgba(255,255,255,0.15)' }}>
                        {selectedAudioId === d.deviceId && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="text-sm truncate" style={{ color: selectedAudioId === d.deviceId ? 'white' : 'rgba(255,255,255,0.6)' }}>
                        {d.label || `Micro ${i + 1}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Camera button */}
            {videoDevices.length > 0 && (
              <div className="relative flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setOpenPicker(p => p === 'video' ? null : 'video')}
                  className="w-full min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all active:scale-95 overflow-hidden"
                  style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: `1px solid ${openPicker === 'video' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)'}` }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                    <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                  <span className="flex-1 min-w-0 text-xs text-white/70 truncate text-left">{currentVideoLabel.replace(/\(.*\)/, '').trim()}</span>
                  {videoDevices.length > 1 && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  )}
                </button>

                {/* Camera picker dropdown */}
                {openPicker === 'video' && videoDevices.length > 1 && (
                  <div
                    className="absolute bottom-full mb-2 left-0 right-0 rounded-xl overflow-hidden z-20"
                    style={{ background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    {videoDevices.map((d, i) => (
                      <button
                        key={d.deviceId}
                        type="button"
                        onClick={() => { switchVideoDevice(d.deviceId); setOpenPicker(null) }}
                        className="w-full flex items-center gap-3 px-4 py-3 transition-all active:scale-[0.98] text-left"
                        style={{ borderBottom: i < videoDevices.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                      >
                        <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center" style={{ background: selectedVideoId === d.deviceId ? accent : 'rgba(255,255,255,0.15)' }}>
                          {selectedVideoId === d.deviceId && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="text-sm truncate" style={{ color: selectedVideoId === d.deviceId ? 'white' : 'rgba(255,255,255,0.6)' }}>
                          {d.label || `Caméra ${i + 1}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar — CTA */}
        <div className="px-5 pt-4 pb-5 flex flex-col gap-2">
          {/* Blocking reason hint */}
          {(() => {
            if (!streamRef.current)
              return <p className="text-center text-xs text-red-400/80">Caméra ou micro inaccessible — vérifiez les autorisations</p>
            if (!micDetected)
              return <p className="text-center text-xs text-white/40">Parlez quelques mots pour valider votre micro</p>
            if (connectionQuality === 'poor')
              return (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-amber-400/80">Connexion faible détectée</span>
                  <button
                    onClick={() => setPoorConnectionAcknowledged(true)}
                    className="text-xs text-white/30 underline underline-offset-2"
                  >
                    Continuer quand même
                  </button>
                </div>
              )
            return null
          })()}
          <button
            onClick={handleConfirmStart}
            disabled={starting || !streamRef.current || !micDetected || (connectionQuality === 'poor' && !poorConnectionAcknowledged)}
            className="w-full font-black text-base tracking-wide transition-all active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: accent, color: '#fff', padding: '18px 24px', borderRadius: 16 }}
          >
            {starting ? 'Démarrage…' : 'C\'est parti →'}
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
          <>
            <style>{`
              @keyframes readyPop {
                0%   { transform: scale(0.85); opacity: 0; }
                60%  { transform: scale(1.08); opacity: 1; }
                80%  { transform: scale(0.96); }
                100% { transform: scale(1); }
              }
              @keyframes readyPulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.25); }
                50%       { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
              }
            `}</style>
            <button
              key={isAudioPlaying ? 'loading' : 'ready'}
              onClick={startRecordingNow}
              disabled={isAudioPlaying}
              className="px-8 py-4 rounded-2xl font-semibold text-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(255,255,255,0.18)',
                animation: isAudioPlaying
                  ? 'none'
                  : 'readyPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards, readyPulse 2s ease-in-out 0.5s infinite',
              }}
            >
              {isAudioPlaying ? 'Lecture en cours...' : 'Je suis prêt →'}
            </button>
          </>
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
