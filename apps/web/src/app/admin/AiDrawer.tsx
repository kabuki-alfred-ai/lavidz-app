'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Sparkles,
  X,
  Loader2,
  Link2,
  Copy,
  Check,
  Users,
  UserIcon,
  CheckCircle2,
  ArrowUp,
  RotateCcw,
  History,
  ChevronLeft,
  Trash2,
  MessageSquare,
} from 'lucide-react'

type Question = { text: string; hint?: string; order: number }
type GeneratedResult = { shareLink: string }
type Audience = 'self' | 'client'
type PanelView = 'chat' | 'history' | 'history-detail'
type HistoryEntry = {
  id: string
  date: string
  preview: string
  messageCount: number
  messages: ChatMessage[]
}

type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'questionnaire'; themeTitle: string; questions: Question[]; result?: GeneratedResult }

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  parts: MessagePart[]
  raw?: string // defined while streaming
}

const Q_START = '<<<QUESTIONNAIRE>>>'
const Q_END = '<<<END>>>'

function parseMessageParts(raw: string): MessagePart[] {
  const startIdx = raw.indexOf(Q_START)
  const endIdx = raw.indexOf(Q_END)

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return [{ type: 'text', content: raw.trim() }]
  }

  const parts: MessagePart[] = []
  const textBefore = raw.slice(0, startIdx).trim()
  const jsonStr = raw.slice(startIdx + Q_START.length, endIdx).trim()
  const textAfter = raw.slice(endIdx + Q_END.length).trim()

  if (textBefore) parts.push({ type: 'text', content: textBefore })

  try {
    const parsed = JSON.parse(jsonStr)
    parts.push({ type: 'questionnaire', themeTitle: parsed.themeTitle, questions: parsed.questions })
  } catch {
    return [{ type: 'text', content: raw.trim() }]
  }

  if (textAfter) parts.push({ type: 'text', content: textAfter })
  return parts
}

// ─── Questionnaire card ───────────────────────────────────────────────────────

type CardStep = 'review' | 'approved' | 'done'

function QuestionnaireCard({
  part,
  onValidated,
  onModify,
}: {
  part: MessagePart & { type: 'questionnaire' }
  onValidated: (result: GeneratedResult) => void
  onModify: (prefill: string) => void
}) {
  const [step, setStep] = useState<CardStep>(part.result ? 'done' : 'review')
  const [audience, setAudience] = useState<Audience>('self')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ai/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          themeTitle: part.themeTitle,
          questions: part.questions,
          targetAudience: audience,
          recipientEmail: audience === 'client' ? recipientEmail : undefined,
          recipientName: audience === 'client' ? recipientName : undefined,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setStep('done')
      onValidated({ shareLink: data.shareLink })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    const link = part.result?.shareLink
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="rounded-2xl border border-primary/30 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, transparent), transparent)',
        animation: 'fadeInUp 0.3s ease forwards',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/40">
        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">
          Proposition de questionnaire
        </p>
        <div className="flex items-center justify-between gap-2">
          <p className="font-black text-sm uppercase tracking-tight leading-tight">{part.themeTitle}</p>
          <span className="shrink-0 text-[9px] font-mono font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
            {part.questions.length} questions
          </span>
        </div>
      </div>

      {/* Questions */}
      <div className="px-4 py-3">
        <ol className="space-y-3">
          {part.questions.map((q) => (
            <li key={q.order} className="flex gap-3">
              <span className="text-primary/40 font-mono text-xs shrink-0 mt-0.5 w-4 text-right">
                {q.order}.
              </span>
              <div className="min-w-0">
                <p className="text-foreground leading-snug text-xs">{q.text}</p>
                {q.hint && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 italic">{q.hint}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Actions */}
      <div className="border-t border-border/40 px-4 py-3">

        {/* ── STEP: review ── */}
        {step === 'review' && (
          <div className="flex gap-2">
            <button
              onClick={() => setStep('approved')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all"
            >
              <CheckCircle2 size={12} />
              Approuver
            </button>
            <button
              onClick={() => onModify(`Je voudrais modifier le questionnaire "${part.themeTitle}" : `)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border bg-muted/20 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-border/80 transition-all"
            >
              <RotateCcw size={12} />
              Modifier
            </button>
          </div>
        )}

        {/* ── STEP: approved — choose audience & create ── */}
        {step === 'approved' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['self', 'client'] as Audience[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
                    audience === a
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border/80'
                  }`}
                >
                  {a === 'self' ? <UserIcon size={12} /> : <Users size={12} />}
                  {a === 'self' ? 'Moi' : 'Un client'}
                </button>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateRows: audience === 'client' ? '1fr' : '0fr',
                transition: 'grid-template-rows 0.25s ease',
              }}
            >
              <div className="overflow-hidden">
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Prénom"
                    className="bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/50"
                  />
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="Email"
                    className="bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-[10px] font-mono text-red-400">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={loading || (audience === 'client' && !recipientEmail.trim())}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <><Loader2 size={12} className="animate-spin" /> Création…</>
              ) : (
                <>Créer la session →</>
              )}
            </button>
          </div>
        )}

        {/* ── STEP: done ── */}
        {step === 'done' && part.result && (
          <div className="space-y-2">
            <p className="text-[10px] font-mono text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 size={11} /> Session créée avec succès
            </p>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-muted/40 border border-border rounded-xl px-3 py-2 min-w-0">
                <Link2 size={10} className="text-primary shrink-0" />
                <span className="text-[10px] font-mono text-muted-foreground truncate">
                  {part.result.shareLink}
                </span>
              </div>
              <button
                onClick={copyLink}
                className="flex items-center justify-center w-9 h-9 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all shrink-0"
              >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-muted-foreground" />}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Suggestion chips ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Parler de mon activité',
  'Partager une nouveauté de mon business',
  'Créer un questionnaire vidéo',
]

// ─── Drawer + FAB ─────────────────────────────────────────────────────────────

const LS_KEY = 'lavidz-ai-drawer-messages'
const LS_HISTORY_KEY = 'lavidz-ai-drawer-history'
const MAX_HISTORY = 30

function loadHistory(): HistoryEntry[] {
  try {
    const saved = localStorage.getItem(LS_HISTORY_KEY)
    return saved ? (JSON.parse(saved) as HistoryEntry[]) : []
  } catch { return [] }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)))
  } catch { /* ignore */ }
}

function archiveMessages(messages: ChatMessage[]) {
  const userMessages = messages.filter((m) => m.role === 'user')
  if (userMessages.length === 0) return
  const firstUser = userMessages[0].parts
    .filter((p) => p.type === 'text').map((p) => p.content).join('').slice(0, 90)
  const entry: HistoryEntry = {
    id: Math.random().toString(36).slice(2),
    date: new Date().toISOString(),
    preview: firstUser || 'Conversation',
    messageCount: messages.filter((m) => !m.raw).length,
    messages: messages.filter((m) => !m.raw),
  }
  const existing = loadHistory()
  saveHistory([entry, ...existing])
}

function formatHistoryDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `il y a ${mins || 1} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days}j`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function AiDrawer() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      return saved ? (JSON.parse(saved) as ChatMessage[]) : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panelView, setPanelView] = useState<PanelView>('chat')
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>(() => loadHistory())
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (streaming) return // Don't save mid-stream (raw state)
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(messages))
    } catch { /* quota exceeded or SSR — ignore */ }
  }, [messages, streaming])

  // Auto-greet on first open with empty conversation
  useEffect(() => {
    if (open && messages.length === 0 && !streaming) {
      greet()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [input])

  function mkId() {
    return Math.random().toString(36).slice(2)
  }

  async function greet() {
    if (streaming) return
    setStreaming(true)
    const assistantId = mkId()
    setMessages([{ id: assistantId, role: 'assistant', parts: [], raw: '' }])

    try {
      const res = await fetch('/api/admin/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: '__INIT__' }] }),
      })
      if (!res.ok) throw new Error(await res.text())

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let raw = ''
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          raw += decoder.decode(value, { stream: true })
          setMessages([{ id: assistantId, role: 'assistant', parts: [], raw }])
        }
      }
      const finalParts = parseMessageParts(raw)
      setMessages([{ id: assistantId, role: 'assistant', parts: finalParts }])
    } catch {
      setMessages([])
    } finally {
      setStreaming(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }

  async function persistConversation(allMessages: ChatMessage[]) {
    const conversation = allMessages
      .map((m) => {
        const label = m.role === 'user' ? 'Entrepreneur' : 'Assistant'
        const content = m.parts
          .map((p) => (p.type === 'text' ? p.content : `[Questionnaire : ${p.themeTitle}]`))
          .join('\n')
        return `${label}: ${content}`
      })
      .join('\n\n')
    const answers = allMessages
      .filter((m) => m.role === 'user')
      .map((m) => m.parts.filter((p) => p.type === 'text').map((p) => p.content).join(''))

    await fetch('/api/admin/ai/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessContext: { conversationSummary: conversation, answers },
      }),
    }).catch(() => {/* silently continue */})
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text || streaming) return
    setInput('')
    setError(null)

    const userMsg: ChatMessage = {
      id: mkId(),
      role: 'user',
      parts: [{ type: 'text', content: text }],
    }
    const history = [...messages, userMsg]
    setMessages(history)
    setStreaming(true)

    const assistantId = mkId()
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', parts: [], raw: '' }])

    try {
      const res = await fetch('/api/admin/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map((m) => ({
            role: m.role,
            content: m.parts
              .map((p) =>
                p.type === 'text' ? p.content : `[Questionnaire proposé : ${p.themeTitle}]`,
              )
              .join('\n'),
          })),
        }),
      })

      if (!res.ok) throw new Error(await res.text())

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let raw = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          raw += decoder.decode(value, { stream: true })
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, raw } : m)),
          )
        }
      }

      const finalParts = parseMessageParts(raw)
      const finalMessages = history.concat({ id: assistantId, role: 'assistant', parts: finalParts })
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, parts: finalParts, raw: undefined } : m,
        ),
      )

      // Auto-persist + re-summarize after each exchange (≥ 2 user messages)
      const userCount = finalMessages.filter((m) => m.role === 'user').length
      if (userCount >= 2) {
        persistConversation(finalMessages).then(() => {
          // Fire-and-forget: regenerate AI summary after saving
          fetch('/api/admin/ai/profile/summarize', { method: 'POST' }).catch(() => {})
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setMessages((prev) => prev.filter((m) => m.id !== assistantId))
    } finally {
      setStreaming(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }

  function handleValidated(
    assistantId: string,
    partIdx: number,
    result: GeneratedResult,
  ) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== assistantId) return m
        return {
          ...m,
          parts: m.parts.map((p, i) =>
            i === partIdx && p.type === 'questionnaire' ? { ...p, result } : p,
          ),
        }
      }),
    )
  }

  function clearConversation() {
    archiveMessages(messages)
    setHistoryEntries(loadHistory())
    setMessages([])
    setError(null)
    setPanelView('chat')
    try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
    setTimeout(() => greet(), 0)
  }

  function deleteHistoryEntry(id: string) {
    const updated = historyEntries.filter((e) => e.id !== id)
    saveHistory(updated)
    setHistoryEntries(updated)
    if (selectedEntry?.id === id) {
      setSelectedEntry(null)
      setPanelView('history')
    }
  }

  return (
    <>
      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes blinkCursor {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        .ai-scrollbar::-webkit-scrollbar { width: 4px; }
        .ai-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .ai-scrollbar::-webkit-scrollbar-thumb { background: color-mix(in srgb, currentColor 20%, transparent); border-radius: 99px; }
        .ai-scrollbar { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 20%, transparent) transparent; }
      `}</style>

      {/* FAB Container */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 pointer-events-none">
        {/* Label (only when closed) */}
        {!open && (
          <div 
            className="px-3 py-1.5 bg-black !bg-[#050505] border border-white/10 rounded-full shadow-2xl animate-in fade-in slide-in-from-right-2 duration-500"
            style={{ animationDelay: '200ms' }}
          >
            <span className="text-[10px] font-mono font-bold text-white/50 uppercase tracking-widest">
              Kabou
            </span>
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          className="w-14 h-14 rounded-full bg-black !bg-[#050505] border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] hover:border-primary/60 active:scale-95 transition-all flex items-center justify-center overflow-hidden group pointer-events-auto"
          aria-label="Assistant IA"
        >
          {open ? (
            <X size={20} className="text-foreground relative z-10" />
          ) : (
            <div className="relative w-full h-full">
              <img 
                src="/lavi-robot.png" 
                alt="Kabou" 
                className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-500"
              />
              <div className="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors" />
              <div className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0a0a0a] rounded-full shadow-sm" />
            </div>
          )}
        </button>
      </div>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 transition-all duration-300"
        style={{
          background: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-label="Assistant IA"
        aria-modal="true"
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-background border-l border-border shadow-2xl"
        style={{
          width: 528,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease',
          willChange: 'transform',
        }}
      >
        {/* ── Header ── */}
        <div className="shrink-0 h-14 flex items-center justify-between px-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full overflow-hidden border border-primary/20 bg-surface flex-shrink-0">
              <img src="/lavi-robot.png" alt="Kabou" className="w-full h-full object-cover" />
            </div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest leading-none">
              Kabou
            </span>
            {/* Live pulsing dot */}
            <span
              className="w-2 h-2 rounded-full bg-emerald-500"
              style={{ animation: 'pulseDot 2s ease-in-out infinite' }}
              aria-label="En ligne"
            />
          </div>

          <div className="flex items-center gap-1">
            {panelView !== 'chat' ? (
              <button
                onClick={() => { setPanelView('chat'); setSelectedEntry(null) }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-all"
                aria-label="Retour au chat"
              >
                <ChevronLeft size={11} />
                Chat
              </button>
            ) : (
              <>
                {messages.length > 0 && (
                  <button
                    onClick={clearConversation}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-all"
                    aria-label="Nouvelle conversation"
                  >
                    <RotateCcw size={11} />
                    Nouvelle
                  </button>
                )}
                <button
                  onClick={() => { setHistoryEntries(loadHistory()); setPanelView('history') }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-all"
                  aria-label="Historique"
                >
                  <History size={11} />
                  Historique
                </button>
              </>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-all"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── History list panel ── */}
        {panelView === 'history' && (
          <div className="flex-1 min-h-0 relative">
            <div className="absolute inset-0 overflow-y-auto ai-scrollbar px-4 py-4 space-y-2">
              <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest px-1 mb-3">
                {historyEntries.length} conversation{historyEntries.length !== 1 ? 's' : ''} sauvegardée{historyEntries.length !== 1 ? 's' : ''}
              </p>
              {historyEntries.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <MessageSquare size={28} className="text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground/40 font-mono">Aucun historique pour l&apos;instant</p>
                </div>
              )}
              {historyEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="group flex items-start gap-3 px-4 py-3 rounded-xl border border-border/50 hover:border-border bg-muted/10 hover:bg-muted/30 cursor-pointer transition-all"
                  onClick={() => { setSelectedEntry(entry); setPanelView('history-detail') }}
                >
                  <MessageSquare size={13} className="text-primary/40 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground leading-snug truncate">{entry.preview}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-muted-foreground/50">{formatHistoryDate(entry.date)}</span>
                      <span className="text-[10px] font-mono text-muted-foreground/30">·</span>
                      <span className="text-[10px] font-mono text-muted-foreground/50">{entry.messageCount} messages</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(entry.id) }}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 hover:text-red-400 text-muted-foreground/40 transition-all shrink-0"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── History detail panel ── */}
        {panelView === 'history-detail' && selectedEntry && (
          <div className="flex-1 min-h-0 relative">
            <div className="absolute inset-0 overflow-y-auto ai-scrollbar px-5 py-4 space-y-6">
              <p className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest px-1">
                {formatHistoryDate(selectedEntry.date)} · {selectedEntry.messageCount} messages
              </p>
              {selectedEntry.messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed bg-primary/80 text-primary-foreground whitespace-pre-wrap opacity-80">
                        {msg.parts.filter((p) => p.type === 'text').map((p) => p.content).join('')}
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={msg.id} className="flex flex-col items-start gap-2 max-w-[80%]">
                    {msg.parts.map((part, i) => {
                      if (part.type === 'text') {
                        return part.content ? (
                          <div key={i} className="px-4 py-3 rounded-2xl text-sm leading-relaxed bg-muted/30 border border-border/30 text-foreground/70 whitespace-pre-wrap">
                            {part.content}
                          </div>
                        ) : null
                      }
                      return (
                        <div key={i} className="w-full rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                          <p className="text-[9px] font-mono text-primary/50 uppercase tracking-widest mb-1">Questionnaire</p>
                          <p className="text-xs font-bold text-foreground/70">{part.themeTitle}</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{part.questions.length} questions</p>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Messages area ── */}
        {panelView === 'chat' && (
        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 overflow-y-auto ai-scrollbar px-5 py-4 space-y-6">
            {/* Empty state — shown only briefly before greet() fires */}
            {messages.length === 0 && streaming && (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3 text-center">
                <Loader2 size={18} className="animate-spin text-primary/40" />
                <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Kabou arrive…</span>
              </div>
            )}

            {messages.map((msg) => {
              // ── Streaming placeholder ──
              if (msg.raw !== undefined) {
                const visibleText = msg.raw.includes(Q_START)
                  ? msg.raw.slice(0, msg.raw.indexOf(Q_START)).trim()
                  : msg.raw

                return (
                  <div key={msg.id} className="flex flex-col items-start gap-1 max-w-[80%]">
                    {visibleText ? (
                      <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed bg-muted/50 border border-border/50 text-foreground whitespace-pre-wrap">
                        {visibleText}
                        <span
                          className="inline-block w-[7px] h-[14px] bg-foreground/70 ml-0.5 align-middle rounded-[1px]"
                          style={{ animation: 'blinkCursor 0.9s step-start infinite' }}
                        />
                      </div>
                    ) : (
                      !msg.raw.includes(Q_START) && (
                        <div className="px-4 py-3 rounded-2xl text-sm bg-muted/50 border border-border/50 text-muted-foreground flex items-center gap-2">
                          <Loader2 size={12} className="animate-spin" />
                          Réflexion en cours…
                        </div>
                      )
                    )}
                    {msg.raw.includes(Q_START) && (
                      <div className="px-4 py-3 rounded-2xl text-sm border bg-primary/5 border-primary/20 text-muted-foreground italic flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin text-primary" />
                        Génération du questionnaire…
                      </div>
                    )}
                  </div>
                )
              }

              // ── User message ──
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed bg-primary text-primary-foreground whitespace-pre-wrap">
                      {msg.parts
                        .filter((p) => p.type === 'text')
                        .map((p) => p.content)
                        .join('')}
                    </div>
                  </div>
                )
              }

              // ── Assistant message ──
              return (
                <div key={msg.id} className="flex flex-col items-start gap-2 max-w-[80%]">
                  {msg.parts.map((part, i) => {
                    if (part.type === 'text') {
                      return part.content ? (
                        <div
                          key={i}
                          className="px-4 py-3 rounded-2xl text-sm leading-relaxed bg-muted/50 border border-border/50 text-foreground whitespace-pre-wrap"
                        >
                          {part.content}
                        </div>
                      ) : null
                    }
                    return (
                      <div key={i} className="w-full">
                        <QuestionnaireCard
                          part={part}
                          onValidated={(result) => handleValidated(msg.id, i, result)}
                          onModify={(prefill) => {
                            setInput(prefill)
                            setTimeout(() => {
                              textareaRef.current?.focus()
                              const len = prefill.length
                              textareaRef.current?.setSelectionRange(len, len)
                            }, 50)
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {error && (
              <p className="text-[10px] font-mono text-red-400 px-1">{error}</p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Top fade gradient over messages */}
          <div
            className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, transparent, var(--background))',
            }}
          />
        </div>
        )}

        {/* ── Input area (chat only) ── */}
        {panelView === 'chat' && (
        <div className="shrink-0 px-4 py-3 border-t border-border">
          <div
            className="flex items-end gap-2 bg-muted/30 rounded-xl px-4 py-3"
          >
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Écrivez un message…"
              disabled={streaming}
              className="flex-1 bg-transparent resize-none text-sm focus:outline-none disabled:opacity-50 placeholder:text-muted-foreground/50 min-h-[20px] max-h-[120px] leading-relaxed"
              style={{ scrollbarWidth: 'none' }}
            />
            <button
              onClick={() => send()}
              disabled={streaming || !input.trim()}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all self-end mb-0.5"
              aria-label="Envoyer"
            >
              {streaming ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ArrowUp size={14} />
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 font-mono text-center mt-2">
            Entrée pour envoyer · Maj+Entrée pour nouvelle ligne
          </p>
        </div>
        )}
      </div>
    </>
  )
}
