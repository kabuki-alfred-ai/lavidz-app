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
      currentSection = { label: headerMatch[1].trim(), durationHint: headerMatch[2]?.trim() ?? '', bullets: [] }
      continue
    }
    if (currentSection) {
      for (const line of trimmed.split('\n')) {
        const clean = line.replace(/^[•\-\*]\s*/, '').replace(/^[""]|[""]$/g, '').trim()
        if (clean) currentSection.bullets.push(clean)
      }
    } else {
      sections.push({ label: '', durationHint: '', bullets: [trimmed.replace(/^[""]|[""]$/g, '')] })
    }
  }
  if (currentSection) sections.push(currentSection)
  return sections.length > 0 ? sections : [{ label: '', durationHint: '', bullets: [script] }]
}

// Espace réservé pour les contrôles d'enregistrement en bas
const BOTTOM_CONTROLS_HEIGHT = '15rem'

// Seuils de détection du swipe : vitesse min (px/ms) + déplacement min (px) + durée max (ms)
const SWIPE_VELOCITY = 0.3
const SWIPE_MIN_DELTA = 45
const SWIPE_MAX_DURATION = 350

export default function TeleprompterOverlay({ script, isRecording, elapsed, accentColor = '#FF4D1C', promptMode = 'keypoints' }: Props) {
  const sections = parseScript(script)
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const didSwipeRef = useRef(false)

  const handleNext = useCallback(() => {
    setActiveSectionIndex((prev) => Math.min(prev + 1, sections.length - 1))
  }, [sections.length])

  const handlePrev = useCallback(() => {
    setActiveSectionIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  // Clavier (desktop)
  useEffect(() => {
    if (!isRecording) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); handleNext() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); handlePrev() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isRecording, handleNext, handlePrev])

  // Scroll automatique vers la section active
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const activeEl = el.querySelector<HTMLElement>(`[data-section="${activeSectionIndex}"]`)
    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeSectionIndex])

  // Swipe vertical — détection par vélocité pour ne pas confondre avec le scroll lent
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    }
    didSwipeRef.current = false
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const deltaY = touchStartRef.current.y - e.changedTouches[0].clientY
    const deltaX = Math.abs(touchStartRef.current.x - e.changedTouches[0].clientX)
    const duration = Date.now() - touchStartRef.current.time
    const velocity = Math.abs(deltaY) / Math.max(duration, 1)
    touchStartRef.current = null

    // Swipe vertical uniquement (pas horizontal), rapide et assez ample
    if (Math.abs(deltaY) > deltaX && Math.abs(deltaY) > SWIPE_MIN_DELTA && velocity > SWIPE_VELOCITY && duration < SWIPE_MAX_DURATION) {
      didSwipeRef.current = true
      if (deltaY > 0) handleNext()
      else handlePrev()
    }
  }, [handleNext, handlePrev])

  // Tap gauche/droite — ignoré si un swipe vient d'être détecté
  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (didSwipeRef.current) { didSwipeRef.current = false; return }
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = e.clientX - rect.left
    if (relX < rect.width / 2) handlePrev()
    else handleNext()
  }, [handlePrev, handleNext])

  const isKeypoints = promptMode === 'keypoints'

  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none"
      style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.72) 100%)' }}
    >
      <style>{`
        .teleprompter-scroll::-webkit-scrollbar { display: none; }
        .teleprompter-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Zone scrollable — tap gauche/droite + swipe vertical pour naviguer, scroll lent pour lire */}
      <div
        ref={containerRef}
        className="teleprompter-scroll absolute inset-x-0 top-0 overflow-y-auto pointer-events-auto"
        style={{
          bottom: BOTTOM_CONTROLS_HEIGHT,
          paddingTop: 'max(4rem, calc(env(safe-area-inset-top) + 1rem))',
          paddingBottom: '2rem',
          paddingLeft: '1.25rem',
          paddingRight: '1.25rem',
          WebkitOverflowScrolling: 'touch',
        }}
        onTouchStart={isRecording ? handleTouchStart : undefined}
        onTouchEnd={isRecording ? handleTouchEnd : undefined}
        onClick={isRecording ? handleContentClick : undefined}
      >
        {sections.map((section, idx) => {
          const isActive = idx === activeSectionIndex
          const isPast = idx < activeSectionIndex

          if (isKeypoints) {
            return (
              <div
                key={idx}
                data-section={idx}
                className="mb-5 transition-all duration-400"
                style={{
                  opacity: isActive ? 1 : isPast ? 0.3 : 0.45,
                  transform: isActive ? 'translateY(0) scale(1)' : 'scale(0.96)',
                  filter: isActive ? 'none' : 'blur(0.5px)',
                }}
              >
                {section.label && (
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: isActive ? accentColor : 'rgba(255,255,255,0.15)', color: '#fff' }}
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
                    <div key={bi} className="flex items-start gap-2.5">
                      <span
                        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: isActive ? accentColor : 'rgba(255,255,255,0.3)' }}
                      />
                      <p
                        className="text-white font-semibold leading-snug"
                        style={{ fontSize: isActive ? '1.05rem' : '0.875rem', textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}
                      >
                        {bullet}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          return (
            <div
              key={idx}
              data-section={idx}
              className="mb-6 transition-all duration-500"
              style={{
                opacity: isActive ? 1 : isPast ? 0.25 : 0.4,
                transform: isActive ? 'scale(1)' : 'scale(0.92)',
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
                  {section.durationHint && <span className="text-xs text-white/40">{section.durationHint}</span>}
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

      {/* Hints visuels tap — chevrons sur les bords, pointer-events-none */}
      {isRecording && (
        <>
          <div
            className="absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none select-none"
            style={{ bottom: BOTTOM_CONTROLS_HEIGHT, top: '30%', display: 'flex', alignItems: 'center' }}
          >
            <span className="text-white/20 text-2xl font-thin">‹</span>
          </div>
          <div
            className="absolute top-1/2 right-3 -translate-y-1/2 pointer-events-none select-none"
            style={{ bottom: BOTTOM_CONTROLS_HEIGHT, top: '30%', display: 'flex', alignItems: 'center' }}
          >
            <span className="text-white/20 text-2xl font-thin">›</span>
          </div>
        </>
      )}

      {/* Compteur de section + timer — au-dessus des contrôles */}
      {isRecording && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 pointer-events-none"
          style={{ bottom: `calc(${BOTTOM_CONTROLS_HEIGHT} + 0.5rem)` }}
        >
          <span className="text-white/40 text-[10px] font-mono tabular-nums">
            {activeSectionIndex + 1}/{sections.length}
          </span>
          <span className="text-white/20 text-[10px]">·</span>
          <span className="text-white/40 text-[10px] font-mono tabular-nums">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
          </span>
        </div>
      )}
    </div>
  )
}
