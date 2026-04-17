'use client'

import { useEffect, useState } from 'react'

interface GuideStep {
  label: string
  hint: string
  durationSec: number
}

interface Props {
  format: 'HOT_TAKE' | 'DAILY_TIP' | string
  topic?: string
  isRecording: boolean
  elapsed: number
  accentColor?: string
}

const GUIDES: Record<string, GuideStep[]> = {
  HOT_TAKE: [
    { label: 'HOOK', hint: 'Affirmation choc ou question provocante', durationSec: 5 },
    { label: 'TON AVIS', hint: 'Ton opinion + pourquoi + une preuve', durationSec: 35 },
    { label: 'OUVERTURE', hint: 'Question au public pour le debat', durationSec: 10 },
  ],
  DAILY_TIP: [
    { label: 'LE CONSEIL', hint: 'Annonce le conseil en une phrase', durationSec: 5 },
    { label: 'EXPLICATION', hint: 'Pourquoi ca marche + comment faire', durationSec: 25 },
    { label: 'RECAP', hint: 'Reformule en une phrase', durationSec: 5 },
  ],
}

const DEFAULT_GUIDE: GuideStep[] = [
  { label: 'INTRO', hint: 'Pose le contexte', durationSec: 10 },
  { label: 'CONTENU', hint: 'Developpe ton propos', durationSec: 40 },
  { label: 'CONCLUSION', hint: 'Termine avec un CTA', durationSec: 10 },
]

export default function FreeformGuide({ format, topic, isRecording, elapsed, accentColor = '#FF4D1C' }: Props) {
  const steps = GUIDES[format] ?? DEFAULT_GUIDE
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    if (!isRecording) {
      setActiveStep(0)
      return
    }

    let cumulative = 0
    for (let i = 0; i < steps.length; i++) {
      cumulative += steps[i].durationSec
      if (elapsed < cumulative) {
        setActiveStep(i)
        return
      }
    }
    setActiveStep(steps.length - 1)
  }, [elapsed, isRecording, steps])

  const totalDuration = steps.reduce((sum, s) => sum + s.durationSec, 0)
  const progressPercent = Math.min((elapsed / totalDuration) * 100, 100)

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none">
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
        <div
          className="h-full transition-all duration-1000 ease-linear"
          style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
        />
      </div>

      {/* Topic display */}
      {topic && !isRecording && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-8">
            <p className="text-white/50 text-sm uppercase tracking-wider mb-2">Ton sujet</p>
            <p className="text-white text-2xl font-bold" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
              {topic}
            </p>
          </div>
        </div>
      )}

      {/* Step indicators */}
      {isRecording && (
        <div
          className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-1 px-4 py-2 rounded-full backdrop-blur-md"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          {steps.map((step, idx) => {
            const isActive = idx === activeStep
            const isPast = idx < activeStep

            return (
              <div key={idx} className="flex items-center gap-1">
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: isActive ? accentColor : isPast ? 'rgba(255,255,255,0.15)' : 'transparent',
                  }}
                >
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{
                      color: isActive ? '#fff' : isPast ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="w-3 h-px bg-white/20" />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Active hint */}
      {isRecording && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 text-center">
          <p
            className="text-white/70 text-sm font-medium px-4 py-1.5 rounded-full backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.4)', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
          >
            {steps[activeStep]?.hint}
          </p>
        </div>
      )}
    </div>
  )
}
