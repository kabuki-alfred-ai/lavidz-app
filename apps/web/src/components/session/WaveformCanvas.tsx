'use client'

import { useRef, useEffect } from 'react'

interface Props {
  peaks: Float32Array | null
  width: number
  height: number
  color?: string
  /** Progress ratio 0..1 to highlight the played portion */
  progress?: number
  progressColor?: string
}

export function WaveformCanvas({
  peaks,
  width,
  height,
  color = 'rgba(255,255,255,0.35)',
  progress = 0,
  progressColor = 'rgba(255,255,255,0.7)',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !peaks || peaks.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const barWidth = Math.max(1, width / peaks.length)
    const mid = height / 2
    const progressX = progress * width

    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * width
      const h = Math.max(1, peaks[i] * mid * 0.9)
      ctx.fillStyle = x < progressX ? progressColor : color
      ctx.fillRect(x, mid - h, barWidth, h * 2)
    }
  }, [peaks, width, height, color, progress, progressColor])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block' }}
    />
  )
}
