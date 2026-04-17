'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Brain,
  Sparkles,
  Tag,
  Loader2,
  AlertCircle,
  Clock,
  Database,
  LayoutGrid,
  Target,
  Users,
  Video,
  MessageCircle,
  Zap,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Upload,
  FileText,
  CheckCircle2,
  X,
  Trash2,
  Linkedin,
  Globe,
  ExternalLink,
  Building2,
  Mic2,
  CalendarClock,
  MonitorSmartphone,
  ArrowRight,
  MessageSquare,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type AiSummary = {
  activite: string
  stade: 'démarrage' | 'croissance' | 'établi'
  clientsCibles: string
  problemeResolu: string
  objectifsContenu: string
  styleComm: string
  pointsForts: string[]
  lacunes: string[]
}

type EntrepreneurProfile = {
  id: string
  businessContext: {
    conversationSummary?: string
    answers?: string[]
    summary?: AiSummary
  }
  topicsExplored: string[]
  communicationStyle: string | null
  editorialPillars: string[]
  editorialTone: string | null
  targetFrequency: number | null
  targetPlatforms: string[]
  editorialValidated: boolean
  linkedinUrl: string | null
  linkedinIngestedAt: string | null
  websiteUrl: string | null
  websiteIngestedAt: string | null
  createdAt: string
  updatedAt: string
}

type LinkedinPreview = {
  name: string
  headline: string
  photoUrl: string | null
  company: string | null
  username: string | null
}

type Memory = {
  id: string
  content: string
  tags: string[]
  sessionId: string | null
  createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "a l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function stadeColor(stade: string) {
  if (stade === 'démarrage') return 'bg-amber-500/10 text-amber-500'
  if (stade === 'croissance') return 'bg-blue-500/10 text-blue-500'
  return 'bg-emerald-500/10 text-emerald-500'
}

function tagColor(tag: string) {
  if (tag === 'fact') return 'bg-blue-500/10 text-blue-500'
  if (tag === 'quote') return 'bg-purple-500/10 text-purple-500'
  if (tag === 'theme') return 'bg-emerald-500/10 text-emerald-500'
  return 'bg-primary/10 text-primary'
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KnowledgeCard({ icon: Icon, label, value, accent = false }: {
  icon: React.ElementType; label: string; value: string; accent?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 space-y-2 ${accent ? 'bg-primary/5' : 'bg-muted/30'}`}>
      <div className="flex items-center gap-2">
        <Icon size={12} className={accent ? 'text-primary/70' : 'text-muted-foreground/60'} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{value}</p>
    </div>
  )
}

function ConversationCollapsible({ summary }: { summary: string }) {
  const [open, setOpen] = useState(false)
  const lines = summary.split('\n\n').filter(Boolean)

  return (
    <div className="rounded-xl bg-muted/20 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-xs text-muted-foreground">Voir la conversation complete ({lines.length} echanges)</span>
        {open ? <ChevronUp size={13} className="text-muted-foreground/40" /> : <ChevronDown size={13} className="text-muted-foreground/40" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 max-h-80 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {lines.map((line, i) => {
            const isE = line.startsWith('Entrepreneur:')
            const isA = line.startsWith('Assistant:')
            if (!isE && !isA) return <p key={i} className="text-xs text-muted-foreground italic">{line}</p>
            const [prefix, ...rest] = line.split(': ')
            return (
              <div key={i} className={`flex gap-2 ${isE ? 'flex-row-reverse' : ''}`}>
                <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${isE ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {isE ? 'E' : 'IA'}
                </div>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${isE ? 'bg-primary/5' : 'bg-muted/40 text-muted-foreground'}`}>
                  {rest.join(': ')}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmptyProfile({ hasConversation }: { hasConversation: boolean }) {
  return (
    <div className="rounded-xl bg-muted/20 p-16 text-center space-y-4">
      <div className="w-14 h-14 mx-auto rounded-xl bg-muted/40 flex items-center justify-center">
        <Brain size={24} className="text-muted-foreground/30" />
      </div>
      {hasConversation ? (
        <>
          <p className="font-semibold text-foreground">Resume en cours de generation</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Le resume IA est genere apres chaque echange. Rechargez la page dans quelques secondes.
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold text-foreground">Profil non configure</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Discutez avec l&apos;assistant IA pour demarrer votre profil.
          </p>
        </>
      )}
    </div>
  )
}

// ─── Document upload ─────────────────────────────────────────────────────────

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; filename: string }
  | { status: 'done'; filename: string; saved: number }
  | { status: 'error'; message: string }

function DocumentUpload({ onSuccess }: { onSuccess: () => void }) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [dragOver, setDragOver] = useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['txt', 'md', 'pdf'].includes(ext ?? '')) {
      setState({ status: 'error', message: 'Format non supporte. Utilisez .txt, .md ou .pdf' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setState({ status: 'error', message: 'Fichier trop volumineux (max 10 Mo)' })
      return
    }
    setState({ status: 'uploading', filename: file.name })
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/admin/ai/documents', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      const { saved } = await res.json()
      setState({ status: 'done', filename: file.name, saved })
      onSuccess()
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Erreur' })
    }
  }

  return (
    <div
      onClick={() => (state.status === 'idle' || state.status === 'error') ? inputRef.current?.click() : undefined}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.[0]) upload(e.dataTransfer.files[0]) }}
      className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-4 transition-all cursor-pointer ${
        dragOver ? 'border-primary/60 bg-primary/5'
        : state.status === 'done' ? 'border-emerald-500/40 bg-emerald-500/5 cursor-default'
        : state.status === 'error' ? 'border-red-500/40 bg-red-500/5'
        : 'border-border/50 hover:border-primary/40 hover:bg-muted/30'
      }`}
    >
      <input ref={inputRef} type="file" accept=".txt,.md,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {state.status === 'idle' && (
        <>
          <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center">
            <FileText size={20} className="text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Deposez un fichier ou cliquez</p>
            <p className="text-xs text-muted-foreground mt-1">.txt · .md · .pdf — max 10 Mo</p>
          </div>
        </>
      )}
      {state.status === 'uploading' && (
        <>
          <Loader2 size={24} className="animate-spin text-primary/60" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{state.filename}</p>
            <p className="text-xs text-muted-foreground mt-1">Analyse et indexation en cours...</p>
          </div>
        </>
      )}
      {state.status === 'done' && (
        <>
          <CheckCircle2 size={24} className="text-emerald-500" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{state.filename}</p>
            <p className="text-xs text-emerald-500/80 mt-1">{state.saved} fragment{state.saved > 1 ? 's' : ''} indexe{state.saved > 1 ? 's' : ''}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setState({ status: 'idle' }) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Upload size={10} /> Ajouter un autre
          </button>
        </>
      )}
      {state.status === 'error' && (
        <>
          <X size={24} className="text-red-400" />
          <p className="text-sm font-medium text-red-400">{state.message}</p>
        </>
      )}
    </div>
  )
}

// ─── Memory helpers ──────────────────────────────────────────────────────────

type DocumentGroup = { name: string; chunks: Memory[] }
type SessionGroup = { sessionId: string; chunks: Memory[] }

function groupByDocument(mems: Memory[]): DocumentGroup[] {
  const map = new Map<string, Memory[]>()
  for (const m of mems) {
    const name = m.tags.filter((t) => t !== 'document').at(-1) ?? 'Sans nom'
    const existing = map.get(name)
    if (existing) existing.push(m)
    else map.set(name, [m])
  }
  return Array.from(map.entries()).map(([name, chunks]) => ({ name, chunks }))
}

function groupBySession(mems: Memory[]): SessionGroup[] {
  const map = new Map<string, Memory[]>()
  for (const m of mems) {
    if (!m.sessionId) continue
    const existing = map.get(m.sessionId)
    if (existing) existing.push(m)
    else map.set(m.sessionId, [m])
  }
  return Array.from(map.entries()).map(([sessionId, chunks]) => ({ sessionId, chunks }))
}

function CollapsibleGroup({ label, icon: Icon, count, children }: { label: string; icon: React.ElementType; count: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl bg-muted/20 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
        <Icon size={14} className="text-primary/50 shrink-0" />
        <span className="flex-1 text-sm text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
        {open ? <ChevronUp size={12} className="text-muted-foreground/40" /> : <ChevronDown size={12} className="text-muted-foreground/40" />}
      </button>
      {open && <div className="px-4 pb-3 space-y-2">{children}</div>}
    </div>
  )
}

function MemoryChip({ mem }: { mem: Memory }) {
  return (
    <div className="rounded-lg bg-background p-3 space-y-2">
      <p className="text-xs text-foreground leading-relaxed">{mem.content}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {mem.tags.map((tag) => (
            <span key={tag} className={`text-xs font-medium px-2 py-0.5 rounded-full ${tagColor(tag)}`}>{tag}</span>
          ))}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground/40">{formatRelative(mem.createdAt)}</span>
      </div>
    </div>
  )
}

// ─── LinkedIn Section ────────────────────────────────────────────────────────

function LinkedinSection({ profile, onUpdated }: { profile: EntrepreneurProfile; onUpdated: () => void }) {
  const [url, setUrl] = useState(profile.linkedinUrl ?? '')
  const [preview, setPreview] = useState<LinkedinPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile.linkedinUrl) loadPreview(profile.linkedinUrl)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPreview(linkedinUrl: string) {
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/admin/ai/linkedin?url=${encodeURIComponent(linkedinUrl)}`)
      if (res.ok) setPreview(await res.json())
    } catch { /* */ } finally { setPreviewLoading(false) }
  }

  async function saveUrl() {
    const trimmed = url.trim()
    if (!trimmed || !trimmed.includes('linkedin.com/in/')) { setError("Format attendu : https://www.linkedin.com/in/votre-profil"); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/admin/ai/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linkedinUrl: trimmed }) })
      if (!res.ok) throw new Error(await res.text())
      loadPreview(trimmed); onUpdated()
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur') } finally { setSaving(false) }
  }

  async function ingest() {
    if (!url.trim()) return
    setIngesting(true); setError(null)
    try {
      const res = await fetch('/api/admin/ai/linkedin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linkedinUrl: url.trim() }) })
      if (!res.ok) throw new Error(await res.text())
      onUpdated()
    } catch (err) { setError(err instanceof Error ? err.message : "Erreur lors de l'import") } finally { setIngesting(false) }
  }

  return (
    <div className="rounded-xl bg-[#0A66C2]/5 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Linkedin size={16} className="text-[#0A66C2]/70" />
        <h3 className="text-sm font-semibold">LinkedIn</h3>
        {profile.linkedinIngestedAt && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#0A66C2]/10 text-[#0A66C2]/70">Synchronise</span>}
      </div>
      <div className="flex items-start gap-4">
        {previewLoading ? (
          <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center shrink-0"><Loader2 size={14} className="animate-spin text-muted-foreground/40" /></div>
        ) : preview?.photoUrl ? (
          <img src={preview.photoUrl} alt={preview.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#0A66C2]/10 flex items-center justify-center shrink-0"><Linkedin size={18} className="text-[#0A66C2]/40" /></div>
        )}
        <div className="flex-1 min-w-0 space-y-2">
          {preview && (
            <div>
              <p className="text-sm font-medium text-foreground">{preview.name}</p>
              {preview.headline && <p className="text-xs text-muted-foreground">{preview.headline}</p>}
              {preview.company && <p className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-0.5"><Building2 size={9} />{preview.company}</p>}
            </div>
          )}
          <div className="flex gap-2">
            <input type="url" value={url} onChange={(e) => { setUrl(e.target.value); setError(null) }} placeholder="https://www.linkedin.com/in/votre-profil" className="flex-1 bg-background/60 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 transition-colors" />
            <button onClick={saveUrl} disabled={saving || !url.trim() || url === profile.linkedinUrl} className="px-3 py-1.5 rounded-lg bg-background/60 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 shrink-0">
              {saving ? <Loader2 size={11} className="animate-spin" /> : 'Enregistrer'}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-3">
            {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#0A66C2]/60 hover:text-[#0A66C2] transition-colors flex items-center gap-1">Voir le profil <ExternalLink size={8} /></a>}
            {!profile.linkedinIngestedAt && url.trim() && (
              <button onClick={ingest} disabled={ingesting} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A66C2] text-white rounded-lg text-xs hover:bg-[#0A66C2]/90 disabled:opacity-40 transition-colors">
                {ingesting ? <Loader2 size={10} className="animate-spin" /> : <Linkedin size={10} />}
                {ingesting ? 'Import...' : "Importer dans l'IA"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Website Section ────────────────────────────────────────────────────────

function WebsiteSection({ profile, onUpdated }: { profile: EntrepreneurProfile; onUpdated: () => void }) {
  const [url, setUrl] = useState(profile.websiteUrl ?? '')
  const [ingesting, setIngesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ saved: number } | null>(null)

  async function saveUrl() {
    const trimmed = url.trim()
    if (!trimmed) { setError("Entrez l'URL de votre site web"); return }
    try { new URL(trimmed) } catch { setError('URL invalide (ex: https://mon-site.com)'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/admin/ai/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ websiteUrl: trimmed }) })
      if (!res.ok) throw new Error(await res.text())
      onUpdated()
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur') } finally { setSaving(false) }
  }

  async function ingest() {
    const trimmed = url.trim()
    if (!trimmed) return
    setIngesting(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/admin/ai/website', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ websiteUrl: trimmed }) })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResult(data)
      onUpdated()
    } catch (err) { setError(err instanceof Error ? err.message : "Erreur lors de l'analyse") } finally { setIngesting(false) }
  }

  return (
    <div className="rounded-xl bg-emerald-500/5 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Globe size={16} className="text-emerald-600/70" />
        <h3 className="text-sm font-semibold">Site web</h3>
        {profile.websiteIngestedAt && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600/70">Analyse</span>}
      </div>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Ajoutez votre site web pour que l&apos;IA analyse son contenu et enrichisse votre profil.
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); setResult(null) }}
            placeholder="https://mon-site.com"
            className="flex-1 bg-background/60 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
          />
          <button onClick={saveUrl} disabled={saving || !url.trim() || url === profile.websiteUrl} className="px-3 py-1.5 rounded-lg bg-background/60 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 shrink-0">
            {saving ? <Loader2 size={11} className="animate-spin" /> : 'Enregistrer'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {result && (
          <p className="text-xs text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 size={11} /> {result.saved} fragment{result.saved > 1 ? 's' : ''} indexe{result.saved > 1 ? 's' : ''} dans la memoire IA
          </p>
        )}
        <div className="flex items-center gap-3">
          {url.trim() && <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600/60 hover:text-emerald-600 transition-colors flex items-center gap-1">Voir le site <ExternalLink size={8} /></a>}
          {url.trim() && (
            <button onClick={ingest} disabled={ingesting} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-600/90 disabled:opacity-40 transition-colors">
              {ingesting ? <Loader2 size={10} className="animate-spin" /> : <Globe size={10} />}
              {ingesting ? 'Analyse...' : profile.websiteIngestedAt ? 'Re-analyser le site' : 'Analyser le site'}
            </button>
          )}
        </div>
        {profile.websiteIngestedAt && (
          <p className="text-xs text-muted-foreground/50">Derniere analyse : {formatDate(profile.websiteIngestedAt)}</p>
        )}
      </div>
    </div>
  )
}

// ─── Main ActivityTab ────────────────────────────────────────────────────────

export function ActivityTab() {
  const [profile, setProfile] = useState<EntrepreneurProfile | null>(null)
  const [memories, setMemories] = useState<{ memories: Memory[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [pRes, mRes] = await Promise.all([
        fetch('/api/admin/ai/profile'),
        fetch('/api/admin/ai/memories?limit=30'),
      ])
      if (!pRes.ok) throw new Error(await pRes.text())
      const [p, m] = await Promise.all([pRes.json(), mRes.ok ? mRes.json() : { memories: [], total: 0 }])
      setProfile(p)
      setMemories(m)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally { setLoading(false); setRefreshing(false) }
  }

  async function resetProfile() {
    setResetting(true)
    try {
      const res = await fetch('/api/admin/ai/profile', { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setShowResetConfirm(false)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur') } finally { setResetting(false) }
  }

  useEffect(() => { load() }, [])

  const summary = profile?.businessContext?.summary as AiSummary | undefined
  const conversationSummary = profile?.businessContext?.conversationSummary
  const hasConversation = !!conversationSummary

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={22} className="animate-spin text-primary/40" />
          <span className="text-sm text-muted-foreground">Chargement...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/5 p-6 flex items-center gap-3">
        <AlertCircle size={16} className="text-red-400 shrink-0" />
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  const allMems = memories?.memories ?? []
  const docMems = allMems.filter((m) => m.tags.includes('document'))
  const sessionMems = allMems.filter((m) => m.sessionId !== null && !m.tags.includes('document'))
  const chatMems = allMems.filter((m) => m.sessionId === null && !m.tags.includes('document'))
  const docGroups = groupByDocument(docMems)
  const sessionGroups = groupBySession(sessionMems)

  return (
    <div className="space-y-8">
      {/* Reset modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background rounded-2xl p-8 max-w-sm w-full mx-4 space-y-6 shadow-2xl">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Trash2 size={16} className="text-red-400" />
                <h2 className="font-semibold text-lg text-foreground">Reinitialiser le profil</h2>
              </div>
              <p className="text-sm text-muted-foreground">Toutes les memoires seront supprimees. L&apos;IA repartira de zero.</p>
              <p className="text-xs text-red-400/80">Action irreversible</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowResetConfirm(false)} disabled={resetting} className="flex-1 px-4 py-2.5 rounded-lg bg-muted/40 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">Annuler</button>
              <button onClick={resetProfile} disabled={resetting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 text-sm text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40">
                {resetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {resetting ? 'Reset...' : 'Reinitialiser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={() => load(true)} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Actualiser
        </button>
        <button onClick={() => setShowResetConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/5 transition-colors">
          <Trash2 size={12} /> Reset
        </button>
      </div>

      {/* Stats */}
      {profile && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Database, label: 'Memoires', value: memories?.total ?? 0 },
            { icon: LayoutGrid, label: 'Themes', value: profile.topicsExplored.length },
            { icon: Clock, label: 'Cree', value: formatRelative(profile.createdAt) },
            { icon: Clock, label: 'Mis a jour', value: formatRelative(profile.updatedAt) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <s.icon size={13} />
                <span className="text-xs">{s.label}</span>
              </div>
              <p className="text-xl font-semibold tracking-tight text-foreground">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* LinkedIn */}
      {profile && <LinkedinSection profile={profile} onUpdated={() => load(true)} />}

      {/* Website */}
      {profile && <WebsiteSection profile={profile} onUpdated={() => load(true)} />}

      {/* Editorial line / Ma strategie */}
      {profile && (profile.editorialValidated || (profile.editorialPillars?.length ?? 0) > 0) ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Target size={16} className="text-primary/60" />
            <h3 className="font-semibold text-lg tracking-tight">Ma strategie</h3>
          </div>

          {profile.editorialPillars.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Piliers de contenu</p>
              <div className="flex flex-wrap gap-2">
                {profile.editorialPillars.map((pillar) => (
                  <span key={pillar} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/5 text-primary">{pillar}</span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {profile.editorialTone && (
              <div className="p-3 rounded-xl bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Mic2 size={10} /> Ton</p>
                <p className="text-sm text-foreground">{profile.editorialTone}</p>
              </div>
            )}
            {profile.targetFrequency != null && (
              <div className="p-3 rounded-xl bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><CalendarClock size={10} /> Frequence</p>
                <p className="text-sm text-foreground">{profile.targetFrequency}x / semaine</p>
              </div>
            )}
            {profile.targetPlatforms.length > 0 && (
              <div className="p-3 rounded-xl bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><MonitorSmartphone size={10} /> Plateformes</p>
                <div className="flex flex-wrap gap-1">
                  {profile.targetPlatforms.map((p) => (
                    <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-muted/40 text-foreground">{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link href="/chat" className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium">
            Modifier via l&apos;IA <ArrowRight size={12} />
          </Link>
        </div>
      ) : profile && (
        <div className="rounded-xl bg-muted/20 p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">
            <MessageSquare size={20} className="text-primary/60" />
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Discute avec l&apos;IA pour definir tes piliers de contenu, ton style et ton rythme de publication.
          </p>
          <Link href="/chat" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <MessageSquare size={14} /> Creer ma strategie
          </Link>
        </div>
      )}

      {/* No profile */}
      {!summary && <EmptyProfile hasConversation={hasConversation} />}

      {/* AI Summary */}
      {summary && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Brain size={16} className="text-primary/60" />
            <h3 className="font-semibold text-lg tracking-tight">Ce que l&apos;IA sait</h3>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stadeColor(summary.stade)}`}>{summary.stade}</span>
          </div>
          <KnowledgeCard icon={Zap} label="Activite" value={summary.activite} accent />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <KnowledgeCard icon={Users} label="Clients cibles" value={summary.clientsCibles} />
            <KnowledgeCard icon={Target} label="Probleme resolu" value={summary.problemeResolu} />
            <KnowledgeCard icon={Video} label="Objectifs contenu" value={summary.objectifsContenu} />
            <KnowledgeCard icon={MessageCircle} label="Style de communication" value={summary.styleComm} />
          </div>
          {summary.pointsForts.length > 0 && (
            <div className="rounded-xl bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2"><Tag size={12} className="text-muted-foreground/60" /><span className="text-xs text-muted-foreground">Points forts</span></div>
              <div className="flex flex-wrap gap-2">
                {summary.pointsForts.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/5 text-xs text-primary">
                    <span className="w-1 h-1 rounded-full bg-primary/50" />{p}
                  </span>
                ))}
              </div>
            </div>
          )}
          {summary.lacunes.length > 0 && (
            <div className="rounded-xl bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2"><HelpCircle size={12} className="text-amber-500/70" /><span className="text-xs text-amber-500/70">Informations manquantes</span></div>
              <div className="flex flex-wrap gap-2">
                {summary.lacunes.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/5 text-xs text-amber-500/80">{l}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Topics */}
      {(profile?.topicsExplored?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <LayoutGrid size={16} className="text-primary/60" />
            <h3 className="font-semibold text-lg tracking-tight">Themes filmes</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile!.topicsExplored.map((topic) => (
              <span key={topic} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 text-xs text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />{topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Memories */}
      {allMems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Database size={16} className="text-primary/60" />
            <h3 className="font-semibold text-lg tracking-tight">Memoires IA</h3>
            <span className="text-xs text-muted-foreground ml-auto">{memories!.total} fragments</span>
          </div>
          {docGroups.length > 0 && (
            <CollapsibleGroup label="Documents" icon={FileText} count={`${docGroups.length} doc${docGroups.length > 1 ? 's' : ''}`}>
              {docGroups.map((g) => (
                <CollapsibleGroup key={g.name} label={g.name} icon={FileText} count={`${g.chunks.length} chunks`}>
                  {g.chunks.map((mem) => <MemoryChip key={mem.id} mem={mem} />)}
                </CollapsibleGroup>
              ))}
            </CollapsibleGroup>
          )}
          {sessionGroups.length > 0 && (
            <CollapsibleGroup label="Sessions" icon={Video} count={`${sessionGroups.length} session${sessionGroups.length > 1 ? 's' : ''}`}>
              {sessionGroups.map((g, i) => (
                <CollapsibleGroup key={g.sessionId} label={`Session #${i + 1}`} icon={Video} count={`${g.chunks.length} mem.`}>
                  {g.chunks.map((mem) => <MemoryChip key={mem.id} mem={mem} />)}
                </CollapsibleGroup>
              ))}
            </CollapsibleGroup>
          )}
          {chatMems.length > 0 && (
            <CollapsibleGroup label="Conversations" icon={MessageCircle} count={`${chatMems.length}`}>
              {chatMems.map((mem) => <MemoryChip key={mem.id} mem={mem} />)}
            </CollapsibleGroup>
          )}
        </div>
      )}

      {/* Conversation source */}
      {conversationSummary && <ConversationCollapsible summary={conversationSummary} />}

      {/* Document upload */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Upload size={16} className="text-primary/60" />
          <h3 className="font-semibold text-lg tracking-tight">Enrichir avec un document</h3>
        </div>
        <DocumentUpload onSuccess={() => load(true)} />
      </div>
    </div>
  )
}
