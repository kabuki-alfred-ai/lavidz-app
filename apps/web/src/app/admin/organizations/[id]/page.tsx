import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Users, LayoutGrid, Clock, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default async function OrganizationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || user.role !== 'SUPERADMIN') redirect('/admin')

  const { id } = await params

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      users: {
        orderBy: { createdAt: 'desc' },
      },
      themes: {
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { sessions: true } } },
      },
    },
  })

  if (!org) redirect('/admin/organizations')

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date))
  }

  return (
    <div className="max-w-6xl space-y-12 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href="/admin/organizations" 
              className="flex items-center justify-center w-8 h-8 rounded-sm bg-surface disabled text-muted-foreground border border-border hover:border-primary/40 hover:text-primary hover:bg-surface-raised transition-all"
            >
              <ChevronLeft size={16} />
            </Link>
            <div className="flex items-center gap-2">
              <span className="w-8 h-[1px] bg-primary/40" />
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60">
                Fiche Organisation
              </p>
            </div>
          </div>
          <h1 className="font-inter font-black text-4xl text-foreground tracking-tighter">
            {org.name}
          </h1>
          <div className="flex items-center gap-6 mt-4">
            <Badge variant={org.status === 'ACTIVE' ? 'active' : org.status === 'PENDING' ? 'default' : 'inactive'}>
              {org.status === 'ACTIVE' ? 'Actif' : org.status === 'PENDING' ? 'En attente' : 'Suspendu'}
            </Badge>
            <code className="text-[12px] font-mono text-muted-foreground/60 bg-surface px-2 py-0.5 rounded-sm border border-border/40">
              {org.slug}
            </code>
            <p className="text-[10px] font-mono text-muted-foreground/40 flex items-center gap-1.5 uppercase tracking-widest">
              <Clock size={12} /> {formatDate(org.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Users List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-primary/5 border border-primary/10 flex items-center justify-center">
                <Users size={14} className="text-primary" />
              </div>
              <h2 className="font-inter font-bold text-xl text-foreground tracking-tight">
                Utilisateurs ({org.users.length})
              </h2>
            </div>
          </div>
          
          <div className="border border-border/60 bg-surface/30 rounded-sm overflow-hidden backdrop-blur-sm shadow-sm">
            <div className="divide-y divide-border/40">
              {org.users.map((u) => (
                <div key={u.id} className="grid grid-cols-[1fr_80px_100px] items-center px-6 py-5 hover:bg-primary/[0.02] transition-colors group">
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-4 group">
                      <div className="w-10 h-10 rounded-sm bg-surface-raised border border-border flex items-center justify-center font-mono font-bold text-primary group-hover:border-primary/50 transition-colors shrink-0">
                        {u.email[0].toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                          {[u.firstName, u.lastName].filter(Boolean).join(' ') || (u.role === 'SUPERADMIN' ? 'Admin Système' : 'Client')}
                        </h4>
                        <p className="text-[10px] font-mono text-muted-foreground/60 truncate mt-0.5">{u.email}</p>
                      </div>
                    </div>
                  </div>
                  <Badge variant={u.role === 'SUPERADMIN' ? 'active' : 'default'} className="text-[9px] px-1.5 py-0 justify-center">
                    {u.role === 'SUPERADMIN' ? 'SUPER' : 'MEMBRE'}
                  </Badge>
                  <div className="text-[10px] font-mono text-muted-foreground/40 text-right">
                    {formatDate(u.createdAt)}
                  </div>
                </div>
              ))}
              {org.users.length === 0 && (
                <div className="p-12 text-center text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                  Aucun utilisateur lié
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Themes List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-primary/5 border border-primary/10 flex items-center justify-center">
                <LayoutGrid size={14} className="text-primary" />
              </div>
              <h2 className="font-inter font-bold text-xl text-foreground tracking-tight">
                Thèmes ({org.themes.length})
              </h2>
            </div>
          </div>
          
          <div className="border border-border/60 bg-surface/30 rounded-sm overflow-hidden backdrop-blur-sm shadow-sm">
            <div className="divide-y divide-border/40">
              {org.themes.map((t) => (
                <div key={t.id} className="p-5 hover:bg-primary/[0.02] transition-colors group flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-inter font-bold text-[14px] text-foreground group-hover:text-primary transition-colors truncate">
                      {t.name}
                    </p>
                    {t.description && (
                      <p className="text-[10px] font-mono text-muted-foreground/50 mt-1 max-w-[280px] truncate uppercase tracking-widest leading-relaxed">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] font-mono border-border/60 uppercase tracking-widest text-muted-foreground group-hover:border-primary/20 group-hover:text-primary transition-colors">
                    {t._count.sessions} sess.
                  </Badge>
                </div>
              ))}
              {org.themes.length === 0 && (
                <div className="p-12 text-center text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                  Aucun thème créé
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
