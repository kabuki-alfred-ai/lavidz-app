'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SeedIcon } from './CreativeStageIcons'

interface SubjectSeedGuidanceProps {
  topicName: string
  onStart: () => void
}

const STEPS = [
  { label: 'Angle' },
  { label: 'Piliers' },
  { label: 'Sources' },
  { label: 'Tournage' },
] as const

export function SubjectSeedGuidance({ topicName, onStart }: SubjectSeedGuidanceProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="py-12 max-w-[560px]"
    >
      <div className="mb-7">
        <SeedIcon className="h-11 w-11 text-amber-500 dark:text-amber-400" active />
      </div>

      <h2 className="text-[28px] font-bold tracking-tight leading-tight mb-4">
        On commence.
      </h2>

      <p className="text-[14px] text-muted-foreground leading-relaxed mb-8 max-w-[440px]">
        Raconte à Kabou ce que tu sais sur{' '}
        <span className="text-foreground font-medium">«&nbsp;{topicName}&nbsp;»</span>
        {' '}— même flou, même partiel. Il pose les bonnes questions, toi tu apportes la matière.
      </p>

      <Button size="lg" onClick={onStart} className="gap-2 mb-12">
        Parler à Kabou
        <ArrowRight className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold tabular-nums ${
                  i === 0
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/35'
                    : 'bg-muted/60 text-muted-foreground/40'
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-[11px] font-mono tracking-wide ${
                  i === 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground/35'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-px w-8 mx-1.5 bg-border/50 mb-3.5" aria-hidden />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
