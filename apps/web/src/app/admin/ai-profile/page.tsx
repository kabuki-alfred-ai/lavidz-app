'use client'

import React, { useEffect, useState } from 'react'
import {
  Brain,
  Sparkles,
  Tag,
  ChevronRight,
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
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  createdAt: string
  updatedAt: string
}

type Memory = {
  id: string
  content: string
  tags: string[]
  sessionId: string | null
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "à l'instant"
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
  if (stade === 'démarrage') return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  if (stade === 'croissance') return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
}

function tagColor(tag: string) {
  if (tag === 'fact') return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  if (tag === 'quote') return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
  if (tag === 'theme') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  return 'bg-primary/10 text-primary border-primary/20'
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string
}) {
  return (
    <div className="border border-border/60 bg-surface/30 rounded-sm p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={13} />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div>
        <p className="text-2xl font-black tracking-tighter text-foreground">{value}</p>
        {sub && <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Knowledge card ───────────────────────────────────────────────────────────

function KnowledgeCard({ icon: Icon, label, value, accent = false }: {
  icon: React.ElementType; label: string; value: string; accent?: boolean
}) {
  return (
    <div className={`border rounded-sm p-4 space-y-2 ${
      accent
        ? 'border-primary/20 bg-primary/3'
        : 'border-border/60 bg-surface/30'
    }`}>
      <div className="flex items-center gap-2">
        <Icon size={12} className={accent ? 'text-primary/70' : 'text-muted-foreground/60'} />
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/60">
          {label}
        </span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{value}</p>
    </div>
  )
}

// ─── Conversation collapsible ─────────────────────────────────────────────────

function ConversationCollapsible({ summary }: { summary: string }) {
  const [open, setOpen] = useState(false)
  const lines = summary.split('\n\n').filter(Boolean)

  return (
    <div className="border border-border/40 rounded-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface/40 transition-colors"
      >
        <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60">
          Voir la conversation complète ({lines.length} échanges)
        </span>
        {open ? <ChevronUp size={13} className="text-muted-foreground/40" /> : <ChevronDown size={13} className="text-muted-foreground/40" />}
      </button>
      {open && (
        <div className="border-t border-border/40 p-4 space-y-3 max-h-80 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {lines.map((line, i) => {
            const isE = line.startsWith('Entrepreneur:')
            const isA = line.startsWith('Assistant:')
            if (!isE && !isA) return <p key={i} className="text-xs text-muted-foreground italic">{line}</p>
            const [prefix, ...rest] = line.split(': ')
            return (
              <div key={i} className={`flex gap-2 ${isE ? 'flex-row-reverse' : ''}`}>
                <div className={`shrink-0 w-5 h-5 rounded-sm border flex items-center justify-center text-[8px] font-mono font-bold ${isE ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-surface-raised border-border text-muted-foreground'}`}>
                  {isE ? 'E' : 'IA'}
                </div>
                <div className={`max-w-[80%] px-3 py-2 rounded-sm text-xs leading-relaxed border ${isE ? 'bg-primary/5 border-primary/15' : 'bg-surface/60 border-border/60 text-muted-foreground'}`}>
                  <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/40 block mb-0.5">{prefix}</span>
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

// ─── Empty / no-summary state ─────────────────────────────────────────────────

function EmptyProfile({ hasConversation }: { hasConversation: boolean }) {
  return (
    <div className="border border-border/40 border-dashed rounded-sm p-16 text-center space-y-4">
      <div className="w-14 h-14 mx-auto rounded-sm bg-surface/40 border border-border/60 flex items-center justify-center">
        <Brain size={24} className="text-muted-foreground/30" />
      </div>
      {hasConversation ? (
        <>
          <p className="font-inter font-black text-foreground">Résumé en cours de génération</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Le résumé IA est généré après chaque échange. Rechargez la page dans quelques secondes.
          </p>
        </>
      ) : (
        <>
          <p className="font-inter font-black text-foreground">Profil non configuré</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Cliquez sur{' '}
            <span className="inline-flex items-center gap-1 text-primary font-mono">
              <Sparkles size={11} /> ✦
            </span>{' '}
            en bas à droite pour démarrer une conversation avec l&apos;assistant IA.
          </p>
        </>
      )}
    </div>
  )
}

// ─── Document upload ──────────────────────────────────────────────────────────

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
    const allowed = ['text/plain', 'text/markdown', 'application/pdf']
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!allowed.includes(file.type) && !['txt', 'md', 'pdf'].includes(ext ?? '')) {
      setState({ status: 'error', message: 'Format non supporté. Utilisez .txt, .md ou .pdf' })
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

  function handleFiles(files: FileList | null) {
    if (!files?.[0]) return
    upload(files[0])
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Upload size={14} className="text-primary/60 shrink-0" />
        <h2 className="font-inter font-black text-lg tracking-tight">Enrichir avec un document</h2>
      </div>

      <div
        onClick={() => state.status === 'idle' || state.status === 'error' ? inputRef.current?.click() : undefined}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`relative border-2 border-dashed rounded-sm p-10 flex flex-col items-center gap-4 transition-all cursor-pointer ${
          dragOver
            ? 'border-primary/60 bg-primary/5'
            : state.status === 'done'
              ? 'border-emerald-500/40 bg-emerald-500/3 cursor-default'
              : state.status === 'error'
                ? 'border-red-500/40 bg-red-500/3'
                : 'border-border/50 hover:border-primary/40 hover:bg-surface/40'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {state.status === 'idle' && (
          <>
            <div className="w-12 h-12 rounded-sm bg-surface/60 border border-border/60 flex items-center justify-center">
              <FileText size={20} className="text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Déposez un fichier ou cliquez</p>
              <p className="text-[11px] font-mono text-muted-foreground/50 mt-1 uppercase tracking-widest">
                .txt · .md · .pdf — max 10 Mo
              </p>
            </div>
          </>
        )}

        {state.status === 'uploading' && (
          <>
            <Loader2 size={24} className="animate-spin text-primary/60" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{state.filename}</p>
              <p className="text-[11px] font-mono text-muted-foreground/50 mt-1 uppercase tracking-widest">
                Analyse et indexation en cours…
              </p>
            </div>
          </>
        )}

        {state.status === 'done' && (
          <>
            <CheckCircle2 size={24} className="text-emerald-500" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{state.filename}</p>
              <p className="text-[11px] font-mono text-emerald-500/80 mt-1 uppercase tracking-widest">
                {state.saved} fragment{state.saved > 1 ? 's' : ''} indexé{state.saved > 1 ? 's' : ''} dans la mémoire IA
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setState({ status: 'idle' }) }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border/60 rounded-sm text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              <Upload size={10} /> Ajouter un autre
            </button>
          </>
        )}

        {state.status === 'error' && (
          <>
            <X size={24} className="text-red-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-red-400">{state.message}</p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

// ─── Memory group helpers ─────────────────────────────────────────────────────

function getDocumentName(mem: Memory): string {
  return mem.tags.filter((t) => t !== 'document').at(-1) ?? 'Sans nom'
}

type DocumentGroup = { name: string; chunks: Memory[] }
type SessionGroup = { sessionId: string; chunks: Memory[] }

function groupByDocument(mems: Memory[]): DocumentGroup[] {
  const map = new Map<string, Memory[]>()
  for (const m of mems) {
    const name = getDocumentName(m)
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

// ─── Documents group ──────────────────────────────────────────────────────────

function DocumentGroupCard({ group, index }: { group: DocumentGroup; index: number }) {
  const [open, setOpen] = useState(false)
  const displayTags = (mem: Memory) => mem.tags.filter((t) => t !== 'document' && t !== group.name)

  return (
    <div className="border border-border/50 bg-surface/20 rounded-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface/40 transition-colors"
        aria-expanded={open}
      >
        <FileText size={13} className="text-primary/50 shrink-0" />
        <span className="flex-1 text-[11px] font-mono text-foreground truncate">{group.name}</span>
        <span className="shrink-0 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border/60 bg-surface/40 text-muted-foreground/60">
          {group.chunks.length} chunk{group.chunks.length > 1 ? 's' : ''}
        </span>
        {open
          ? <ChevronUp size={12} className="shrink-0 text-muted-foreground/40" />
          : <ChevronDown size={12} className="shrink-0 text-muted-foreground/40" />
        }
      </button>

      {open && (
        <div
          className="border-t border-border/40 px-4 py-3 space-y-2 max-h-72 overflow-y-auto"
          style={{ scrollbarWidth: 'thin' }}
        >
          {group.chunks.map((mem, i) => (
            <div
              key={mem.id}
              className="border border-border/40 bg-surface/30 rounded-sm px-3 py-2.5 space-y-2"
              style={{ animation: `fadeUp 0.3s ease ${i * 30}ms forwards`, opacity: 0 }}
            >
              <p className="text-xs text-foreground leading-relaxed">{mem.content}</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {displayTags(mem).map((tag) => (
                    <span key={tag} className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${tagColor(tag)}`}>
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="shrink-0 text-[9px] font-mono text-muted-foreground/40">
                  {formatRelative(mem.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DocumentsGroup({ groups }: { groups: DocumentGroup[] }) {
  return (
    <div className="space-y-2">
      {groups.map((g, i) => (
        <DocumentGroupCard key={g.name} group={g} index={i} />
      ))}
    </div>
  )
}

// ─── Sessions group ───────────────────────────────────────────────────────────

function SessionGroupCard({ group, index }: { group: SessionGroup; index: number }) {
  const [open, setOpen] = useState(false)
  const firstDate = group.chunks.reduce<string>((acc, m) => acc < m.createdAt ? acc : m.createdAt, group.chunks[0]?.createdAt ?? '')

  return (
    <div className="border border-border/50 bg-surface/20 rounded-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface/40 transition-colors"
        aria-expanded={open}
      >
        <Video size={13} className="text-primary/50 shrink-0" />
        <span className="flex-1 text-[11px] font-mono text-foreground">
          Session #{index + 1}
        </span>
        <span className="shrink-0 text-[9px] font-mono text-muted-foreground/40">
          {formatDate(firstDate)}
        </span>
        <span className="shrink-0 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border/60 bg-surface/40 text-muted-foreground/60">
          {group.chunks.length} mém.
        </span>
        {open
          ? <ChevronUp size={12} className="shrink-0 text-muted-foreground/40" />
          : <ChevronDown size={12} className="shrink-0 text-muted-foreground/40" />
        }
      </button>

      {open && (
        <div
          className="border-t border-border/40 px-4 py-3 space-y-2 max-h-72 overflow-y-auto"
          style={{ scrollbarWidth: 'thin' }}
        >
          {group.chunks.map((mem, i) => (
            <div
              key={mem.id}
              className="border border-border/40 bg-surface/30 rounded-sm px-3 py-2.5 space-y-2"
              style={{ animation: `fadeUp 0.3s ease ${i * 30}ms forwards`, opacity: 0 }}
            >
              <p className="text-xs text-foreground leading-relaxed">{mem.content}</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {mem.tags.map((tag) => (
                    <span key={tag} className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${tagColor(tag)}`}>
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="shrink-0 text-[9px] font-mono text-muted-foreground/40">
                  {formatRelative(mem.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SessionsGroup({ groups }: { groups: SessionGroup[] }) {
  return (
    <div className="space-y-2">
      {groups.map((g, i) => (
        <SessionGroupCard key={g.sessionId} group={g} index={i} />
      ))}
    </div>
  )
}

// ─── Chat group ───────────────────────────────────────────────────────────────

function ChatGroup({ memories: mems }: { memories: Memory[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {mems.map((mem, i) => (
        <div
          key={mem.id}
          className="border border-border/50 bg-surface/20 rounded-sm p-3 space-y-2 hover:border-border/80 hover:bg-surface/40 transition-all"
          style={{ animation: `fadeUp 0.4s ease ${i * 40}ms forwards`, opacity: 0 }}
        >
          <p className="text-xs text-foreground leading-relaxed">{mem.content}</p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {mem.tags.map((tag) => (
                <span key={tag} className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${tagColor(tag)}`}>
                  {tag}
                </span>
              ))}
            </div>
            <span className="shrink-0 text-[9px] font-mono text-muted-foreground/40">
              {formatRelative(mem.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Sub-section wrapper ──────────────────────────────────────────────────────

function MemorySubSection({
  label,
  count,
  children,
}: {
  label: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
          {label}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/40">·</span>
        <span className="text-[9px] font-mono text-muted-foreground/40">{count}</span>
        <span className="flex-1 h-[1px] bg-border/30 ml-1" />
      </div>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiProfilePage() {
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
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function resetProfile() {
    setResetting(true)
    try {
      const res = await fetch('/api/admin/ai/profile', { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setShowResetConfirm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du reset')
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => { load() }, [])

  const summary = profile?.businessContext?.summary as AiSummary | undefined
  const conversationSummary = profile?.businessContext?.conversationSummary
  const hasConversation = !!conversationSummary

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 size={22} className="animate-spin text-primary/40" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Chargement…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border border-red-500/20 bg-red-500/5 rounded-sm p-6 flex items-center gap-3">
        <AlertCircle size={16} className="text-red-400 shrink-0" />
        <p className="text-sm font-mono text-red-400">{error}</p>
      </div>
    )
  }

  // ── Classify memories ──
  const allMems = memories?.memories ?? []
  const docMems = allMems.filter((m) => m.tags.includes('document'))
  const sessionMems = allMems.filter((m) => m.sessionId !== null && !m.tags.includes('document'))
  const chatMems = allMems.filter((m) => m.sessionId === null && !m.tags.includes('document'))

  const docGroups = groupByDocument(docMems)
  const sessionGroups = groupBySession(sessionMems)

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Reset confirmation modal ── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-sm p-8 max-w-sm w-full mx-4 space-y-6 shadow-2xl">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Trash2 size={16} className="text-red-400" />
                <h2 className="font-inter font-black text-lg tracking-tight text-foreground">Réinitialiser le profil IA</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cette action supprime <strong className="text-foreground">toutes les mémoires</strong> et réinitialise le profil complet. L&apos;IA repartira de zéro.
              </p>
              <p className="text-[10px] font-mono text-red-400/80 uppercase tracking-wider">Action irréversible</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                className="flex-1 px-4 py-2.5 border border-border/60 rounded-sm text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                onClick={resetProfile}
                disabled={resetting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-sm text-[11px] font-mono uppercase tracking-widest text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-colors disabled:opacity-40"
              >
                {resetting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                {resetting ? 'Réinitialisation…' : 'Réinitialiser'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl space-y-10 animate-in fade-in duration-700">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-[1px] bg-primary/40" />
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60">
                <span>IA</span>
                <ChevronRight size={10} className="text-primary/30" />
                <span>Profil</span>
              </div>
            </div>
            <h1 className="font-inter font-black text-4xl text-foreground tracking-tighter">
              Profil IA
            </h1>
            <p className="text-[11px] font-mono text-muted-foreground/60 mt-2 uppercase tracking-widest">
              Ce que l&apos;IA connait de vous
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border/60 rounded-sm text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-40"
            >
              <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
              Actualiser
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/20 rounded-sm text-[10px] font-mono uppercase tracking-widest text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-colors"
            >
              <Trash2 size={10} />
              Reset
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        {profile && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Database} label="Mémoires" value={memories?.total ?? 0} sub="fragments mémorisés" />
            <StatCard icon={LayoutGrid} label="Thèmes filmés" value={profile.topicsExplored.length} sub="sujets explorés" />
            <StatCard icon={Clock} label="Profil créé" value={formatRelative(profile.createdAt)} sub={formatDate(profile.createdAt)} />
            <StatCard icon={Clock} label="Dernière MàJ" value={formatRelative(profile.updatedAt)} sub={formatDate(profile.updatedAt)} />
          </div>
        )}

        {/* ── No profile ── */}
        {!summary && <EmptyProfile hasConversation={hasConversation} />}

        {/* ── AI Summary ── */}
        {summary && (
          <section className="space-y-4" style={{ animation: 'fadeUp 0.5s ease forwards' }}>
            <div className="flex items-center gap-3">
              <Brain size={14} className="text-primary/60 shrink-0" />
              <h2 className="font-inter font-black text-lg tracking-tight">Ce que l&apos;IA sait</h2>
              <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${stadeColor(summary.stade)}`}>
                {summary.stade}
              </span>
            </div>

            {/* Activité — full width highlight */}
            <KnowledgeCard icon={Zap} label="Activité" value={summary.activite} accent />

            {/* 2-col grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <KnowledgeCard icon={Users} label="Clients cibles" value={summary.clientsCibles} />
              <KnowledgeCard icon={Target} label="Problème résolu" value={summary.problemeResolu} />
              <KnowledgeCard icon={Video} label="Objectifs contenu" value={summary.objectifsContenu} />
              <KnowledgeCard icon={MessageCircle} label="Style de communication" value={summary.styleComm} />
            </div>

            {/* Points forts */}
            {summary.pointsForts.length > 0 && (
              <div className="border border-border/60 bg-surface/30 rounded-sm p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Tag size={12} className="text-muted-foreground/60" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/60">Points forts</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {summary.pointsForts.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-[11px] font-mono text-primary">
                      <span className="w-1 h-1 rounded-full bg-primary/50" />
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Lacunes */}
            {summary.lacunes.length > 0 && (
              <div className="border border-amber-500/20 bg-amber-500/3 rounded-sm p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <HelpCircle size={12} className="text-amber-400/70" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-400/70">Informations manquantes</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {summary.lacunes.map((l) => (
                    <span key={l} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-[11px] font-mono text-amber-400/80">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Thèmes filmés ── */}
        {(profile?.topicsExplored?.length ?? 0) > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <LayoutGrid size={14} className="text-primary/60 shrink-0" />
              <h2 className="font-inter font-black text-lg tracking-tight">Thèmes filmés</h2>
              <span className="text-[10px] font-mono text-muted-foreground/50 ml-auto">
                {profile!.topicsExplored.length} thème{profile!.topicsExplored.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="border border-border/60 bg-surface/30 rounded-sm p-5 flex flex-wrap gap-2">
              {profile!.topicsExplored.map((topic) => (
                <span key={topic} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/60 bg-surface/40 text-[11px] font-mono text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                  {topic}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Mémoires ── */}
        {allMems.length > 0 && (
          <section className="space-y-6">
            {/* Section header */}
            <div className="flex items-center gap-3">
              <Database size={14} className="text-primary/60 shrink-0" />
              <h2 className="font-inter font-black text-lg tracking-tight">Mémoires IA</h2>
              <span className="text-[10px] font-mono text-muted-foreground/50 ml-auto">
                {memories!.total} mémoire{memories!.total > 1 ? 's' : ''}
                {docGroups.length > 0 && (
                  <> · {docGroups.length} document{docGroups.length > 1 ? 's' : ''}</>
                )}
                {sessionGroups.length > 0 && (
                  <> · {sessionGroups.length} session{sessionGroups.length > 1 ? 's' : ''}</>
                )}
                {chatMems.length > 0 && (
                  <> · {chatMems.length} conversation{chatMems.length > 1 ? 's' : ''}</>
                )}
              </span>
            </div>

            {/* Documents */}
            {docGroups.length > 0 && (
              <MemorySubSection
                label="Documents"
                count={docGroups.length}
              >
                <DocumentsGroup groups={docGroups} />
              </MemorySubSection>
            )}

            {/* Sessions */}
            {sessionGroups.length > 0 && (
              <MemorySubSection
                label="Sessions"
                count={sessionGroups.length}
              >
                <SessionsGroup groups={sessionGroups} />
              </MemorySubSection>
            )}

            {/* Chat */}
            {chatMems.length > 0 && (
              <MemorySubSection
                label="Conversations Kabou"
                count={chatMems.length}
              >
                <ChatGroup memories={chatMems} />
              </MemorySubSection>
            )}
          </section>
        )}

        {/* ── Conversation source ── */}
        {conversationSummary && (
          <section className="space-y-3">
            <ConversationCollapsible summary={conversationSummary} />
          </section>
        )}

        {/* ── Document upload ── */}
        <DocumentUpload onSuccess={() => load(true)} />

        {/* ── CTA ── */}
        <div className="border border-border/40 border-dashed rounded-sm p-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-inter font-bold">Enrichir via le chat</p>
            <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5 uppercase tracking-widest">
              Le résumé se met à jour automatiquement
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
            <Sparkles size={11} className="text-primary" />
            Ouvrez l&apos;assistant IA via ✦ en bas à droite
          </div>
        </div>
      </div>
    </>
  )
}
