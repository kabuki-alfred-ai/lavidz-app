'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

type CheckStatus = 'good' | 'warning' | 'bad' | 'checking'

interface Props {
  stream: MediaStream | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  onReady: () => void
  accentColor?: string
  /** Continuous mic level (0-100) from parent */
  micLevel?: number
  /** Whether the mic has been detected by the parent */
  micDetected?: boolean
}

const STATUS_CONFIG = {
  good: { color: '#22c55e', icon: '✓' },
  warning: { color: '#f59e0b', icon: '⚠' },
  bad: { color: '#ef4444', icon: '✕' },
  checking: { color: '#6b7280', icon: '…' },
} as const

const CHECK_INTERVAL = 3000

export default function PreRecordingCheck({ stream, videoRef, onReady, micLevel = 0, micDetected = false }: Props) {
  const [lighting, setLighting] = useState<CheckStatus>('checking')
  const [framing, setFraming] = useState<CheckStatus>('checking')
  const [dismissed, setDismissed] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Audio: derive from parent's continuous mic monitoring
  const audio: CheckStatus = !stream?.getAudioTracks().length
    ? 'bad'
    : micDetected
      ? (micLevel > 50 ? 'good' : 'good') // detected = good
      : 'checking'

  const runVisualChecks = useCallback(() => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return

    const canvas = document.createElement('canvas')
    const size = 64
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, size, size)
    const data = ctx.getImageData(0, 0, size, size).data

    // ── Lighting ──────────────────────────────────────────────
    let totalBrightness = 0
    let centerBrightness = 0
    let edgeBrightness = 0
    let centerCount = 0
    let edgeCount = 0
    const margin = size * 0.25
    const pixelCount = size * size

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4
        const b = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114
        totalBrightness += b
        const isCenter = x > margin && x < size - margin && y > margin && y < size - margin
        if (isCenter) { centerBrightness += b; centerCount++ }
        else { edgeBrightness += b; edgeCount++ }
      }
    }

    const avgBrightness = totalBrightness / pixelCount
    const isBacklit = edgeCount > 0 && centerCount > 0 && (edgeBrightness / edgeCount) > (centerBrightness / centerCount) * 1.8

    if (avgBrightness < 40 || isBacklit) setLighting('bad')
    else if (avgBrightness < 80 || avgBrightness > 220) setLighting('warning')
    else setLighting('good')

    // ── Framing (skin-tone concentration) ─────────────────────
    let centerSkinPixels = 0
    let totalSkinPixels = 0
    const third = size / 3

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4
        const r = data[idx], g = data[idx + 1], bl = data[idx + 2]
        if (r > 95 && g > 40 && bl > 20 && r > g && r > bl && Math.abs(r - g) > 15 && r - bl > 15) {
          totalSkinPixels++
          if (x > third && x < third * 2 && y < third * 2) centerSkinPixels++
        }
      }
    }

    if (totalSkinPixels < 50) setFraming('warning')
    else setFraming(centerSkinPixels / totalSkinPixels > 0.3 ? 'good' : 'warning')
  }, [videoRef])

  // Run checks on mount + every 3 seconds
  useEffect(() => {
    if (!stream) return

    const timer = setTimeout(runVisualChecks, 800)
    intervalRef.current = setInterval(runVisualChecks, CHECK_INTERVAL)

    return () => {
      clearTimeout(timer)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [stream, runVisualChecks])

  const allChecked = audio !== 'checking' && lighting !== 'checking' && framing !== 'checking'

  // Auto-dismiss once all checks pass
  useEffect(() => {
    if (allChecked && !dismissed) {
      const timer = setTimeout(() => {
        setDismissed(true)
        onReady()
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [allChecked, dismissed, onReady])

  if (dismissed) return null

  const items: { key: string; status: CheckStatus; label: string; helpBad: string; helpWarn: string }[] = [
    { key: 'audio', status: audio, label: 'Son', helpBad: 'Pas de micro', helpWarn: 'Son faible' },
    { key: 'lighting', status: lighting, label: 'Lumiere', helpBad: 'Contre-jour', helpWarn: 'Eclairage faible' },
    { key: 'framing', status: framing, label: 'Cadrage', helpBad: 'Visage non centre', helpWarn: 'Recentre-toi' },
  ]

  return (
    <div className="absolute top-14 right-3 z-30 flex flex-col items-end gap-1.5 pointer-events-none">
      {items.map((item) => {
        const config = STATUS_CONFIG[item.status]
        const showHelp = item.status === 'bad' || item.status === 'warning'
        return (
          <div
            key={item.key}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full"
            style={{
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${item.status === 'checking' ? 'rgba(255,255,255,0.08)' : config.color + '30'}`,
              transition: 'all 0.3s ease',
            }}
          >
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: config.color + '25', color: config.color, fontSize: 9, fontWeight: 700 }}
            >
              {item.status === 'checking' ? (
                <span className="block w-2 h-2 rounded-full border border-white/30 border-t-white/80 animate-spin" />
              ) : config.icon}
            </div>
            <span className="text-[11px] font-medium" style={{ color: item.status === 'checking' ? 'rgba(255,255,255,0.4)' : config.color }}>
              {showHelp ? (item.status === 'bad' ? item.helpBad : item.helpWarn) : item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
