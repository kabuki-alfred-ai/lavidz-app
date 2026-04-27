'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageSquare, Film, User, Clapperboard, Music, Mic, Palette, BarChart3, LifeBuoy, FileText, FolderOpen, Video, LucideIcon } from 'lucide-react'

const BASE_ITEMS = [
  { href: '/home', label: 'Accueil', icon: Home },
  { href: '/topics', label: 'Sujets', icon: FileText },
  { href: '/projects', label: 'Projets', icon: FolderOpen },
  { href: '/tournages', label: 'Tournages', icon: Video },
  { href: '/moi', label: 'Moi', icon: User },
]

const BOTTOM_ITEMS = [
  { href: '/home', label: 'Accueil', icon: Home },
  { href: '/topics', label: 'Sujets', icon: FileText },
  { href: '/projects', label: 'Projets', icon: FolderOpen },
  { href: '/tournages', label: 'Tournages', icon: Video },
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
      className={`flex items-center gap-3 px-3 h-10 text-sm rounded-lg transition-colors ${
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

        {/* Support */}
        <div className="mt-auto pt-3 px-0">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && (window as any).$crisp) {
                (window as any).$crisp.push(['do', 'chat:show']);
                (window as any).$crisp.push(['do', 'chat:open']);
              }
            }}
            className="flex items-center gap-3 px-3 h-10 text-sm rounded-lg transition-colors w-full text-muted-foreground hover:text-foreground hover:bg-background/60"
          >
            <LifeBuoy size={18} />
            <span>Support</span>
          </button>
        </div>
      </nav>
    )
  }

  // Bottom variant — 3 items (Accueil · Sujets · Tournages)
  return (
    <nav aria-label="Navigation principale" className="flex items-center justify-around py-2">
      {BOTTOM_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => navigator.vibrate?.(10)}
            className={`flex flex-col items-center gap-1 px-6 py-1.5 rounded-lg transition-all ${
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={20} className={isActive ? 'text-primary' : ''} />
            <span className={`text-[10px] ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
