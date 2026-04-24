'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface SubjectSectionProps {
  number: string
  title: string
  subtitle?: string
  chip?: ReactNode
  /** Bouton d'aide contextuelle (HelpPopover) à placer à côté du titre. */
  help?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  id?: string
}

export function SubjectSection({
  number,
  title,
  subtitle,
  chip,
  help,
  defaultOpen = false,
  children,
  id,
}: SubjectSectionProps) {
  return (
    <details className="reveal group" open={defaultOpen} id={id}>
      <summary className="flex items-start gap-4 py-3 outline-none">
        <div className="accent-bar self-stretch min-h-[40px]" aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-0.5">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground/70">
              § {number}
            </span>
            <h2 className="sect-label text-[18px] font-semibold text-muted-foreground transition-colors">
              {title}
            </h2>
            {help}
            {chip}
          </div>
          {subtitle && (
            <p className="text-[13px] text-muted-foreground/80">{subtitle}</p>
          )}
        </div>
        <ChevronDown className="chev h-4 w-4 mt-2 text-muted-foreground shrink-0" />
      </summary>
      <div className="reveal-body pl-6 pt-4">{children}</div>
    </details>
  )
}

export function SectionChip({
  children,
  variant = 'default',
}: {
  children: ReactNode
  variant?: 'default' | 'primary'
}) {
  const base =
    'inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] rounded-full border'
  const variantCls =
    variant === 'primary'
      ? 'border-primary/35 text-primary bg-primary/[0.08]'
      : 'border-border text-muted-foreground bg-surface-raised/50'
  return <span className={`${base} ${variantCls}`}>{children}</span>
}
