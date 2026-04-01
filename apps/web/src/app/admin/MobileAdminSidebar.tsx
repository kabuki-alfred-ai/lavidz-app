'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { AdminSidebarNav } from './AdminSidebarNav'
import { LogoutButton } from './LogoutButton'
import { cn } from '@/lib/utils'

interface Props {
  userRole?: string
  userName: string
  userInitial: string
  avatarSrc?: string | null
}

export function MobileAdminSidebar({ userRole, userName, userInitial, avatarSrc }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const drawer = (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 md:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-[240px] z-50 flex flex-col border-r border-border transition-transform duration-300 md:hidden dark",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ backgroundColor: '#0a0a0a' }}
      >
        {/* Logo + close */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-border mb-4">
          <Link href="/admin" className="flex items-center gap-1.5 group">
            <div className="relative w-6 h-6 flex items-center justify-center">
              <span className="block w-3 h-3 bg-primary animate-logo-morph shadow-[0_0_10px_rgba(var(--primary),0.2)]" />
            </div>
            <span className="font-sans font-black text-lg tracking-tighter text-foreground uppercase">
              LAVIDZ
            </span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-sm border border-border hover:bg-surface transition-colors"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* Nav */}
        <AdminSidebarNav userRole={userRole} />

        {/* Footer */}
        <div className="p-4 mx-4 mb-4 border border-border/60 bg-surface/40 rounded-sm flex flex-col gap-3">
          <Link href="/admin/profile" className="min-w-0 flex items-center gap-3 px-1 hover:bg-surface-raised cursor-pointer rounded p-1 transition-colors group">
            <div className="w-8 h-8 rounded-sm overflow-hidden bg-surface-raised flex items-center justify-center font-mono text-xs font-bold text-primary border border-border group-hover:border-primary/50 transition-colors shrink-0">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/api/admin/profile/avatar" alt="" className="w-full h-full object-cover" />
              ) : (
                userInitial
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono font-bold text-foreground truncate max-w-[120px] group-hover:text-primary transition-colors">
                {userName}
              </p>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                {userRole}
              </div>
            </div>
          </Link>
          <LogoutButton />
        </div>
      </aside>
    </>
  )

  return (
    <>
      {/* Hamburger button — mobile only */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center justify-center w-8 h-8 rounded-sm border border-border hover:bg-surface-raised transition-colors"
        aria-label="Menu"
      >
        <Menu size={16} className="text-muted-foreground" />
      </button>

      {/* Drawer + overlay rendered in body via portal to escape stacking context */}
      {typeof document !== 'undefined' && createPortal(drawer, document.body)}
    </>
  )
}
