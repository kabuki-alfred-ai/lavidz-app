import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/40 bg-primary/10 text-primary',
        secondary: 'border-border bg-surface-raised text-muted-foreground',
        destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
        outline: 'border-border text-muted-foreground',
        active: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
        inactive: 'border-border bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
