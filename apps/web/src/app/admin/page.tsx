import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Video, Clock, Building2, LayoutGrid, ArrowUpRight, CheckCircle2 } from 'lucide-react'

export default async function AdminDashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')

  const isSuper = user.role === 'SUPERADMIN'
  // When SUPERADMIN has switched to an org context, scope data to that org
  const effectiveOrgId = isSuper ? (user.activeOrgId ?? null) : user.organizationId
  const orgFilter = effectiveOrgId ? { organizationId: effectiveOrgId } : {}
  const sessionFilter = effectiveOrgId ? { theme: { organizationId: effectiveOrgId } } : {}

  // Fetch Stats
  const [
    totalUsers,
    totalSessions,
    totalThemes,
    totalOrgs,
    completedSessions,
    recentUsers,
    recentSessions
  ] = await Promise.all([
    prisma.user.count({ where: orgFilter }),
    prisma.session.count({
      where: {
        ...sessionFilter,
        status: { notIn: ['PENDING', 'RECORDING'] }
      }
    }),
    prisma.theme.count({ where: orgFilter }),
    isSuper ? prisma.organization.count() : Promise.resolve(0),
    prisma.session.count({
      where: {
        ...sessionFilter,
        status: 'DONE'
      }
    }),
    prisma.user.findMany({
      where: orgFilter,
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { organization: true }
    }),
    prisma.session.findMany({
      where: {
        ...sessionFilter,
        status: { notIn: ['PENDING', 'RECORDING'] }
      },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      include: { theme: { include: { organization: true } } }
    })
  ])

  const formatDate = (date: Date | null | string) => {
    if (!date) return '-'
    return new Intl.DateTimeFormat('fr-FR', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    }).format(new Date(date))
  }

  const StatCard = ({ title, value, sub, icon: Icon, color = 'primary' }: any) => (
    <Card className="relative overflow-hidden group hover:border-primary/50 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              {title}
            </p>
            <h3 className="text-3xl font-inter font-semibold tracking-tight text-foreground">
              {value}
            </h3>
            {sub && (
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                {sub}
              </p>
            )}
          </div>
          <div className={`p-2.5 rounded-lg bg-surface-raised border border-border group-hover:border-primary/20 transition-colors`}>
            <Icon size={18} className="text-primary/60 group-hover:text-primary transition-colors" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-primary group-hover:w-full transition-all duration-500" />
      </CardContent>
    </Card>
  )

  return (
    <div className="max-w-6xl space-y-12">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-[1px] bg-primary/40" />
            <p className="text-xs text-primary/60">
              Overview
            </p>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Vue d'ensemble
          </h1>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <StatCard title="Utilisateurs" value={totalUsers} sub="Inscrits sur la plateforme" icon={Users} />
        <StatCard title="Sessions" value={totalSessions} sub={`${completedSessions} terminées`} icon={Video} />
        <StatCard title="Thèmes" value={totalThemes} sub="Bibliothèque active" icon={LayoutGrid} />
        {isSuper ? (
          <StatCard title="Organizations" value={totalOrgs} sub="Partenaires pro" icon={Building2} />
        ) : (
          <StatCard title="Complétées" value={completedSessions} sub="Taux de complétion" icon={CheckCircle2} />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        {/* Utilisateurs Section */}
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700 delay-100">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center">
                <Users size={14} className="text-primary" />
              </div>
              <h2 className="font-inter font-bold text-xl text-foreground tracking-tight">Utilisateurs récents</h2>
            </div>
            <Link href={isSuper ? "/admin/users" : "#"} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              Voir tout <ArrowUpRight size={10} />
            </Link>
          </div>
          
          <div className="border border-border/60 bg-surface/30 rounded-lg overflow-hidden backdrop-blur-sm">
            <div className="grid grid-cols-[1fr_100px_120px] border-b border-border/40 bg-surface/50 px-5 py-4">
              {['Utilisateur', 'Rôle', 'Inscription'].map(h => (
                <div key={h} className="text-xs text-muted-foreground">{h}</div>
              ))}
            </div>
            
            <div className="divide-y divide-border/40">
              {recentUsers.map((u: any) => (
                <div key={u.id} className="grid grid-cols-[1fr_100px_120px] items-center px-5 py-4 hover:bg-primary/[0.02] transition-colors group">
                  <div className="min-w-0 pr-4">
                    <p className="font-inter font-bold text-[13px] text-foreground group-hover:text-primary transition-colors">{[u.firstName, u.lastName].filter(Boolean).join(' ') || (isSuper ? u.email : u.email.split('@')[0])}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    {isSuper && u.organization && (
                      <p className="text-xs mt-1 text-primary/70 uppercase tracking-tighter">{u.organization.name}</p>
                    )}
                  </div>
                  <div>
                    <Badge variant={u.role === 'SUPERADMIN' ? 'active' : 'default'} className="text-xs px-1.5 py-0">
                      {u.role}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </div>
                </div>
              ))}
              {recentUsers.length === 0 && (
                <div className="p-12 text-center text-xs text-muted-foreground/40">
                  Aucun utilisateur
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sessions Section */}
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-700 delay-100">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center">
                <Video size={14} className="text-primary" />
              </div>
              <h2 className="font-inter font-bold text-xl text-foreground tracking-tight">Dernières sessions</h2>
            </div>
            <Link href="/admin/montage" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              Gérer <ArrowUpRight size={10} />
            </Link>
          </div>
          
          <div className="border border-border/60 bg-surface/30 rounded-lg overflow-hidden backdrop-blur-sm">
            <div className="grid grid-cols-[1fr_90px_130px] border-b border-border/40 bg-surface/50 px-5 py-4">
              {['Thème / Bénéficiaire', 'Statut', 'Dernière MAJ'].map(h => (
                <div key={h} className="text-xs text-muted-foreground">{h}</div>
              ))}
            </div>
            
            <div className="divide-y divide-border/40">
              {recentSessions.map((s: any) => (
                <div key={s.id} className="grid grid-cols-[1fr_90px_130px] items-center px-5 py-4 hover:bg-primary/[0.02] transition-colors group">
                  <div className="min-w-0 pr-4">
                    <p className="font-inter font-bold text-[13px] text-foreground group-hover:text-primary transition-colors truncate">{s.theme.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.recipientEmail || s.recipientName || 'Anonyme'}</p>
                    {isSuper && s.theme.organization && (
                      <p className="text-xs mt-1 text-primary/70 uppercase tracking-tighter">{s.theme.organization.name}</p>
                    )}
                  </div>
                  <div>
                    <Badge variant={s.status === 'DONE' ? 'active' : 'default'} className="text-xs px-1.5 py-0">
                      {s.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock size={10} />
                    {formatDate(s.submittedAt || s.updatedAt)}
                  </div>
                </div>
              ))}
              {recentSessions.length === 0 && (
                <div className="p-12 text-center text-xs text-muted-foreground/40">
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
