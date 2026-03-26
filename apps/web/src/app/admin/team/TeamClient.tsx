'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldCheck, Mail, Clock, CheckCircle2, XCircle, Loader2, Send, RefreshCw } from 'lucide-react'

interface Admin {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  createdAt: string
}

interface Invitation {
  id: string
  email: string
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED'
  expiresAt: string
  createdAt: string
  invitedBy: { email: string; firstName: string | null; lastName: string | null } | null
}

interface Props {
  admins: Admin[]
  invitations: Invitation[]
  currentUserId: string
}

export function TeamClient({ admins: initialAdmins, invitations: initialInvitations, currentUserId }: Props) {
  const [admins, setAdmins] = useState(initialAdmins)
  const [invitations, setInvitations] = useState(initialInvitations)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [resendingId, setResendingId] = useState<string | null>(null)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
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

  const handleResend = async (invEmail: string) => {
    setResendingId(invEmail)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: invEmail }),
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

  const statusVariant = (status: Invitation['status']) => {
    if (status === 'ACCEPTED') return 'active'
    if (status === 'EXPIRED') return 'inactive'
    return 'secondary'
  }

  const statusLabel = (status: Invitation['status']) => {
    if (status === 'ACCEPTED') return 'Acceptée'
    if (status === 'EXPIRED') return 'Expirée'
    return 'En attente'
  }

  const StatusIcon = ({ status }: { status: Invitation['status'] }) => {
    if (status === 'ACCEPTED') return <CheckCircle2 size={12} className="text-emerald-400" />
    if (status === 'EXPIRED') return <XCircle size={12} className="text-muted-foreground/40" />
    return <Clock size={12} className="text-amber-400" />
  }

  return (
    <div className="max-w-4xl space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-[1px] bg-primary/40" />
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60">Gestion</p>
        </div>
        <h1 className="font-inter font-black text-4xl text-foreground tracking-tighter">Équipe</h1>
        <p className="text-[11px] font-mono text-muted-foreground/60 mt-2 uppercase tracking-widest">
          Superadmins et invitations
        </p>
      </div>

      {/* Invite form */}
      <div className="border border-border/60 bg-surface/30 rounded-sm p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={14} className="text-primary" />
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest">Inviter un superadmin</h2>
        </div>
        <form onSubmit={handleInvite} className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="invite-email" className="sr-only">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@exemple.com"
              required
              className="font-mono text-sm"
            />
          </div>
          <Button type="submit" disabled={loading} size="sm" className="h-10 px-6 rounded-none font-mono text-[10px] uppercase tracking-[0.2em]">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {loading ? 'Envoi...' : 'Inviter'}
          </Button>
        </form>
        {error && <p className="text-xs text-destructive font-mono">{error}</p>}
        {success && <p className="text-xs text-emerald-400 font-mono">{success}</p>}
        <p className="text-[10px] font-mono text-muted-foreground/40">
          Un email avec un lien d&apos;inscription sécurisé sera envoyé. Le lien est valable 7 jours et ne peut être utilisé qu&apos;une seule fois avec l&apos;adresse email indiquée.
        </p>
      </div>

      {/* Superadmins list */}
      <div className="space-y-3">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
          Superadmins actifs — {admins.length}
        </h2>
        <div className="border border-border/60 bg-surface/30 rounded-sm overflow-hidden">
          {admins.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground/40 p-6">Aucun superadmin.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {admins.map(admin => (
                <div key={admin.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-surface-raised border border-border flex items-center justify-center font-mono text-xs font-bold text-primary">
                      {admin.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {admin.firstName ? `${admin.firstName} ${admin.lastName ?? ''}`.trim() : admin.email.split('@')[0]}
                        {admin.id === currentUserId && <span className="ml-2 text-[9px] font-mono text-muted-foreground/40">(vous)</span>}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground/50">{admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="active" className="text-[9px]">
                      <ShieldCheck size={9} className="mr-1" />
                      Superadmin
                    </Badge>
                    <span className="text-[9px] font-mono text-muted-foreground/30">
                      {new Date(admin.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invitations list */}
      {invitations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
            Invitations — {invitations.length}
          </h2>
          <div className="border border-border/60 bg-surface/30 rounded-sm overflow-hidden">
            <div className="divide-y divide-border/40">
              {invitations.map(inv => (
                <div key={inv.id} className="flex items-center justify-between px-6 py-4 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIcon status={inv.status} />
                    <div className="min-w-0">
                      <p className="text-sm font-mono text-foreground truncate">{inv.email}</p>
                      <p className="text-[9px] font-mono text-muted-foreground/40">
                        Invité le {new Date(inv.createdAt).toLocaleDateString('fr-FR')}
                        {inv.invitedBy && ` par ${inv.invitedBy.firstName ?? inv.invitedBy.email}`}
                        {inv.status === 'PENDING' && ` · expire le ${new Date(inv.expiresAt).toLocaleDateString('fr-FR')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={statusVariant(inv.status)} className="text-[9px]">
                      {statusLabel(inv.status)}
                    </Badge>
                    {inv.status !== 'ACCEPTED' && (
                      <button
                        onClick={() => handleResend(inv.email)}
                        disabled={resendingId === inv.email}
                        className="p-1.5 rounded-sm hover:bg-surface-raised text-muted-foreground hover:text-foreground transition-all border border-transparent hover:border-border disabled:opacity-40"
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
