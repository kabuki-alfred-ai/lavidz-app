'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'

interface HelpPopoverProps {
  /** Titre court affiché en tête du popover. */
  title: string
  /** Contenu explicatif — chaîne simple ou markup React pour listes/emphase. */
  children: ReactNode
  /** Alignement horizontal du popover. Défaut : `start` (aligné à gauche). */
  align?: 'start' | 'end'
  /** Taille de l'icône du trigger. Défaut : 12. */
  iconSize?: number
  /** Label ARIA — défaut : "Plus d'informations". */
  ariaLabel?: string
}

/**
 * Aide contextuelle discrète : petite icône `?` qui ouvre un popover ~280px
 * au clic. Click outside ou Escape ferme. Le trigger reste en place (pas de
 * layout shift) et utilise des tokens DS existants.
 *
 * Conçu pour être *dispersé* dans l'UI — un par notion à expliquer — plutôt
 * que centralisé dans une doc séparée. L'user reste dans son flux.
 */
export function HelpPopover({
  title,
  children,
  align = 'start',
  iconSize = 12,
  ariaLabel = "Plus d'informations",
}: HelpPopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setOpen((v) => !v)
        }}
        className="inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-surface-raised transition p-1"
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        <HelpCircle style={{ width: iconSize, height: iconSize }} />
      </button>
      {open && (
        <div
          role="dialog"
          className={`absolute top-full mt-1.5 z-50 w-[300px] rounded-xl border border-border bg-card shadow-lg p-3.5 text-[13px] leading-relaxed ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          <p className="font-semibold text-[13px] text-foreground mb-1.5">{title}</p>
          <div className="text-muted-foreground space-y-1.5">{children}</div>
        </div>
      )}
    </div>
  )
}
