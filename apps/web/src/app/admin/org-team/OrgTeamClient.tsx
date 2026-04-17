'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Clock, CheckCircle2, XCircle, Loader2, Send, RefreshCw, Trash2, ShieldCheck } from 'lucide-react'

type UserRole = 'SUPERADMIN' | 'ADMIN' | 'USER'
type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED'

interface Member {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  createdAt: string
}

interface Invitation {
  id: string
  email: string
  role: UserRole
  status: InvitationStatus
  expiresAt: string
  createdAt: string
  invitedBy: { email: string; firstName: string | null; lastName: string | null } | null
}

interface Props {
  members: Member[]
  invitations: Invitation[]
  currentUserId: string
  isAdmin: boolean
}

export function OrgTeamClient({ members: initialMembers, invitations: initialInvitations, currentUserId, isAdmin }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [invitations, setInvitations] = useState(initialInvitations)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'USER'>('USER')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/org/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role: inviteRole }),
      })
      if (!res.ok) throw new Error(await res.text())
      const inv = await res.json()
      setInvitations(prev => {
        const filtered = prev.filter(i => i.email !== inv.email)
        return [inv, ...filtered]
      })
      setEmail('')
      setSuccess(`Invitation envoyée à ${inv.email}`)
    } catch (err: any) {
      setError(String(err.message ?? err))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async (invEmail: string, invRole: UserRole) => {
    setResendingId(invEmail)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/org/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: invEmail, role: invRole }),
      })
      if (!res.ok) throw new Error(await res.text())
      const inv = await res.json()
      setInvitations(prev => prev.map(i => i.email === inv.email ? inv : i))
      setSuccess(`Invitation renvoyée à ${invEmail}`)
    } catch (err: any) {
      setError(String(err.message ?? err))
    } finally {
      setResendingId(null)
    }
  }

  const handleRemove = async (userId: string, memberEmail: string) => {
    if (!confirm(`Retirer ${memberEmail} de l'équipe ?`)) return
    setRemovingId(userId)
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`/api/admin/org/members/${userId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setMembers(prev => prev.filter(m => m.id !== userId))
      setSuccess(`${memberEmail} a été retiré de l'équipe.`)
    } catch (err: any) {
      setError(String(err.message ?? err))
    } finally {
      setRemovingId(null)
    }
  }

  const roleLabel = (r: UserRole) => {
    if (r === 'ADMIN') return 'Admin'
    if (r === 'SUPERADMIN') return 'Superadmin'
    return 'Membre'
  }

  const roleBadgeVariant = (r: UserRole): 'active' | 'secondary' => {
    return r === 'ADMIN' || r === 'SUPERADMIN' ? 'active' : 'secondary'
  }

  const statusLabel = (s: InvitationStatus) => {
    if (s === 'ACCEPTED') return 'Acceptée'
    if (s === 'EXPIRED') return 'Expirée'
    return 'En attente'
  }

  const statusVariant = (s: InvitationStatus): 'active' | 'secondary' | 'inactive' => {
    if (s === 'ACCEPTED') return 'active'
    if (s === 'EXPIRED') return 'inactive'
    return 'secondary'
  }

  const StatusIcon = ({ status }: { status: InvitationStatus }) => {
    if (status === 'ACCEPTED') return <CheckCircle2 size={12} className="text-emerald-600" />
    if (status === 'EXPIRED') return <XCircle size={12} className="text-muted-foreground/80" />
    return <Clock size={12} className="text-amber-600" />
  }

  return (
    <div className="max-w-4xl space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-[1px] bg-primary/40" />
          <p className="text-xs text-primary/60">Organisation</p>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Mon Équipe</h1>
        <p className="text-xs text-muted-foreground mt-2">
          {members.length} membre{members.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Invite form — admin only */}
      {isAdmin && (
        <div className="border border-border/60 bg-surface/30 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Users size={14} className="text-primary" />
            <h2 className="text-sm font-bold">Inviter un membre</h2>
          </div>
          <form onSubmit={handleInvite} className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="invite-email" className="sr-only">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemple.com"
                required
                className="text-sm"
              />
            </div>
            {/* Role toggle */}
            <div className="flex border border-border overflow-hidden h-10 shrink-0">
              <button
                type="button"
                onClick={() => setInviteRole('USER')}
                className={`px-4 text-xs transition-colors ${inviteRole === 'USER' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}
              >
                Membre
              </button>
              <div className="w-px bg-border" />
              <button
                type="button"
                onClick={() => setInviteRole('ADMIN')}
                className={`px-4 text-xs transition-colors ${inviteRole === 'ADMIN' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}
              >
                Admin
              </button>
            </div>
            <Button
              type="submit"
              disabled={loading}
              size="sm"
              className="h-10 px-6 text-xs shrink-0"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {loading ? 'Envoi...' : 'Inviter'}
            </Button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {success && <p className="text-xs text-emerald-600 font-bold">{success}</p>}
          <p className="text-xs text-muted-foreground leading-relaxed">
            Un email avec un lien d&apos;inscription sécurisé sera envoyé. Le lien est valable 7 jours.
          </p>
        </div>
      )}

      {/* Members list */}
      <div className="space-y-3">
        <h2 className="text-xs text-muted-foreground/80">
          Membres — {members.length}
        </h2>
        <div className="border border-border/60 bg-surface/30 rounded-lg overflow-hidden">
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground p-6">Aucun membre.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between px-6 py-4 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-surface-raised border border-border flex items-center justify-center text-xs font-medium text-primary overflow-hidden shrink-0">
                      {member.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">
                        {member.firstName
                          ? `${member.firstName} ${member.lastName ?? ''}`.trim()
                          : member.email.split('@')[0]}
                        {member.id === currentUserId && (
                          <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground tracking-tight truncate">
                        {member.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={roleBadgeVariant(member.role)} className="text-xs">
                      {(member.role === 'ADMIN' || member.role === 'SUPERADMIN') && (
                        <ShieldCheck size={9} className="mr-1" />
                      )}
                      {roleLabel(member.role)}
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {new Date(member.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                    {isAdmin && member.id !== currentUserId && (
                      <button
                        onClick={() => handleRemove(member.id, member.email)}
                        disabled={removingId === member.id}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all border border-transparent hover:border-destructive/30 disabled:opacity-40"
                        title="Retirer de l'équipe"
                      >
                        {removingId === member.id
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

      {/* Invitations */}
      {invitations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs text-muted-foreground/80">
            Invitations — {invitations.length}
          </h2>
          <div className="border border-border/60 bg-surface/30 rounded-lg overflow-hidden">
            <div className="divide-y divide-border/40">
              {invitations.map(inv => (
                <div key={inv.id} className="flex items-center justify-between px-6 py-4 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIcon status={inv.status} />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Invité le {new Date(inv.createdAt).toLocaleDateString('fr-FR')}
                        {inv.invitedBy && ` par ${inv.invitedBy.firstName ?? inv.invitedBy.email}`}
                        {inv.status === 'PENDING' &&
                          ` · expire le ${new Date(inv.expiresAt).toLocaleDateString('fr-FR')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {roleLabel(inv.role)}
                    </Badge>
                    <Badge variant={statusVariant(inv.status)} className="text-xs">
                      {statusLabel(inv.status)}
                    </Badge>
                    {isAdmin && inv.status !== 'ACCEPTED' && (
                      <button
                        onClick={() => handleResend(inv.email, inv.role)}
                        disabled={resendingId === inv.email}
                        className="p-1.5 rounded-lg hover:bg-surface-raised text-muted-foreground hover:text-foreground transition-all border border-transparent hover:border-border disabled:opacity-40"
                        title="Renvoyer l'invitation"
                      >
                        {resendingId === inv.email
                          ? <Loader2 size={13} className="animate-spin" />
                          : <RefreshCw size={13} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
