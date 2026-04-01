import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { LogoutButton } from './LogoutButton'
import { AdminSidebarNav } from './AdminSidebarNav'
import { MobileAdminSidebar } from './MobileAdminSidebar'
import { AiDrawer } from './AiDrawer'
import { ChevronRight, Home } from 'lucide-react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  const dbUser = user
    ? await prisma.user.findUnique({ where: { id: user.userId }, select: { avatarKey: true } })
    : null

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/30">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-[240px] shrink-0 border-r border-border flex-col bg-surface-raised/40 backdrop-blur-md z-20">
        {/* Logo */}
        <div className="h-14 flex items-center px-6 border-b border-border mb-4">
          <Link href="/admin" className="flex items-center gap-3 group">
            <div className="relative">
              <span className="block w-3 h-3 bg-primary rounded-none transition-all duration-300 group-hover:rotate-45" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary/40 rounded-none group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </div>
            <span className="font-sans font-black text-lg tracking-tighter text-foreground uppercase">
              LAVIDZ
            </span>
          </Link>
        </div>

        {/* Nav */}
        <AdminSidebarNav userRole={user?.role} />

        {/* Footer — user info + logout */}
        <div className="p-4 mx-4 mb-4 border border-border/60 bg-surface/40 rounded-sm flex flex-col gap-3">
          {user && (
            <Link href="/admin/profile" className="min-w-0 flex items-center gap-3 px-1 hover:bg-surface-raised cursor-pointer rounded p-1 transition-colors group">
              <div className="w-8 h-8 rounded-sm overflow-hidden bg-surface-raised flex items-center justify-center font-mono text-xs font-bold text-primary border border-border group-hover:border-primary/50 transition-colors shrink-0">
                {dbUser?.avatarKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/api/admin/profile/avatar"
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.email[0].toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-mono font-bold text-foreground truncate max-w-[120px] group-hover:text-primary transition-colors">
                  {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email.split('@')[0]}
                </p>
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  {user.role}
                </div>
              </div>
            </Link>
          )}
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Background glow effects */}
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[30%] h-[30%] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

        {/* Topbar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-8 bg-background/60 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <MobileAdminSidebar
              userRole={user?.role}
              userName={user ? (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email.split('@')[0]) : ''}
              userInitial={user ? user.email[0].toUpperCase() : ''}
              avatarSrc={dbUser?.avatarKey}
            />
            <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground uppercase tracking-widest leading-none">
              <Home size={10} className="text-muted-foreground/60 hidden md:block" />
              <ChevronRight size={10} className="text-muted-foreground/40 hidden md:block" />
              <span className="text-foreground/70 font-medium">Panel</span>
              <ChevronRight size={10} className="text-muted-foreground/40" />
              <span className="text-foreground font-bold">Admin</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-2.5 py-1 rounded-full bg-surface-raised border border-border flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[9px] font-mono text-muted-foreground font-medium uppercase tracking-wider">Live</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 lg:p-12 relative animate-in fade-in duration-700">
          {children}
        </main>
      </div>

      {/* AI floating drawer — SUPERADMIN only */}
      {user?.role === 'SUPERADMIN' && <AiDrawer />}
    </div>
  )
}
