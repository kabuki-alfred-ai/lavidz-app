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
        'group flex items-center gap-3 px-3 h-9 text-sm rounded-lg transition-colors',
        isActive
          ? 'text-foreground bg-background font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
      )}
    >
      <Icon
        size={16}
        className={cn(
          'shrink-0',
          isActive ? 'text-primary' : ''
        )}
      />
      <span>{label}</span>
    </Link>
  )
}
