'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Building2, Loader2, ShieldCheck, Trash2, Users } from 'lucide-react'

type UserRole = 'ADMIN' | 'USER'

interface UserItem {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  organizationId: string | null
  organization: { name: string; slug: string } | null
  createdAt: string
}

interface Props {
  users: UserItem[]
  currentUserId: string
}

export function UsersClient({ users: initial, currentUserId }: Props) {
  const [users, setUsers] = useState(initial)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.firstName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.lastName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.organization?.name ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const handleDelete = async (u: UserItem) => {
    if (!confirm(`Supprimer définitivement ${u.email} et toutes ses données ?\n\nCette action est irréversible.`)) return
    setDeletingId(u.id)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setUsers(prev => prev.filter(x => x.id !== u.id))
    } catch (err: any) {
      setError(String(err.message ?? err))
    } finally {
      setDeletingId(null)
    }
  }

  const roleLabel = (r: UserRole) => r === 'ADMIN' ? 'Admin' : 'Membre'
  const roleBadgeVariant = (r: UserRole): 'active' | 'secondary' => r === 'ADMIN' ? 'active' : 'secondary'

  return (
    <div className="max-w-4xl space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-[1px] bg-primary/40" />
          <p className="text-xs text-primary/60">Plateforme</p>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Utilisateurs</h1>
        <p className="text-xs text-muted-foreground mt-2">
          {users.length} utilisateur{users.length > 1 ? 's' : ''} (hors super-admins)
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par email, nom ou organisation…"
          className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* List */}
      <div className="space-y-3">
        <h2 className="text-xs text-muted-foreground/80">
          {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
        </h2>
        <div className="border border-border/60 bg-surface/30 rounded-lg overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Users size={24} className="opacity-30" />
              <p className="text-xs">{search ? 'Aucun résultat.' : 'Aucun utilisateur.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filtered.map(u => (
                <div key={u.id} className="flex items-center justify-between px-6 py-4 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-surface-raised border border-border flex items-center justify-center text-xs font-medium text-primary overflow-hidden shrink-0">
                      {u.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">
                        {u.firstName
                          ? `${u.firstName} ${u.lastName ?? ''}`.trim()
                          : u.email.split('@')[0]}
                        {u.id === currentUserId && (
                          <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground tracking-tight truncate">{u.email}</p>
                      {u.organization && (
                        <p className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                          <Building2 size={9} />
                          {u.organization.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={roleBadgeVariant(u.role)} className="text-xs">
                      {u.role === 'ADMIN' && <ShieldCheck size={9} className="mr-1" />}
                      {roleLabel(u.role)}
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={deletingId === u.id}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all border border-transparent hover:border-destructive/30 disabled:opacity-40"
                        title="Supprimer l'utilisateur et ses données"
                      >
                        {deletingId === u.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
