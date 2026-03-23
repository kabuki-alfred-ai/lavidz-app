import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminDashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')

  const isSuper = user.role === 'SUPERADMIN'
  const orgFilter = isSuper ? {} : { organizationId: user.organizationId }
  const sessionFilter = isSuper ? {} : { theme: { organizationId: user.organizationId } }

  // Get users
  const recentUsers = await prisma.user.findMany({
    where: orgFilter,
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { organization: true }
  })

  const totalUsers = await prisma.user.count({ where: orgFilter })

  // Get sessions
  const recentSessions = await prisma.session.findMany({
    where: {
      ...sessionFilter,
      status: { notIn: ['PENDING', 'RECORDING'] }
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    include: { theme: { include: { organization: true } } }
  })

  const totalSessions = await prisma.session.count({
    where: {
      ...sessionFilter,
      status: { notIn: ['PENDING', 'RECORDING'] }
    }
  })

  // Format date helper
  const formatDate = (date: Date | null | string) => {
    if (!date) return '-'
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date))
  }

  return (
    <div className="max-w-6xl animate-fade-in space-y-12">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Dashboard
          </p>
          <h1 className="font-sans font-extrabold text-3xl text-foreground tracking-tight">
            Vue d'ensemble
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Utilisateurs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-sans font-bold text-lg text-foreground">Utilisateurs récents</h2>
            <Badge variant="secondary" className="font-mono text-[10px] bg-surface-raised">{totalUsers} au total</Badge>
          </div>
          
          <div className="border border-border overflow-hidden bg-background">
            <div className="grid grid-cols-[1fr_100px_120px] border-b border-border bg-surface px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Utilisateur</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Rôle</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Inscription</div>
            </div>
            
            <div className="divide-y divide-border">
              {recentUsers.map((u: any, i: number) => (
                <div key={u.id} className={`grid grid-cols-[1fr_100px_120px] items-center px-4 py-3 ${i % 2 !== 0 ? 'bg-surface/30' : ''}`}>
                  <div className="min-w-0 pr-4">
                    <p className="font-sans font-semibold text-sm text-foreground truncate">{u.name || (isSuper ? u.email : u.email.split('@')[0])}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                    {isSuper && u.organization && (
                      <p className="text-[10px] font-mono mt-1 text-primary">{u.organization.name}</p>
                    )}
                  </div>
                  <div>
                    <Badge variant={u.role === 'SUPERADMIN' ? 'active' : 'default'} className="text-[10px]">
                      {u.role}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </div>
                </div>
              ))}
              {recentUsers.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground border-dashed border-t-0">
                  Aucun utilisateur
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sessions Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-sans font-bold text-lg text-foreground">Sessions répondues</h2>
            <Badge variant="secondary" className="font-mono text-[10px] bg-surface-raised">{totalSessions} au total</Badge>
          </div>
          
          <div className="border border-border overflow-hidden bg-background">
            <div className="grid grid-cols-[1fr_90px_120px] border-b border-border bg-surface px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Session</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Statut</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Date</div>
            </div>
            
            <div className="divide-y divide-border">
              {recentSessions.map((s: any, i: number) => (
                <div key={s.id} className={`grid grid-cols-[1fr_90px_120px] items-center px-4 py-3 ${i % 2 !== 0 ? 'bg-surface/30' : ''}`}>
                  <div className="min-w-0 pr-4">
                    <p className="font-sans font-semibold text-sm text-foreground truncate">{s.theme.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.recipientEmail || s.recipientName || 'Anonyme'}</p>
                    {isSuper && s.theme.organization && (
                      <p className="text-[10px] font-mono mt-1 text-primary">{s.theme.organization.name}</p>
                    )}
                  </div>
                  <div>
                    <Badge variant={s.status === 'DONE' ? 'active' : 'default'} className="text-[10px]">
                      {s.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDate(s.submittedAt || s.updatedAt)}
                  </div>
                </div>
              ))}
              {recentSessions.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground border-dashed border-t-0">
                  Aucune session
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
