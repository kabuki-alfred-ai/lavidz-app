'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { PromptMode } from '@lavidz/types'

interface TeleprompterSection {
  label: string
  durationHint: string
  bullets: string[]
}

interface Props {
  script: string
  isRecording: boolean
  elapsed: number
  accentColor?: string
  promptMode?: PromptMode
}

function parseScript(script: string): TeleprompterSection[] {
  const sections: TeleprompterSection[] = []
  const blocks = script.split(/\n\n+/)

  let currentSection: TeleprompterSection | null = null

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    const headerMatch = trimmed.match(/^\[(.+?)(?:\s*[—–-]\s*(.+?))?\]$/)
    if (headerMatch) {
      if (currentSection) sections.push(currentSection)
      currentSection = {
        label: headerMatch[1].trim(),
        durationHint: headerMatch[2]?.trim() ?? '',
        bullets: [],
      }
      continue
    }

    if (currentSection) {
      const lines = trimmed.split('\n')
      for (const line of lines) {
        const clean = line.replace(/^[•\-\*]\s*/, '').replace(/^[""]|[""]$/g, '').trim()
        if (clean) currentSection.bullets.push(clean)
      }
    } else {
      sections.push({
        label: '',
        durationHint: '',
        bullets: [trimmed.replace(/^[""]|[""]$/g, '')],
      })
    }
  }
  if (currentSection) sections.push(currentSection)

  return sections.length > 0 ? sections : [{ label: '', durationHint: '', bullets: [script] }]
}

export default function TeleprompterOverlay({ script, isRecording, elapsed, accentColor = '#FF4D1C', promptMode = 'keypoints' }: Props) {
  const sections = parseScript(script)
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleNext = useCallback(() => {
    setActiveSectionIndex((prev) => Math.min(prev + 1, sections.length - 1))
  }, [sections.length])

  const handlePrev = useCallback(() => {
    setActiveSectionIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  useEffect(() => {
    if (!isRecording) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        handlePrev()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isRecording, handleNext, handlePrev])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const activeEl = el.querySelector(`[data-section="${activeSectionIndex}"]`)
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeSectionIndex])

  const isKeypoints = promptMode === 'keypoints'

  return (
    <div
      className="absolute inset-0 pointer-events-none flex flex-col justify-end items-center z-20"
      style={isKeypoints
        ? { background: 'linear-gradient(to bottom, transparent 0%, transparent 40%, rgba(0,0,0,0.6) 100%)' }
        : { background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.1) 100%)', justifyContent: 'center' }
      }
    >
      <div
        ref={containerRef}
        className={isKeypoints
          ? 'w-full px-5 pb-20 max-h-[45vh] overflow-hidden relative'
          : 'w-full max-w-lg px-6 max-h-[60vh] overflow-hidden relative'
        }
      >
        {sections.map((section, idx) => {
          const isActive = idx === activeSectionIndex
          const isPast = idx < activeSectionIndex
          const isFuture = idx > activeSectionIndex

          if (isKeypoints) {
            // Key points mode: compact cards, only show active + next
            if (isPast || idx > activeSectionIndex + 1) return null

            return (
              <div
                key={idx}
                data-section={idx}
                className="transition-all duration-400 mb-3"
                style={{
                  opacity: isActive ? 1 : 0.35,
                  transform: isActive ? 'translateY(0)' : 'translateY(4px) scale(0.95)',
                }}
              >
                {section.label && (
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isActive ? accentColor : 'rgba(255,255,255,0.15)',
                        color: '#fff',
                      }}
                    >
                      {section.label}
                    </span>
                    {section.durationHint && (
                      <span className="text-[10px] text-white/35 font-mono">{section.durationHint}</span>
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  {section.bullets.map((bullet, bi) => (
                    <div
                      key={bi}
                      className="flex items-start gap-2.5"
                    >
                      <span
                        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: isActive ? accentColor : 'rgba(255,255,255,0.3)' }}
                      />
                      <p
                        className="text-white font-semibold leading-snug"
                        style={{
                          fontSize: isActive ? '1.05rem' : '0.9rem',
                          textShadow: '0 2px 12px rgba(0,0,0,0.9)',
                        }}
                      >
                        {bullet}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          // Script mode: original full-text display
          return (
            <div
              key={idx}
              data-section={idx}
              className="transition-all duration-500 mb-6"
              style={{
                opacity: isActive ? 1 : isPast ? 0.25 : 0.4,
                transform: isActive ? 'scale(1)' : 'scale(0.9)',
                filter: isActive ? 'none' : 'blur(1px)',
              }}
            >
              {section.label && (
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: isActive ? accentColor : 'rgba(255,255,255,0.2)',
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {section.label}
                  </span>
                  {section.durationHint && (
                    <span className="text-xs text-white/40">{section.durationHint}</span>
                  )}
                </div>
              )}
              {section.bullets.map((bullet, bi) => (
                <p
                  key={bi}
                  className="text-white font-semibold leading-relaxed mb-1"
                  style={{ fontSize: isActive ? '1.25rem' : '1rem', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
                >
                  {bullet}
                </p>
              ))}
            </div>
          )
        })}
      </div>

      {/* Navigation — tap zones for mobile + buttons */}
      {isRecording && (
        <>
          {/* Tap zones (key points mode — larger touch targets) */}
          {isKeypoints && (
            <>
              <div
                className="absolute top-0 left-0 w-1/3 h-full pointer-events-auto"
                onClick={handlePrev}
              />
              <div
                className="absolute top-0 right-0 w-1/3 h-full pointer-events-auto"
                onClick={handleNext}
              />
            </>
          )}

          {/* Navigation buttons */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto flex gap-2">
            <button
              onClick={handlePrev}
              disabled={activeSectionIndex === 0}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/20 text-white/80 backdrop-blur-sm disabled:opacity-30 hover:bg-white/30 transition-colors"
            >
              ↑ Precedent
            </button>
            <span className="flex items-center text-[10px] text-white/40 font-mono px-1">
              {activeSectionIndex + 1}/{sections.length}
            </span>
            <button
              onClick={handleNext}
              disabled={activeSectionIndex === sections.length - 1}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/20 text-white/80 backdrop-blur-sm disabled:opacity-30 hover:bg-white/30 transition-colors"
            >
              Suivant ↓
            </button>
          </div>
        </>
      )}

      {isRecording && (
        <div className="absolute top-4 right-4 text-white/60 text-xs font-mono">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
        </div>
      )}
    </div>
  )
}
