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
  activeOrgId?: string | null
}

export function MobileAdminSidebar({ userRole, userName, userInitial, avatarSrc, activeOrgId }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  // Only render portal after client mount to avoid hydration mismatch
  useEffect(() => { setMounted(true) }, [])

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
          "fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-[280px] z-50 flex flex-col transition-transform duration-300 md:hidden dark rounded-r-2xl shadow-2xl",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ backgroundColor: '#0a0a0a' }}
      >
        {/* Logo + close */}
        <div className="h-16 flex items-center justify-between px-6">
          <Link href="/admin" className="flex items-center gap-2 group">
            <div className="relative w-7 h-7 flex items-center justify-center">
              <span className="block w-3.5 h-3.5 bg-primary rounded-md shadow-sm" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-foreground">
              Lavidz
            </span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-raised transition-colors"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Nav */}
        <AdminSidebarNav userRole={userRole} activeOrgId={activeOrgId} />

        {/* Footer */}
        <div className="p-3 mx-3 mb-3 bg-surface/30 rounded-xl flex flex-col gap-3">
          <Link href="/admin/profile" className="min-w-0 flex items-center gap-3 px-2 py-1.5 hover:bg-surface-raised cursor-pointer rounded-lg transition-colors group">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-raised flex items-center justify-center text-xs font-semibold text-primary shrink-0">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/api/admin/profile/avatar" alt="" className="w-full h-full object-cover" />
              ) : (
                userInitial
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate max-w-[140px] group-hover:text-primary transition-colors">
                {userName}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-surface-raised transition-colors"
        aria-label="Menu"
      >
        <Menu size={18} className="text-muted-foreground" />
      </button>

      {/* Drawer + overlay rendered in body via portal to escape stacking context */}
      {mounted && createPortal(drawer, document.body)}
    </>
  )
}
