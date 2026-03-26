'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, LayoutGrid, Loader2, ArrowRightLeft, X } from 'lucide-react'

interface OrgUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  organizationId: string | null
  createdAt: string
  updatedAt: string
}

interface OrgTheme {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  _count: { sessions: number }
}

interface OrgData {
  id: string
  name: string
  slug: string
  status: string
  createdAt: string
  updatedAt: string
  users: OrgUser[]
  themes: OrgTheme[]
}

interface OtherOrg {
  id: string
  name: string
  slug: string
}

interface Props {
  org: OrgData
  otherOrgs: OtherOrg[]
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

interface TransferModalProps {
  user: OrgUser
  otherOrgs: OtherOrg[]
  onClose: () => void
  onTransferred: (userId: string, newOrgId: string | null) => void
}

function TransferModal({ user, otherOrgs, onClose, onTransferred }: TransferModalProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email

  const handleTransfer = async () => {
    if (!selectedOrgId && selectedOrgId !== 'null') return
    setLoading(true)
    setError('')
    try {
      const orgId = selectedOrgId === 'null' ? null : selectedOrgId
      const res = await fetch(`/api/admin/users/${user.id}/organization`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      })
      if (!res.ok) {
        setError(await res.text())
        return
      }
      onTransferred(user.id, orgId)
      onClose()
    } catch {
      setError('Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md border border-border bg-background shadow-2xl rounded-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary/60 mb-1">Transférer l&apos;utilisateur</p>
            <h3 className="font-inter font-bold text-lg text-foreground tracking-tight">{displayName}</h3>
            <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-sm border border-border hover:border-primary/40 hover:text-primary transition-all text-muted-foreground"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
              Organisation destination
            </label>
            <select
              value={selectedOrgId}
              onChange={e => setSelectedOrgId(e.target.value)}
              className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
            >
              <option value="">-- Choisir une organisation --</option>
              <option value="null">Retirer de toute organisation</option>
              {otherOrgs.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.slug})
                </option>
              ))}
            </select>
            <p className="text-[10px] font-mono text-muted-foreground/40">
              Les thèmes et sessions de cet utilisateur restent dans l&apos;organisation source.
            </p>
          </div>

          {error && <p className="text-xs text-destructive font-mono">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-1 rounded-none text-[10px] font-mono uppercase tracking-widest"
            >
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={loading || !selectedOrgId}
              onClick={handleTransfer}
              className="flex-1 rounded-none text-[10px] font-mono uppercase tracking-widest"
            >
              {loading ? <Loader2 size={10} className="animate-spin mr-2" /> : <ArrowRightLeft size={10} className="mr-2" />}
              {loading ? 'Transfert...' : 'Confirmer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OrganizationDetailClient({ org, otherOrgs }: Props) {
  const [users, setUsers] = useState<OrgUser[]>(org.users)
  const [transferTarget, setTransferTarget] = useState<OrgUser | null>(null)

  const handleTransferred = (userId: string, newOrgId: string | null) => {
    // Remove user from this org's list if they were moved elsewhere or unassigned
    if (newOrgId !== org.id) {
      setUsers(prev => prev.filter(u => u.id !== userId))
    }
  }

  return (
    <>
      {transferTarget && (
        <TransferModal
          user={transferTarget}
          otherOrgs={otherOrgs}
          onClose={() => setTransferTarget(null)}
          onTransferred={handleTransferred}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Users List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-primary/5 border border-primary/10 flex items-center justify-center">
                <Users size={14} className="text-primary" />
              </div>
              <h2 className="font-inter font-bold text-xl text-foreground tracking-tight">
                Utilisateurs ({users.length})
              </h2>
            </div>
          </div>

          <div className="border border-border/60 bg-surface/30 rounded-sm overflow-hidden backdrop-blur-sm shadow-sm">
            <div className="divide-y divide-border/40">
              {users.map((u) => (
                <div key={u.id} className="grid grid-cols-[1fr_80px_44px] items-center px-6 py-5 hover:bg-primary/[0.02] transition-colors group">
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
                  <div>
                    <Badge variant={u.role === 'SUPERADMIN' ? 'active' : 'default'} className="text-[9px] px-1.5 py-0 justify-center">
                      {u.role === 'SUPERADMIN' ? 'SUPER' : 'MEMBRE'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      title="Transférer vers une autre organisation"
                      onClick={() => setTransferTarget(u)}
                      className="w-8 h-8 flex items-center justify-center rounded-sm border border-border/40 hover:border-primary/40 hover:bg-primary/5 hover:text-primary text-muted-foreground/40 transition-all"
                    >
                      <ArrowRightLeft size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {users.length === 0 && (
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
    </>
  )
}
