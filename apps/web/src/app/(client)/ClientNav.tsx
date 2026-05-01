'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Home, User, Clapperboard, Music, Mic, Palette, BarChart3, MessageSquare, Film, LifeBuoy, FileText, Globe, LucideIcon } from 'lucide-react'

function useHideNavOnScroll() {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    const el = document.querySelector('.layout-scroll-main')
    if (!el) return
    const handler = () => {
      const y = (el as HTMLElement).scrollTop
      if (y < 10) { setHidden(false); lastY.current = y; return }
      setHidden(y > lastY.current)
      lastY.current = y
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [])

  return hidden
}

const BASE_ITEMS = [
  { href: '/home', label: 'Accueil', icon: Home },
  { href: '/sujets', label: 'Sujets', icon: FileText },
  { href: '/projects', label: 'Studio', icon: Clapperboard },
  { href: '/mon-univers', label: 'Mon univers', icon: Globe },
  { href: '/profile', label: 'Profil', icon: User },
]

const BOTTOM_ITEMS = [
  { href: '/home', label: 'Accueil', icon: Home },
  { href: '/sujets', label: 'Sujets', icon: FileText },
  { href: '/projects', label: 'Studio', icon: Clapperboard },
  { href: '/mon-univers', label: 'Univers', icon: Globe },
]

// Paths where the bottom nav is hidden — each page manages its own back button
const HIDE_NAV_PATTERNS = [
  /^\/sujets\/.+/,
  /^\/projects\/.+/,
  /^\/mon-univers\/.+/,
  /^\/profile/,
  /^\/settings/,
  /^\/brand-kit/,
  /^\/s\//,
]

const ADMIN_SECTIONS: { label: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    label: 'Outils',
    items: [
      { href: '/admin/montage', label: 'Montage', icon: Clapperboard },
      { href: '/admin/broll', label: 'B-Rolls', icon: Film },
      { href: '/admin/sounds', label: 'Sons', icon: Music },
      { href: '/admin/voices', label: 'Voix IA', icon: Mic },
    ],
  },
  {
    label: 'Parametres',
    items: [
      { href: '/brand-kit', label: 'Brand Kit', icon: Palette },
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/admin/feedbacks', label: 'Feedbacks', icon: MessageSquare },
    ],
  },
]

interface ClientNavProps {
  variant: 'sidebar' | 'bottom'
  userRole?: string
}

function NavLink({ href, label, icon: Icon, iconSize }: { href: string; label: string; icon: LucideIcon; iconSize: number }) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 h-12 text-sm rounded-xl transition-colors ${
        isActive
          ? 'text-foreground bg-background font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
      }`}
    >
      <Icon size={iconSize} className={isActive ? 'text-primary' : ''} />
      <span>{label}</span>
    </Link>
  )
}

export function ClientNav({ variant, userRole }: ClientNavProps) {
  const pathname = usePathname()
  const isAdmin = userRole === 'ADMIN'
  const navHidden = useHideNavOnScroll()

  if (variant === 'sidebar') {
    return (
      <nav aria-label="Barre latérale" className="flex-1 flex flex-col gap-0.5 px-3 py-2 overflow-y-auto custom-scrollbar">
        {BASE_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} iconSize={18} />
        ))}

        {isAdmin && ADMIN_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="my-3" />
            <p className="text-xs font-medium text-muted-foreground px-3 pb-2 select-none">
              {section.label}
            </p>
            {section.items.map((item) => (
              <NavLink key={item.href} {...item} iconSize={18} />
            ))}
          </div>
        ))}

        <div className="mt-auto pt-3 px-0">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && (window as any).$crisp) {
                (window as any).$crisp.push(['do', 'chat:show']);
                (window as any).$crisp.push(['do', 'chat:open']);
              }
            }}
            className="flex items-center gap-3 px-3 h-12 text-sm rounded-xl transition-colors w-full text-muted-foreground hover:text-foreground hover:bg-background/60"
          >
            <LifeBuoy size={18} />
            <span>Support</span>
          </button>
        </div>
      </nav>
    )
  }

  // Detail pages: hide the nav entirely — each page has its own back button
  if (HIDE_NAV_PATTERNS.some(p => p.test(pathname))) return null

  return (
    <div
      data-bottom-nav
      className="md:hidden fixed bottom-0 inset-x-0 bg-surface/96 backdrop-blur-xl border-t border-border/50 z-40 transition-transform duration-200 ease-in-out"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        transform: navHidden ? 'translateY(100%)' : 'translateY(0)',
      }}
    >
      <nav aria-label="Navigation principale" className="grid grid-cols-4">
        {BOTTOM_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => navigator.vibrate?.(10)}
              className={`flex flex-col items-center justify-center gap-1.5 py-3 min-h-[56px] transition-colors active:opacity-60 select-none ${
                isActive ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              <Icon
                size={24}
                strokeWidth={isActive ? 2.5 : 1.6}
                className={isActive ? 'text-primary' : ''}
              />
              <span className={`text-[10px] leading-none tracking-tight ${
                isActive ? 'font-black text-primary' : 'font-medium'
              }`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
