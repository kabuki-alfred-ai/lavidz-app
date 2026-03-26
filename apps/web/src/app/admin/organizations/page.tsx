'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Building2, Search, Users, LayoutGrid, CheckCircle2, PauseCircle, RotateCcw, UserX, ArrowRightLeft } from 'lucide-react'

interface Org {
  id: string
  name: string
  slug: string
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED'
  createdAt: string
  _count: { users: number; themes: number }
}

interface UnassignedUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  organizationId: string | null
  createdAt: string
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [unassignedUsers, setUnassignedUsers] = useState<UnassignedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingUnassigned, setLoadingUnassigned] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<Record<string, string>>({})
  const [assignError, setAssignError] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/organizations')
      .then(r => r.json())
      .then(setOrgs)
      .finally(() => setLoading(false))

    fetch('/api/admin/users?withoutOrg=true')
      .then(r => r.json())
      .then(setUnassignedUsers)
      .finally(() => setLoadingUnassigned(false))
  }, [])

  const updateStatus = async (id: string, status: Org['status']) => {
    setUpdating(id)
    const res = await fetch(`/api/admin/organizations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setOrgs(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    }
    setUpdating(null)
  }

  const assignOrganization = async (userId: string) => {
    const orgId = selectedOrg[userId]
    if (!orgId) return
    setAssigning(userId)
    setAssignError(prev => ({ ...prev, [userId]: '' }))
    try {
      const res = await fetch(`/api/admin/users/${userId}/organization`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      })
      if (!res.ok) {
        const errorText = await res.text()
        setAssignError(prev => ({ ...prev, [userId]: errorText }))
        return
      }
      setUnassignedUsers(prev => prev.filter(u => u.id !== userId))
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, _count: { ...o._count, users: o._count.users + 1 } } : o))
    } catch {
      setAssignError(prev => ({ ...prev, [userId]: 'Une erreur est survenue.' }))
    } finally {
      setAssigning(null)
    }
  }

  const filteredOrgs = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-6xl space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-[1px] bg-primary/40" />
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60">
              Superadmin
            </p>
          </div>
          <h1 className="font-inter font-black text-4xl text-foreground tracking-tighter">
            Organisations
          </h1>
          <p className="text-[11px] font-mono text-muted-foreground/60 mt-2 uppercase tracking-widest leading-relaxed">
            Gestion des accès et des structures partenaires
          </p>
        </div>

        <div className="relative w-full md:w-80 group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Rechercher une org..."
            className="pl-10 h-10 bg-surface/30 border-border/40 focus:border-primary/40 transition-all rounded-sm font-mono text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Organisations list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 border border-border/40 border-dashed rounded-sm bg-surface/10">
          <Loader2 size={24} className="animate-spin text-primary/40 mb-4" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
            Initialisation de la liste...
          </span>
        </div>
      ) : filteredOrgs.length === 0 ? (
        <div className="border border-border/40 border-dashed p-20 text-center rounded-sm bg-surface/10">
          <Building2 size={32} className="mx-auto text-muted-foreground/20 mb-4" />
          <p className="text-sm font-inter font-bold text-foreground">Aucune organisation trouvée</p>
          <p className="text-[10px] font-mono text-muted-foreground/40 mt-1 uppercase tracking-widest">
            {search ? 'Modifiez votre recherche' : 'Commencez par en créer une'}
          </p>
        </div>
      ) : (
        <div className="border border-border/60 bg-surface/30 rounded-sm overflow-hidden backdrop-blur-sm shadow-sm animate-in fade-in duration-500">
          <div className="grid grid-cols-[1fr_140px_100px_100px_220px] border-b border-border/40 bg-surface/50 px-6 py-4">
            {['Organisation', 'Statut', 'Utilisateurs', 'Thèmes', 'Actions'].map(h => (
              <div key={h} className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">{h}</div>
            ))}
          </div>

          <div className="divide-y divide-border/40">
            {filteredOrgs.map((org) => (
              <div key={org.id} className="grid grid-cols-[1fr_140px_100px_100px_220px] items-center px-6 py-5 hover:bg-primary/[0.02] transition-colors group">
                <div className="pr-4">
                  <Link href={`/admin/organizations/${org.id}`} className="font-inter font-bold text-[14px] text-foreground group-hover:text-primary transition-colors hover:underline underline-offset-4 decoration-primary/30">
                    {org.name}
                  </Link>
                  <code className="text-[10px] font-mono text-muted-foreground/40 block mt-1 tracking-wider">{org.slug}</code>
                </div>

                <div>
                  <Badge variant={org.status === 'ACTIVE' ? 'active' : org.status === 'PENDING' ? 'default' : 'inactive'}>
                    {org.status === 'ACTIVE' ? 'Actif' : org.status === 'PENDING' ? 'En attente' : 'Suspendu'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground/60">
                  <Users size={12} className="opacity-40" />
                  {org._count.users}
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground/60">
                  <LayoutGrid size={12} className="opacity-40" />
                  {org._count.themes}
                </div>

                <div className="flex items-center gap-2">
                  {org.status !== 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === org.id}
                      className="h-8 rounded-none border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400 text-[10px] font-mono uppercase tracking-widest px-3"
                      onClick={() => updateStatus(org.id, 'ACTIVE')}>
                      {updating === org.id ? <Loader2 size={10} className="animate-spin" /> : <><CheckCircle2 size={12} className="mr-2" /> Activer</>}
                    </Button>
                  )}
                  {org.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === org.id}
                      className="h-8 rounded-none border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/10 text-orange-400 text-[10px] font-mono uppercase tracking-widest px-3"
                      onClick={() => updateStatus(org.id, 'SUSPENDED')}>
                      {updating === org.id ? <Loader2 size={10} className="animate-spin" /> : <><PauseCircle size={12} className="mr-2" /> Suspendre</>}
                    </Button>
                  )}
                  {org.status === 'SUSPENDED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === org.id}
                      className="h-8 rounded-none border-primary/20 hover:border-primary/40 hover:bg-primary/10 text-primary text-[10px] font-mono uppercase tracking-widest px-3"
                      onClick={() => updateStatus(org.id, 'PENDING')}>
                      {updating === org.id ? <Loader2 size={10} className="animate-spin" /> : <><RotateCcw size={12} className="mr-2" /> Reset</>}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned users section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-orange-500/5 border border-orange-500/20 flex items-center justify-center">
            <UserX size={14} className="text-orange-400" />
          </div>
          <div>
            <h2 className="font-inter font-bold text-xl text-foreground tracking-tight">
              Utilisateurs sans organisation
              {!loadingUnassigned && (
                <span className="ml-2 text-sm font-mono text-muted-foreground/50">({unassignedUsers.length})</span>
              )}
            </h2>
            <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest mt-0.5">
              Ces utilisateurs ne sont rattachés à aucune organisation
            </p>
          </div>
        </div>

        {loadingUnassigned ? (
          <div className="flex items-center gap-3 p-8 border border-border/40 border-dashed rounded-sm bg-surface/10">
            <Loader2 size={16} className="animate-spin text-primary/40" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">Chargement...</span>
          </div>
        ) : unassignedUsers.length === 0 ? (
          <div className="border border-border/40 border-dashed p-12 text-center rounded-sm bg-surface/10">
            <CheckCircle2 size={24} className="mx-auto text-emerald-500/30 mb-3" />
            <p className="text-sm font-inter font-bold text-foreground">Tous les utilisateurs ont une organisation</p>
            <p className="text-[10px] font-mono text-muted-foreground/40 mt-1 uppercase tracking-widest">
              Aucun utilisateur non assigné
            </p>
          </div>
        ) : (
          <div className="border border-orange-500/20 bg-surface/30 rounded-sm overflow-hidden backdrop-blur-sm shadow-sm">
            <div className="grid grid-cols-[1fr_120px_1fr_120px] border-b border-border/40 bg-orange-500/[0.03] px-6 py-4">
              {['Utilisateur', 'Rôle', 'Assigner à', 'Action'].map(h => (
                <div key={h} className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">{h}</div>
              ))}
            </div>

            <div className="divide-y divide-border/40">
              {unassignedUsers.map((u) => (
                <div key={u.id} className="grid grid-cols-[1fr_120px_1fr_120px] items-center px-6 py-5 hover:bg-orange-500/[0.02] transition-colors">
                  <div className="pr-4 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-sm bg-surface-raised border border-border flex items-center justify-center font-mono font-bold text-xs text-primary shrink-0">
                        {u.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">
                          {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground/50 truncate mt-0.5">{u.email}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Badge variant={u.role === 'SUPERADMIN' ? 'active' : 'default'} className="text-[9px] px-1.5 py-0">
                      {u.role === 'SUPERADMIN' ? 'SUPER' : u.role === 'ADMIN' ? 'ADMIN' : 'MEMBRE'}
                    </Badge>
                  </div>

                  <div className="pr-4">
                    <select
                      value={selectedOrg[u.id] ?? ''}
                      onChange={e => setSelectedOrg(prev => ({ ...prev, [u.id]: e.target.value }))}
                      className="h-9 w-full rounded-sm border border-border bg-background px-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
                    >
                      <option value="">-- Choisir --</option>
                      {orgs.map(org => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                    {assignError[u.id] && (
                      <p className="text-[10px] text-destructive font-mono mt-1">{assignError[u.id]}</p>
                    )}
                  </div>

                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={assigning === u.id || !selectedOrg[u.id]}
                      onClick={() => assignOrganization(u.id)}
                      className="h-8 rounded-none border-primary/20 hover:border-primary/40 hover:bg-primary/10 text-primary text-[10px] font-mono uppercase tracking-widest px-3"
                    >
                      {assigning === u.id
                        ? <Loader2 size={10} className="animate-spin" />
                        : <><ArrowRightLeft size={10} className="mr-1.5" /> Assigner</>
                      }
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
