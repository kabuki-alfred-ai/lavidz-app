import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { ClientNav } from './ClientNav'
import { LogoutButton } from '../admin/LogoutButton'
import Link from 'next/link'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')

  const displayName = user.firstName ?? user.email.split('@')[0]

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-[240px] shrink-0 flex-col bg-surface/50">
        {/* Logo */}
        <div className="h-16 flex items-center px-6">
          <Link href="/home" className="flex items-center gap-2">
            <div className="relative w-7 h-7 flex items-center justify-center">
              <span className="block w-3.5 h-3.5 bg-primary rounded-md shadow-sm" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-foreground">
              Lavidz
            </span>
          </Link>
        </div>

        {/* Nav */}
        <ClientNav variant="sidebar" userRole={user.role} />

        {/* User footer */}
        <div className="p-3 mx-3 mb-3 bg-background rounded-xl flex flex-col gap-3">
          <Link href="/profile" className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-raised transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
              {displayName[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-medium text-foreground truncate">{displayName}</span>
          </Link>
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="layout-scroll-main flex-1 overflow-y-auto pb-[calc(var(--nav-height)+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <div
        data-bottom-nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-lg z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ClientNav variant="bottom" userRole={user.role} />
      </div>
    </div>
  )
}
