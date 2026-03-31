'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Decodes audio from a video/audio blob URL and returns an array of RMS peaks
 * suitable for rendering a waveform visualisation.
 */
export function useWaveform(blobUrl: string | null, samplesPerPeak = 512): Float32Array | null {
  const [peaks, setPeaks] = useState<Float32Array | null>(null)
  const urlRef = useRef(blobUrl)

  useEffect(() => {
    urlRef.current = blobUrl
    if (!blobUrl) { setPeaks(null); return }

    let cancelled = false
    const ctx = new AudioContext()

    ;(async () => {
      try {
        const res = await fetch(blobUrl)
        const buf = await res.arrayBuffer()
        const audio = await ctx.decodeAudioData(buf)

        if (cancelled) return

        // Use first channel
        const raw = audio.getChannelData(0)
        const count = Math.ceil(raw.length / samplesPerPeak)
        const out = new Float32Array(count)

        for (let i = 0; i < count; i++) {
          const start = i * samplesPerPeak
          const end = Math.min(start + samplesPerPeak, raw.length)
          let sum = 0
          for (let j = start; j < end; j++) sum += raw[j] * raw[j]
          out[i] = Math.sqrt(sum / (end - start))
        }

        // Normalise to 0..1
        let max = 0
        for (let i = 0; i < out.length; i++) if (out[i] > max) max = out[i]
        if (max > 0) for (let i = 0; i < out.length; i++) out[i] /= max

        if (!cancelled && urlRef.current === blobUrl) setPeaks(out)
      } catch {
        // Audio decode can fail for some formats — silently ignore
      }
    })()

    return () => {
      cancelled = true
      ctx.close().catch(() => {})
    }
  }, [blobUrl, samplesPerPeak])

  return peaks
}
