import Link from 'next/link'
import { LayoutGrid, Clapperboard } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 border-r border-border flex flex-col">
        {/* Logo */}
        <div className="h-14 flex items-center px-6 border-b border-border">
          <Link href="/admin" className="flex items-center gap-2 group">
            <span className="w-2 h-2 bg-primary rounded-none group-hover:scale-125 transition-transform" />
            <span className="font-sans font-extrabold text-base tracking-tight text-foreground">
              LAVIDZ
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground px-3 pb-2">
            Contenu
          </p>
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 h-8 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors group"
          >
            <LayoutGrid size={13} className="shrink-0" />
            Thèmes
          </Link>
          <Link
            href="/admin/montage"
            className="flex items-center gap-3 px-3 h-8 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors group"
          >
            <Clapperboard size={13} className="shrink-0" />
            Montage
          </Link>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-[9px] font-mono text-muted-foreground/60 tracking-widest uppercase">
            v0.1.0 — MVP
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-border flex items-center px-8 shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Admin
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-8 grid-bg">
          {children}
        </main>
      </div>
    </div>
  )
}
