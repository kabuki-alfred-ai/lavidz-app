'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface SlideTransitionProps {
  children: ReactNode
  className?: string
}

export function SlideTransition({ children, className }: SlideTransitionProps) {
  const prefersReduced = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, x: 40 }}
      animate={prefersReduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
      transition={
        prefersReduced
          ? { duration: 0.15 }
          : { type: 'spring', stiffness: 600, damping: 40 }
      }
    >
      {children}
    </motion.div>
  )
}
