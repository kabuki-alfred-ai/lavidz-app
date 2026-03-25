'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface AdminNavItemProps {
  href: string
  label: string
  icon: LucideIcon
}

export function AdminNavItem({ href, label, icon: Icon }: AdminNavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 px-3 h-9 text-xs font-mono transition-all duration-200 outline-none',
        isActive
          ? 'text-foreground bg-primary/10 border-r-2 border-primary translate-x-1'
          : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised'
      )}
    >
      <Icon
        size={14}
        className={cn(
          'shrink-0 transition-transform duration-200',
          isActive ? 'text-primary scale-110' : 'group-hover:scale-110'
        )}
      />
      <span className={cn('tracking-tight', isActive && 'font-bold')}>{label}</span>
      
      {isActive && (
        <span className="ml-auto w-1 h-1 rounded-full bg-primary animate-pulse" />
      )}
    </Link>
  )
}
