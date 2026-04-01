'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, LayoutGrid, Loader2, ArrowRightLeft, X, Mail, Send, Clock, CheckCircle2, XCircle, RefreshCw, UserPlus } from 'lucide-react'

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

interface OrgInvitation {
  id: string
  email: string
  role: 'ADMIN' | 'USER'
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED'
  expiresAt: string
  createdAt: string
  invitedBy: { email: string; firstName: string | null; lastName: string | null } | null
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

function InvitationsSection({ orgId }: { orgId: string }) {
  const [invitations, setInvitations] = useState<OrgInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'USER'>('USER')
  const [sending, setSending] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch(`/api/admin/organizations/${orgId}/invitations`)
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setInvitations(data) : setInvitations([]))
      .finally(() => setLoading(false))
  }, [orgId])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      if (!res.ok) throw new Error(await res.text())
      const inv = await res.json()
      setInvitations(prev => {
        const filtered = prev.filter(i => i.email !== inv.email)
        return [inv, ...filtered]
      })
      setEmail('')
      setSuccess(`Invitation envoyée à ${inv.email}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  const handleResend = async (inv: OrgInvitation) => {
    setResendingId(inv.id)
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inv.email, role: inv.role }),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated = await res.json()
      setInvitations(prev => prev.map(i => i.email === updated.email ? updated : i))
      setSuccess(`Invitation renvoyée à ${inv.email}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setResendingId(null)
    }
  }

  const StatusIcon = ({ status }: { status: OrgInvitation['status'] }) => {
    if (status === 'ACCEPTED') return <CheckCircle2 size={12} className="text-emerald-600" />
    if (status === 'EXPIRED') return <XCircle size={12} className="text-muted-foreground/80" />
    return <Clock size={12} className="text-amber-600" />
  }

  const statusLabel = (status: OrgInvitation['status']) => {
    if (status === 'ACCEPTED') return 'Acceptée'
    if (status === 'EXPIRED') return 'Expirée'
    return 'En attente'
  }

  const statusVariant = (status: OrgInvitation['status']) => {
    if (status === 'ACCEPTED') return 'active' as const
    if (status === 'EXPIRED') return 'inactive' as const
    return 'secondary' as const
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 px-1">
        <div className="w-8 h-8 rounded-sm bg-primary/5 border border-primary/10 flex items-center justify-center">
          <UserPlus size={14} className="text-primary" />
        </div>
        <h2 className="font-inter font-bold text-xl text-foreground tracking-tight">Invitations</h2>
      </div>

      {/* Invite form */}
      <div className="border border-border/60 bg-surface/30 rounded-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mail size={12} className="text-primary" />
          <p className="text-[10px] font-mono uppercase tracking-widest font-bold">Inviter un utilisateur</p>
        </div>
        <form onSubmit={handleInvite} className="flex flex-col gap-3">
          <div>
            <Label htmlFor="inv-email" className="sr-only">Email</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@exemple.com"
              required
              className="font-mono text-sm"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'ADMIN' | 'USER')}
              className="h-10 flex-1 rounded-sm border border-border bg-background px-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
            >
              <option value="USER">Membre</option>
              <option value="ADMIN">Admin</option>
            </select>
            <Button
              type="submit"
              disabled={sending || !email.trim()}
              size="sm"
              className="h-10 px-5 rounded-none font-mono text-[10px] uppercase tracking-[0.2em]"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {sending ? 'Envoi...' : 'Inviter'}
            </Button>
          </div>
        </form>
        {error && <p className="text-xs text-destructive font-mono">{error}</p>}
        {success && <p className="text-xs text-emerald-600 font-mono font-bold">{success}</p>}
        <p className="text-[10px] font-mono text-muted-foreground/40 leading-relaxed">
          Un email avec un lien d&apos;inscription sécurisé sera envoyé. Valable 7 jours.
        </p>
      </div>

      {/* Invitations list */}
      {loading ? (
        <div className="flex items-center gap-3 p-6 border border-border/40 border-dashed rounded-sm bg-surface/10">
          <Loader2 size={14} className="animate-spin text-primary/40" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Chargement...</span>
        </div>
      ) : invitations.length === 0 ? (
        <div className="border border-border/40 border-dashed p-8 text-center rounded-sm bg-surface/10">
          <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">Aucune invitation envoyée</p>
        </div>
      ) : (
        <div className="border border-border/60 bg-surface/30 rounded-sm overflow-hidden">
          <div className="divide-y divide-border/40">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusIcon status={inv.status} />
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-foreground truncate">{inv.email}</p>
                    <p className="text-[9px] font-mono text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString('fr-FR')}
                      {inv.invitedBy && ` · par ${inv.invitedBy.firstName ?? inv.invitedBy.email}`}
                      {inv.status === 'PENDING' && ` · expire le ${new Date(inv.expiresAt).toLocaleDateString('fr-FR')}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono border-border/40">
                    {inv.role === 'ADMIN' ? 'Admin' : 'Membre'}
                  </Badge>
                  <Badge variant={statusVariant(inv.status)} className="text-[9px]">
                    {statusLabel(inv.status)}
                  </Badge>
                  {inv.status !== 'ACCEPTED' && (
                    <button
                      onClick={() => handleResend(inv)}
                      disabled={resendingId === inv.id}
                      className="p-1.5 rounded-sm hover:bg-surface-raised text-muted-foreground hover:text-foreground transition-all border border-transparent hover:border-border disabled:opacity-40"
                      title="Renvoyer l'invitation"
                    >
                      {resendingId === inv.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <RefreshCw size={13} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function OrganizationDetailClient({ org, otherOrgs }: Props) {
  const [users, setUsers] = useState<OrgUser[]>(org.users)
  const [transferTarget, setTransferTarget] = useState<OrgUser | null>(null)

  const handleTransferred = (userId: string, newOrgId: string | null) => {
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

      <div className="space-y-10">
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
                      <Badge variant={u.role === 'SUPERADMIN' ? 'active' : u.role === 'ADMIN' ? 'secondary' : 'default'} className="text-[9px] px-1.5 py-0 justify-center">
                        {u.role === 'SUPERADMIN' ? 'SUPER' : u.role === 'ADMIN' ? 'ADMIN' : 'MEMBRE'}
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

        {/* Invitations section — full width */}
        <InvitationsSection orgId={org.id} />
      </div>
    </>
  )
}
