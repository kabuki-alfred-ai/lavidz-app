'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  Loader2, Scissors, Send, Copy, Check, ExternalLink,
  History, Clock, Video, Play, Download, ChevronDown, ChevronUp,
  Link as LinkIcon, Plus, Mail, User, Sparkles, Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ThemeDto } from '@lavidz/types'

interface RawRecording {
  id: string
  questionText: string
  questionOrder: number
  signedUrl: string
}

interface SubmittedSession {
  id: string
  status: string
  recipientEmail?: string
  recipientName?: string
  version: number
  finalVideoKey?: string
  submittedAt?: string
  deliveredAt?: string
  theme: { id: string; name: string; slug: string }
}

interface SessionGroup {
  key: string
  recipientEmail: string
  recipientName?: string
  themeId: string
  themeName: string
  sessions: SubmittedSession[]
}

interface Props {
  themes: ThemeDto[]
  initialSessions: SubmittedSession[]
}

const STATUS: Record<string, { label: string; variant: 'default' | 'active' | 'secondary' | 'destructive' | 'outline' | 'inactive' }> = {
  SUBMITTED:  { label: 'Soumise',   variant: 'default' },
  PROCESSING: { label: 'En cours',  variant: 'secondary' },
  DONE:       { label: 'Livrée',    variant: 'active' },
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function groupSessions(sessions: SubmittedSession[]): SessionGroup[] {
  const map = new Map<string, SessionGroup>()
  for (const s of sessions) {
    const key = `${s.recipientEmail ?? ''}__${s.theme?.id ?? ''}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        recipientEmail: s.recipientEmail ?? '',
        recipientName: s.recipientName,
        themeId: s.theme?.id ?? '',
        themeName: s.theme?.name ?? '',
        sessions: [],
      })
    }
    map.get(key)!.sessions.push(s)
  }
  // Sort sessions within each group by version asc
  for (const g of map.values()) {
    g.sessions.sort((a, b) => a.version - b.version)
  }
  return Array.from(map.values())
}

export function MontageClient({ themes, initialSessions }: Props) {
  const [sessions, setSessions] = useState<SubmittedSession[]>(initialSessions)

  // Form
  const [themeId, setThemeId] = useState(themes[0]?.id ?? '')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [createError, setCreateError] = useState('')

  // Invite
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [inviteError, setInviteError] = useState('')

  // Deliver
  const [delivering, setDelivering] = useState<string | null>(null)
  const [deliverSuccess, setDeliverSuccess] = useState<string | null>(null)
  const [deliverError, setDeliverError] = useState<string | null>(null)

  // Raws
  const [expandedRaws, setExpandedRaws] = useState<string | null>(null)
  const [rawsCache, setRawsCache] = useState<Record<string, RawRecording[]>>({})
  const [loadingRaws, setLoadingRaws] = useState<string | null>(null)

  const handleToggleRaws = async (sessionId: string) => {
    if (expandedRaws === sessionId) { setExpandedRaws(null); return }
    setExpandedRaws(sessionId)
    if (rawsCache[sessionId]) return
    setLoadingRaws(sessionId)
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/recordings`)
      if (res.ok) {
        const data = await res.json()
        setRawsCache(p => ({ ...p, [sessionId]: data }))
      }
    } finally {
      setLoadingRaws(null)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setShareUrl(null)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId, recipientEmail, recipientName: recipientName || undefined }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setCreatedSessionId(data.sessionId)
      setShareUrl(data.shareUrl)
      setInviteSuccess(false)
      setInviteError('')
      setRecipientEmail('')
      setRecipientName('')
    } catch (err) {
      setCreateError(String(err))
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleInvite = async () => {
    if (!createdSessionId || !shareUrl) return
    setInviting(true)
    setInviteError('')
    try {
      const res = await fetch(`/api/admin/sessions/${createdSessionId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareUrl }),
      })
      if (!res.ok) throw new Error(await res.text())
      setInviteSuccess(true)
    } catch (err) {
      setInviteError(String(err))
    } finally {
      setInviting(false)
    }
  }

  const handleDeliver = async (sessionId: string) => {
    setDelivering(sessionId)
    setDeliverSuccess(null)
    setDeliverError(null)
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/deliver`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      setDeliverSuccess(sessionId)
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'DONE' } : s))
    } catch (err) {
      setDeliverError(String(err))
    } finally {
      setDelivering(null)
    }
  }

  const handleDelete = async (sessionId: string) => {
    const res = await fetch(`/api/admin/sessions/${sessionId}`, { method: 'DELETE' })
    if (res.ok) setSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Download failed', err)
      window.open(url, '_blank')
    }
  }

  const pendingGroups = useMemo(() => groupSessions(sessions.filter(s => s.status !== 'DONE')), [sessions])
  const historyGroups = useMemo(() => groupSessions(sessions.filter(s => s.status === 'DONE')), [sessions])

  return (
    <div className="max-w-6xl space-y-12 animate-in fade-in duration-700">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-[1px] bg-primary/40" />
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60">
            Workflow
          </p>
        </div>
        <h1 className="font-inter font-black text-4xl text-foreground tracking-tighter">
          Espace Montage
        </h1>
      </div>

      {/* ── Create section ── */}
      <section className="space-y-6">
        <SectionHeader icon={Plus} label="Nouveau lien de session" />

        <Card className="border-border/60 bg-surface/30 overflow-hidden backdrop-blur-sm">
          <CardContent className="p-0">
            <form onSubmit={handleCreate} className="p-8 flex flex-col gap-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <Label>Thème du parcours</Label>
                  <select
                    value={themeId}
                    onChange={e => setThemeId(e.target.value)}
                    required
                    className="flex h-9 w-full border border-input bg-surface/40 px-3 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary transition-colors appearance-none"
                  >
                    {themes.map(t => <option key={t.id} value={t.id} className="bg-background">{t.name}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <Label>Nom du bénéficiaire (optionnel)</Label>
                  <div className="relative group">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                    <Input
                      value={recipientName}
                      onChange={e => setRecipientName(e.target.value)}
                      placeholder="Marie Dupont"
                      className="pl-10 h-9 bg-surface/40"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Email pour la livraison</Label>
                  <div className="relative group">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                    <Input
                      type="email"
                      value={recipientEmail}
                      onChange={e => setRecipientEmail(e.target.value)}
                      placeholder="marie@example.com"
                      required
                      className="pl-10 h-9 bg-surface/40"
                    />
                  </div>
                </div>
              </div>

              {createError && (
                <p className="text-[11px] font-mono text-destructive bg-destructive/5 px-3 py-2 border border-destructive/20">{createError}</p>
              )}

              <div className="flex items-center gap-4">
                <Button
                  type="submit"
                  disabled={creating || themes.length === 0}
                  className="h-10 px-8 rounded-none font-mono text-[10px] uppercase tracking-[0.2em] group shadow-lg"
                >
                  {creating ? <Loader2 size={14} className="animate-spin mr-2" /> : <LinkIcon size={14} className="mr-2 group-hover:rotate-45 transition-transform" />}
                  {creating ? 'Création...' : 'Générer le lien'}
                </Button>
                {themes.length === 0 && (
                  <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest italic leading-none">
                    Créez d'abord un thème dans la bibliothèque
                  </p>
                )}
              </div>
            </form>

            {/* Share URL */}
            {shareUrl && (
              <div className="border-t border-border/40 p-6 bg-primary/[0.03] animate-in slide-in-from-top-4 duration-500 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary font-bold">
                    Lien prêt — à envoyer au destinataire
                  </p>
                  {inviteSuccess && (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                      <Check size={11} /> Email envoyé
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-background/60 border border-primary/20 p-3 rounded-none overflow-hidden flex items-center gap-3 min-w-0">
                    <LinkIcon size={12} className="text-primary/40 shrink-0" />
                    <code className="text-xs font-mono text-foreground truncate select-all">{shareUrl}</code>
                  </div>
                  <Button
                    variant={copied ? 'default' : 'outline'}
                    onClick={handleCopy}
                    className="h-11 px-5 rounded-none font-mono text-[10px] uppercase tracking-widest border border-primary/20 shrink-0"
                  >
                    {copied ? <Check size={14} className="mr-2" /> : <Copy size={14} className="mr-2" />}
                    {copied ? 'Copié' : 'Copier'}
                  </Button>
                  <Button
                    onClick={handleInvite}
                    disabled={inviting || inviteSuccess}
                    className="h-11 px-5 rounded-none font-mono text-[10px] uppercase tracking-widest shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                  >
                    {inviting
                      ? <Loader2 size={14} className="animate-spin mr-2" />
                      : inviteSuccess
                        ? <Check size={14} className="mr-2" />
                        : <Send size={14} className="mr-2" />
                    }
                    {inviting ? 'Envoi...' : inviteSuccess ? 'Envoyé' : 'Envoyer par email'}
                  </Button>
                </div>

                {inviteError && (
                  <p className="text-[11px] font-mono text-destructive bg-destructive/5 px-3 py-2 border border-destructive/20">
                    {inviteError}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Pending sessions ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <SectionHeader icon={Clock} label="En attente de montage" />
          {pendingGroups.length > 0 && (
            <Badge variant="secondary" className="font-mono text-[10px] bg-primary/5 text-primary border-primary/20">
              {sessions.filter(s => s.status !== 'DONE').length} à traiter
            </Badge>
          )}
        </div>

        {pendingGroups.length === 0 ? (
          <EmptyState icon={Check} label="Toutes les sessions ont été traitées." />
        ) : (
          <div className="space-y-6">
            {pendingGroups.map(group => (
              <SessionGroupBlock
                key={group.key}
                group={group}
                delivering={delivering}
                deliverSuccess={deliverSuccess}
                expandedRaws={expandedRaws}
                rawsCache={rawsCache}
                loadingRaws={loadingRaws}
                onDeliver={handleDeliver}
                onDelete={handleDelete}
                onToggleRaws={handleToggleRaws}
                onDownload={handleDownload}
              />
            ))}
          </div>
        )}

        {deliverError && (
          <p className="text-[11px] font-mono text-destructive px-3 py-2 border border-destructive/20 bg-destructive/5 mt-4">{deliverError}</p>
        )}
      </section>

      {/* ── History ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <SectionHeader icon={History} label="Historique des livraisons" />
          {history.length > 0 && (
            <Badge variant="outline" className="font-mono text-[10px] opacity-40">
              {history.length} livrées
            </Badge>
          )}
        </div>

        {historyGroups.length === 0 ? (
          <EmptyState icon={Video} label="Aucune vidéo livrée pour l'instant." />
        ) : (
          <div className="border border-border/60 bg-surface/30 rounded-sm overflow-hidden backdrop-blur-sm shadow-sm">
            {/* Table header */}
            <div className="grid grid-cols-[1.5fr_1fr_80px_1fr_100px_100px] border-b border-border/40 bg-surface/50 px-6 py-4">
              {['Destinataire', 'Thème', 'Version', 'Date de livraison', 'Rushs', 'Montage'].map(h => (
                <div key={h} className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">{h}</div>
              ))}
            </div>

            <div className="divide-y divide-border/40">
              {historyGroups.map(group =>
                group.sessions.map(session => (
                  <HistoryRow
                    key={session.id}
                    session={session}
                    showGroupHeader={group.sessions.length > 1 && session.version === group.sessions[0].version}
                    expandedRaws={expandedRaws}
                    rawsCache={rawsCache}
                    loadingRaws={loadingRaws}
                    onToggleRaws={handleToggleRaws}
                    onDownload={handleDownload}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

// ── Components ─────────────────────────────────────────────────────────────

function VersionBadge({ version, total }: { version: number; total: number }) {
  if (total <= 1) return null
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-widest border rounded-none bg-primary/10 border-primary/30 text-primary leading-none">
      v{version}
    </span>
  )
}

function SessionGroupBlock({
  group,
  delivering,
  deliverSuccess,
  expandedRaws,
  rawsCache,
  loadingRaws,
  onDeliver,
  onToggleRaws,
  onDownload,
  onDelete,
}: {
  group: SessionGroup
  delivering: string | null
  deliverSuccess: string | null
  expandedRaws: string | null
  rawsCache: Record<string, RawRecording[]>
  loadingRaws: string | null
  onDeliver: (id: string) => void
  onToggleRaws: (id: string) => void
  onDownload: (url: string, filename: string) => void
  onDelete: (id: string) => void
}) {
  const isMulti = group.sessions.length > 1
  return (
    <div className="space-y-3">
      {isMulti && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex items-center gap-2">
            <span className="font-inter font-bold text-sm text-foreground">
              {group.recipientName ?? group.recipientEmail}
            </span>
            {group.recipientName && (
              <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-tighter">{group.recipientEmail}</span>
            )}
          </div>
          <div className="flex-1 h-[1px] bg-border/40" />
          <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">{group.sessions.length} versions</span>
        </div>
      )}
      <div className={cn("space-y-3", isMulti && "pl-4 border-l border-primary/20")}>
        {group.sessions.map(session => (
          <SessionCard
            key={session.id}
            session={session}
            totalVersions={group.sessions.length}
            delivering={delivering}
            deliverSuccess={deliverSuccess}
            expandedRaws={expandedRaws}
            rawsCache={rawsCache}
            loadingRaws={loadingRaws}
            onDeliver={onDeliver}
            onToggleRaws={onToggleRaws}
            onDownload={onDownload}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-sm bg-primary/5 border border-primary/10 flex items-center justify-center">
        <Icon size={14} className="text-primary" />
      </div>
      <h2 className="font-inter font-bold text-xl text-foreground tracking-tight">{label}</h2>
    </div>
  )
}

function SessionCard({
  session,
  totalVersions,
  delivering,
  deliverSuccess,
  expandedRaws,
  rawsCache,
  loadingRaws,
  onDeliver,
  onToggleRaws,
  onDownload,
  onDelete,
}: {
  session: SubmittedSession
  totalVersions: number
  delivering: string | null
  deliverSuccess: string | null
  expandedRaws: string | null
  rawsCache: Record<string, RawRecording[]>
  loadingRaws: string | null
  onDeliver: (id: string) => void
  onToggleRaws: (id: string) => void
  onDownload: (url: string, filename: string) => void
  onDelete: (id: string) => void
}) {
  const statusInfo = STATUS[session.status] ?? { label: session.status, variant: 'default' }
  const canDeliver = session.finalVideoKey != null && session.status !== 'DONE'
  const isExpanded = expandedRaws === session.id
  const recordings = rawsCache[session.id] ?? []

  return (
    <Card className={cn(
      "border-border/60 bg-surface/30 overflow-hidden transition-all duration-300",
      isExpanded ? "ring-1 ring-primary/20 scale-[1.01] shadow-xl" : "hover:border-primary/30"
    )}>
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-6">
          {/* Left: recipient + meta */}
          <div className="flex items-center gap-6 min-w-0 flex-1">
            <div className="relative flex h-3 w-3 shrink-0">
               <span className={cn(
                 "animate-ping absolute inline-flex h-full w-full rounded-full opacity-20",
                 session.status === 'PROCESSING' ? 'bg-blue-400' : 'bg-orange-400'
               )} />
               <span className={cn(
                 "relative inline-flex rounded-full h-3 w-3",
                 session.status === 'PROCESSING' ? 'bg-blue-500' : 'bg-orange-500'
               )} />
            </div>

            <div className="min-w-0 flex-1 lg:flex lg:items-center lg:gap-8">
              <div className="min-w-0">
                <p className="font-inter font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
                  {session.recipientName || session.recipientEmail}
                </p>
                {session.recipientName && (
                  <p className="text-[10px] font-mono text-muted-foreground/60 truncate mt-0.5 uppercase tracking-tighter">
                    {session.recipientEmail}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-2 lg:mt-0 lg:ml-auto">
                <Badge variant="outline" className="font-mono text-[9px] bg-surface/50 truncate max-w-[150px]">
                  <Layers className="w-3 h-3 mr-1.5 opacity-40 text-primary" />
                  {session.theme?.name}
                </Badge>
                <VersionBadge version={session.version} total={totalVersions} />
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/40 leading-none">
                  <Clock size={11} className="opacity-40" />
                  {formatDate(session.submittedAt)}
                </div>
                <Badge variant={statusInfo.variant} className="text-[9px] px-2 py-0.5">
                  {statusInfo.label}
                </Badge>
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleRaws(session.id)}
              className={cn(
                "h-9 px-4 rounded-none font-mono text-[9px] uppercase tracking-widest transition-all",
                isExpanded && "bg-primary/10 border-primary/40 text-primary"
              )}
            >
              {loadingRaws === session.id ? <Loader2 size={12} className="animate-spin" /> : (
                <>
                  <Video size={12} className={cn("mr-2", isExpanded && "text-primary")} />
                  Rushs {isExpanded ? <ChevronUp size={12} className="ml-1" /> : <ChevronDown size={12} className="ml-1" />}
                </>
              )}
            </Button>

            {canDeliver && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDeliver(session.id)}
                disabled={delivering === session.id}
                className="h-9 px-4 rounded-none border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400 font-mono text-[9px] uppercase tracking-widest"
              >
                {delivering === session.id ? <Loader2 size={12} className="animate-spin" /> : (deliverSuccess === session.id ? <Check size={12} className="mr-2" /> : <Send size={12} className="mr-2" />)}
                {delivering === session.id ? 'Livraison' : deliverSuccess === session.id ? 'Envoyé' : 'Livrer'}
              </Button>
            )}

            <Button asChild size="sm" className="h-9 px-5 rounded-none font-mono text-[9px] uppercase tracking-widest shadow-lg">
              <Link href={`/process/${session.id}`}>
                <Scissors size={12} className="mr-2" />
                Démarrer
              </Link>
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 rounded-none border-destructive/20 hover:border-destructive/40 hover:bg-destructive/10 text-destructive/60 hover:text-destructive font-mono text-[9px] uppercase tracking-widest"
                >
                  <Trash2 size={12} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette session ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tous les rushs, fichiers audio, vidéos traitées et données associées à{' '}
                    <strong>{session.recipientName ?? session.recipientEmail}</strong> seront définitivement supprimés.
                    Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(session.id)}>
                    Supprimer définitivement
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Raws panel */}
        {isExpanded && (
          <RawsPanel session={session} recordings={recordings} loadingRaws={loadingRaws} onDownload={onDownload} />
        )}
      </CardContent>
    </Card>
  )
}

function HistoryRow({
  session,
  showGroupHeader,
  expandedRaws,
  rawsCache,
  loadingRaws,
  onToggleRaws,
  onDownload
}: {
  session: SubmittedSession,
  showGroupHeader?: boolean,
  expandedRaws: string | null,
  rawsCache: Record<string, RawRecording[]>,
  loadingRaws: string | null,
  onToggleRaws: (id: string) => void,
  onDownload: (url: string, filename: string) => void
}) {
  const isExpanded = expandedRaws === session.id
  const recordings = rawsCache[session.id] ?? []

  return (
    <>
      <div className="grid grid-cols-[1.5fr_1fr_80px_1fr_100px_100px] items-center px-6 py-5 hover:bg-primary/[0.02] transition-colors group">
        <div className="min-w-0 pr-4">
          <p className="font-inter font-bold text-[13px] text-foreground group-hover:text-primary transition-colors truncate">{session.recipientName ?? '—'}</p>
          <p className="text-[10px] font-mono text-muted-foreground/60 truncate uppercase tracking-tighter">{session.recipientEmail}</p>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground/70 uppercase">
          {session.theme?.name}
        </div>
        <div>
          <span className="inline-flex items-center px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-widest border rounded-none bg-primary/10 border-primary/20 text-primary leading-none">
            v{session.version}
          </span>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/40 flex items-center gap-2">
          <Clock size={11} className="text-primary/40" />
          {formatDate(session.deliveredAt ?? session.submittedAt)}
        </div>
        <div>
          <button
            onClick={() => onToggleRaws(session.id)}
            className={cn(
              "text-[9px] font-mono uppercase tracking-widest transition-all px-2 py-1 border rounded-none flex items-center gap-2",
              isExpanded ? "text-primary border-primary/30 bg-primary/5" : "text-muted-foreground/40 border-border/40 hover:border-primary/20 hover:text-primary"
            )}
          >
            {loadingRaws === session.id ? <Loader2 size={10} className="animate-spin" /> : (
              <>
                <Video size={10} />
                {isExpanded ? 'Fermer' : 'Voir'}
              </>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/process/${session.id}`}
            className="text-[9px] font-mono uppercase tracking-widest transition-all px-2 py-1 border rounded-none flex items-center gap-2 text-muted-foreground/40 border-border/40 hover:border-primary/20 hover:text-primary"
          >
            <Scissors size={10} />
            Rush
          </Link>
          {session.finalVideoKey && (
            <Link
              href={`/video/${session.id}`}
              target="_blank"
              className="text-[9px] font-mono uppercase tracking-widest transition-all px-2 py-1 border rounded-none flex items-center gap-2 text-muted-foreground/40 border-border/40 hover:border-primary/20 hover:text-primary"
            >
              <Play size={10} />
              Vidéo
            </Link>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="bg-primary/[0.01] border-b border-border/40">
           <RawsPanel session={session} recordings={recordings} loadingRaws={loadingRaws} border={false} onDownload={onDownload} />
        </div>
      )}
    </>
  )
}

function RawsPanel({
  session,
  recordings,
  loadingRaws,
  onDownload,
  border = true
}: {
  session: SubmittedSession
  recordings: RawRecording[]
  loadingRaws: string | null
  onDownload: (url: string, filename: string) => void
  border?: boolean
}) {
  return (
    <div className={cn(
      "bg-primary/[0.02] p-8 space-y-6 animate-in slide-in-from-top-4 duration-300 shadow-inner",
      border && "border-t border-border/40"
    )}>
      <div className="flex items-center gap-3">
        <div className="w-6 h-[1px] bg-primary/20" />
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary/40 leading-none">
          Séquences capturées — {session.recipientName || session.recipientEmail}
        </p>
      </div>

      {loadingRaws === session.id ? (
        <div className="flex items-center gap-3 py-8">
           <Loader2 size={14} className="animate-spin text-primary/40" />
           <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/40">Synchronisation des vidéos...</span>
        </div>
      ) : recordings.length === 0 ? (
        <p className="text-xs font-mono text-muted-foreground/40 p-8 text-center border border-dashed border-border/40 rounded-sm">Aucune vidéo brute disponible.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {recordings.map((rec, idx) => (
            <Card key={rec.id} className="border-border/60 bg-background/50 overflow-hidden group/video hover:border-primary/40 transition-all rounded-none">
              <div className="relative bg-black aspect-[9/16] overflow-hidden">
                <video
                  src={rec.signedUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover/video:scale-105"
                />
                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-mono text-white/50 uppercase">
                  #{idx + 1}
                </div>
              </div>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-foreground line-clamp-2 leading-relaxed h-[34px]">
                    {rec.questionText}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-8 rounded-none border-border/40 hover:border-primary/40 group/btn transition-all font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:text-primary"
                  onClick={() => onDownload(rec.signedUrl, `raw-${session.id}-q${idx + 1}.webm`)}
                >
                  <Download size={12} className="mr-2 text-muted-foreground group-hover/btn:text-primary transition-colors" />
                  Télécharger
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Icons for small usages ───────────────────────────────────────────────────

function Layers(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m2.6 11.2 8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9" />
      <path d="m2.6 15.3 8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9" />
    </svg>
  )
}

// ── Shared UI Elements ────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="border border-border/40 border-dashed p-16 text-center rounded-sm bg-surface/10">
      {Icon && <Icon size={32} className="mx-auto text-muted-foreground/20 mb-4" />}
      <p className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-widest">
        {label}
      </p>
    </div>
  )
}
