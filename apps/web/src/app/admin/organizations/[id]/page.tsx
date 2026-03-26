import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { OrganizationDetailClient } from './OrganizationDetailClient'

export default async function OrganizationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || user.role !== 'SUPERADMIN') redirect('/admin')

  const { id } = await params

  const [org, allOrgs] = await Promise.all([
    prisma.organization.findUnique({
      where: { id },
      include: {
        users: { orderBy: { createdAt: 'desc' } },
        themes: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { sessions: true } } },
        },
      },
    }),
    prisma.organization.findMany({
      where: { id: { not: id } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
  ])

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

      <OrganizationDetailClient
        org={{
          ...org,
          createdAt: org.createdAt.toISOString(),
          updatedAt: org.updatedAt.toISOString(),
          users: org.users.map(u => ({
            ...u,
            createdAt: u.createdAt.toISOString(),
            updatedAt: u.updatedAt.toISOString(),
          })),
          themes: org.themes.map(t => ({
            ...t,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
          })),
        }}
        otherOrgs={allOrgs}
      />
    </div>
  )
}
