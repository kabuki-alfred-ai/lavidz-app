import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { LogoutButton } from './LogoutButton'
import { AdminSidebarNav } from './AdminSidebarNav'
import { MobileAdminSidebar } from './MobileAdminSidebar'

import { OrgSwitcher } from './OrgSwitcher'
import { ClientNav } from '../(client)/ClientNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  const dbUser = user
    ? await prisma.user.findUnique({ where: { id: user.userId }, select: { avatarKey: true } })
    : null

  const displayName = user
    ? (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email.split('@')[0])
    : ''

  // ─── ADMIN: unified client-style layout ────────────────────────────
  if (user?.role === 'ADMIN') {
    return (
      <div className="flex h-screen bg-background">
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex w-[240px] shrink-0 flex-col bg-surface/50">
          <div className="h-16 flex items-center px-6">
            <Link href="/home" className="flex items-center gap-2">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <span className="block w-3.5 h-3.5 bg-primary rounded-md shadow-sm" />
              </div>
              <span className="font-semibold text-lg tracking-tight text-foreground">Lavidz</span>
            </Link>
          </div>

          <ClientNav variant="sidebar" userRole="ADMIN" />

          <div className="p-3 mx-3 mb-3 bg-background rounded-xl flex flex-col gap-3">
            <Link href="/profile" className="min-w-0 flex items-center gap-3 px-2 py-1.5 hover:bg-surface-raised cursor-pointer rounded-lg transition-colors group">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-raised flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                {dbUser?.avatarKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/api/admin/profile/avatar" alt="" className="w-full h-full object-cover" />
                ) : (
                  displayName[0]?.toUpperCase()
                )}
              </div>
              <span className="text-sm font-medium text-foreground truncate max-w-[140px] group-hover:text-primary transition-colors">
                {displayName}
              </span>
            </Link>
            <LogoutButton />
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 pb-20 md:pb-12">
            {children}
          </main>
        </div>

        {/* Bottom nav — mobile */}
        <div className="md:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-lg z-40">
          <ClientNav variant="bottom" userRole="ADMIN" />
        </div>

      </div>
    )
  }

  // ─── SUPERADMIN: full admin layout (unchanged) ─────────────────────
  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/30">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-[260px] shrink-0 flex-col bg-surface/50 overflow-hidden">
        <div className="h-16 flex items-center px-6">
          <Link href="/admin" className="flex items-center gap-2 group">
            <div className="relative w-7 h-7 flex items-center justify-center">
              <span className="block w-3.5 h-3.5 bg-primary rounded-md shadow-sm" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-foreground">Lavidz</span>
          </Link>
        </div>

        <AdminSidebarNav userRole={user?.role} activeOrgId={user?.activeOrgId} />

        <div className="p-3 mx-3 mb-3 bg-background rounded-xl flex flex-col gap-3">
          {user && (
            <Link href="/admin/profile" className="min-w-0 flex items-center gap-3 px-2 py-1.5 hover:bg-surface-raised cursor-pointer rounded-lg transition-colors group">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-raised flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                {dbUser?.avatarKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/api/admin/profile/avatar" alt="" className="w-full h-full object-cover" />
                ) : (
                  user.email[0].toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate max-w-[140px] group-hover:text-primary transition-colors">
                  {displayName}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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
        <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-background z-10 shrink-0">
          <div className="flex items-center gap-3">
            <MobileAdminSidebar
              userRole={user?.role}
              userName={displayName}
              userInitial={user ? user.email[0].toUpperCase() : ''}
              avatarSrc={dbUser?.avatarKey}
              activeOrgId={user?.activeOrgId}
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground leading-none">
              <span className="text-foreground font-medium">Admin</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user?.role === 'SUPERADMIN' && (
              <OrgSwitcher activeOrgId={user.activeOrgId} />
            )}
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs text-emerald-600 font-medium">Live</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8 lg:p-12 relative">
          {children}
        </main>
      </div>

    </div>
  )
}
