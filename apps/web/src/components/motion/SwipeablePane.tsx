'use client'

import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useDrag } from '@use-gesture/react'

interface SwipeablePaneProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  leftLabel: string
  rightLabel: string
  className?: string
}

export function SwipeablePane({
  leftPanel,
  rightPanel,
  leftLabel,
  rightLabel,
  className,
}: SwipeablePaneProps) {
  const [active, setActive] = useState<'left' | 'right'>('left')
  const prefersReduced = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)

  const bind = useDrag(
    ({ swipe: [sx] }) => {
      if (sx === -1) setActive('right')
      if (sx === 1) setActive('left')
    },
    { axis: 'x', swipe: { distance: 60, velocity: [0.5, 0.5] }, filterTaps: true },
  )

  return (
    <div className={`flex flex-col overflow-hidden ${className ?? ''}`}>
      <div className="flex border-b border-border shrink-0">
        <button
          type="button"
          onClick={() => setActive('left')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            active === 'left'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground'
          }`}
        >
          {leftLabel}
        </button>
        <button
          type="button"
          onClick={() => setActive('right')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            active === 'right'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground'
          }`}
        >
          {rightLabel}
        </button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-hidden relative" {...bind()}>
        <motion.div
          className="flex h-full"
          style={{ width: '200%' }}
          animate={{ x: active === 'left' ? '0%' : '-50%' }}
          transition={
            prefersReduced
              ? { duration: 0 }
              : { type: 'spring', stiffness: 400, damping: 30 }
          }
        >
          <div className="w-1/2 h-full overflow-y-auto">{leftPanel}</div>
          <div className="w-1/2 h-full overflow-y-auto">{rightPanel}</div>
        </motion.div>
      </div>
    </div>
  )
}
