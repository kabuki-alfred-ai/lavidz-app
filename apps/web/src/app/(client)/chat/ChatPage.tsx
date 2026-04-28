'use client'

import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithToolCalls, DefaultChatTransport } from 'ai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Send, Sparkles, ArrowRight, Mic, Square, Loader2 as Loader, ChevronLeft, Zap, Lightbulb, TrendingUp, MessageCircle, Repeat2, CalendarDays, Pencil } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { EditorialPlanProposal } from '@/components/chat/EditorialPlanProposal'
import { UnstuckCard } from '@/components/chat/UnstuckCard'
import { WeeklyReviewCard } from '@/components/chat/WeeklyReviewCard'
import { MakeSubjectButton } from '@/components/chat/MakeSubjectButton'

// ─── Constants ───────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Ce qui frustre mes clients en ce moment', icon: Zap },
  { label: 'Mon meilleur apprentissage recent', icon: Lightbulb },
  { label: 'Une idee recue fausse dans mon secteur', icon: Sparkles },
  { label: 'Ce que je repete souvent a mes clients', icon: MessageCircle },
  { label: 'Une tendance qui change mon marche', icon: TrendingUp },
  { label: 'Ce que je ferais differemment si je recommencais', icon: Repeat2 },
]

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  create_recording_session: { label: 'Creation de la session', icon: '🎬' },
  set_editorial_line: { label: 'Definition de la ligne editoriale', icon: '📋' },
  generate_calendar: { label: 'Generation du calendrier', icon: '📅' },
  regenerate_calendar: { label: 'Regeneration du calendrier', icon: '🔄' },
  update_calendar_entry: { label: 'Modification du calendrier', icon: '✏️' },
  update_profile: { label: 'Mise a jour du profil', icon: '👤' },
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
      <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <span>Reflexion...</span>
    </div>
  )
}

function ToolCallingCard({ toolName, args, state }: { toolName: string; args?: Record<string, unknown>; state: string }) {
  const meta = TOOL_LABELS[toolName] ?? { label: toolName, icon: '⚙️' }
  const title = args?.title as string | undefined
  return (
    <div className="rounded-xl bg-primary/5 p-4 my-2 space-y-2 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <span className="text-base">{meta.icon}</span>
        <span className="text-sm font-medium text-foreground">{meta.label}</span>
        <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin ml-auto" />
      </div>
      {title && <p className="text-xs text-muted-foreground pl-7">{title}</p>}
      {state === 'call' && args && (
        <div className="pl-7 flex flex-wrap gap-1.5">
          {typeof args.format === 'string' && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{args.format.replace(/_/g, ' ')}</span>}
          {typeof args.platform === 'string' && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{args.platform}</span>}
          {Array.isArray(args.pillars) && (args.pillars as string[]).map((p, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p}</span>)}
        </div>
      )}
    </div>
  )
}

function ToolResultCard({ toolName, result }: { toolName: string; result: Record<string, unknown> }) {
  if (!result?.success) {
    return (
      <div className="rounded-lg bg-destructive/5 p-4 my-2">
        <p className="text-sm text-destructive">Erreur : {(result?.error as string) ?? 'Echec'}</p>
      </div>
    )
  }
  if (toolName === 'set_editorial_line') {
    const pillars = result.pillars as string[] | undefined
    return (
      <div className="rounded-xl bg-primary/5 p-4 my-2 space-y-3">
        <div className="flex items-center gap-2"><Sparkles size={16} className="text-primary" /><span className="text-sm font-medium text-foreground">Ligne editoriale definie</span></div>
        {pillars && pillars.length > 0 && <div className="flex flex-wrap gap-1.5">{pillars.map((p, i) => <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">{p}</span>)}</div>}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {result.tone ? <span>Ton : <span className="text-foreground">{String(result.tone)}</span></span> : null}
          {result.frequency != null ? <span>Frequence : <span className="text-foreground">{String(result.frequency)}/sem</span></span> : null}
        </div>
      </div>
    )
  }
  if (toolName === 'generate_calendar' || toolName === 'regenerate_calendar') {
    return (
      <div className="rounded-xl bg-primary/5 p-4 my-2 space-y-3">
        <div className="flex items-center gap-2"><CalendarDays size={16} className="text-primary" /><span className="text-sm font-medium text-foreground">{toolName === 'regenerate_calendar' ? 'Calendrier regenere' : 'Calendrier genere'}</span></div>
        {result.count != null && <p className="text-xs text-muted-foreground">{result.count as number} videos planifiees</p>}
        <a href="/calendar" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Voir le calendrier <ArrowRight size={12} /></a>
      </div>
    )
  }
  if (toolName === 'update_calendar_entry') {
    const entry = result.entry as Record<string, unknown> | undefined
    return (
      <div className="rounded-xl bg-primary/5 p-4 my-2 space-y-2">
        <div className="flex items-center gap-2"><Pencil size={16} className="text-primary" /><span className="text-sm font-medium text-foreground">Sujet modifie</span></div>
        {entry && <p className="text-sm text-foreground">{entry.topic as string}</p>}
      </div>
    )
  }
  if (toolName === 'update_profile') {
    return (<div className="rounded-xl bg-primary/5 p-4 my-2"><div className="flex items-center gap-2"><Sparkles size={16} className="text-primary" /><span className="text-sm font-medium text-foreground">Profil mis a jour</span></div></div>)
  }
  if (toolName === 'weekly_creative_review') {
    const payload = result.empty
      ? { empty: true as const, message: (result.message as string) ?? '' }
      : ({ ...(result as Record<string, unknown>), empty: false } as any)
    return <WeeklyReviewCard payload={payload} />
  }
  if (
    toolName === 'explore_weekly_moment' ||
    toolName === 'resurrect_seed_topic' ||
    toolName === 'propose_forgotten_domain' ||
    toolName === 'react_to_industry_news'
  ) {
    const mode =
      toolName === 'explore_weekly_moment'
        ? 'weekly_moment'
        : toolName === 'resurrect_seed_topic'
          ? 'resurrect_seed'
          : toolName === 'propose_forgotten_domain'
            ? 'forgotten_domain'
            : 'industry_news'
    return <UnstuckCard result={{ ...(result as Record<string, unknown>), mode } as any} />
  }
  if (toolName === 'propose_editorial_plan' && result.status === 'preview') {
    const proposals = (result.proposals as unknown[]) ?? []
    return (
      <EditorialPlanProposal
        narrativeArc={(result.narrativeArc as string) ?? ''}
        intentionCaptured={(result.intentionCaptured as string) ?? undefined}
        proposals={proposals as any}
      />
    )
  }
  if (toolName === 'commit_editorial_plan' && result.status === 'committed') {
    return (
      <div className="my-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-emerald-600" />
          <span className="text-sm font-medium">
            {(result.committed as number) ?? 0} sujets enregistrés — regarde-les dans ton calendrier.
          </span>
        </div>
        <a href="/calendar" className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline">
          Voir mon calendrier <ArrowRight size={10} />
        </a>
      </div>
    )
  }
  if (toolName === 'create_recording_session') {
    const shareLink = result.shareLink as string | undefined
    const format = result.format as string | undefined
    const questionsCount = result.questionsCount as number | undefined
    return (
      <div className="rounded-xl bg-primary/5 p-5 my-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center"><ArrowRight size={16} className="text-primary" /></div>
          <div><span className="text-sm font-medium text-foreground block">Session prete !</span><span className="text-xs text-muted-foreground">{format ? String(format).replace(/_/g, ' ') : ''} {questionsCount ? `· ${questionsCount} questions` : ''}</span></div>
        </div>
        <p className="text-sm text-foreground font-medium">{String(result.title ?? '')}</p>
        {shareLink && <a href={shareLink} className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors w-full justify-center">Lancer l&apos;enregistrement <ArrowRight size={14} /></a>}
      </div>
    )
  }
  return null
}

// ─── Main ChatPage ───────────────────────────────────────────────────────────

export function ChatPage() {
  const searchParams = useSearchParams()

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)

  const activeThreadIdRef = useRef(activeThreadId)
  activeThreadIdRef.current = activeThreadId

  const transport = useMemo(
    () => new DefaultChatTransport({ body: () => ({ threadId: activeThreadIdRef.current }) }),
    [],
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    id: activeThreadId ?? undefined,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })

  // Load messages for a thread
  const loadThread = useCallback(async (threadId: string) => {
    setThreadLoading(true)
    try {
      const res = await fetch(`/api/chat/history?threadId=${threadId}`, { credentials: 'include' })
      if (res.ok) {
        const msgs = await res.json()
        setMessages(msgs.map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          parts: [{ type: 'text' as const, text: m.content }],
        })))
      }
    } catch { /* */ }
    finally { setThreadLoading(false) }
  }, [setMessages])

  const newParam = searchParams.get('new')

  // On mount: si ?new=1 → thread vierge immédiat, sinon charge le dernier thread
  useEffect(() => {
    if (newParam === '1') {
      if (autoSendFired.current === 'new') return
      autoSendFired.current = 'new'
      setActiveThreadId(crypto.randomUUID())
      setMessages([])
      setHistoryLoaded(true)
      window.history.replaceState({}, '', '/chat')
      setTimeout(() => sendMessageRef.current({ text: 'Je veux créer un nouveau sujet.' }), 100)
      return
    }
    fetch('/api/chat/history', { credentials: 'include' })
      .then((res) => res.ok ? res.json() : [])
      .then(async (data: { threadId: string }[]) => {
        if (data.length > 0) {
          setActiveThreadId(data[0].threadId)
          await loadThread(data[0].threadId)
        }
        setHistoryLoaded(true)
      })
      .catch(() => setHistoryLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // New conversation
  const newConversation = useCallback(() => {
    setActiveThreadId(crypto.randomUUID())
    setMessages([])
  }, [setMessages])

  const [inputValue, setInputValue] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const isLoading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isLoading])

  useEffect(() => { inputRef.current?.focus() }, [activeThreadId])

  const showQuickActions = !isLoading && (messages.length === 0 || messages[messages.length - 1]?.role === 'assistant')

  const sendMessageRef = useRef(sendMessage)
  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  const handleSend = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    setInputValue('')
    sendMessageRef.current({ text: trimmed })
  }, [isLoading])

  // ── Audio recording ──
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (blob.size < 1000) return
        setTranscribing(true)
        try {
          const fd = new FormData(); fd.append('audio', blob)
          const res = await fetch('/api/chat/transcribe', { method: 'POST', body: fd })
          if (res.ok) { const { text } = await res.json(); if (text?.trim()) sendMessageRef.current({ text: text.trim() }) }
        } catch { /* */ } finally { setTranscribing(false) }
      }
      mediaRecorder.start()
      setRecording(true)
    } catch { /* mic denied */ }
  }, [])

  const stopRecording = useCallback(() => { mediaRecorderRef.current?.stop(); setRecording(false) }, [])

  // Auto-send from redirect (topics page → /chat?topic=...)
  const autoSendFired = useRef<string | null>(null)
  const topicParam = searchParams.get('topic')
  const actionParam = searchParams.get('action')
  useEffect(() => {
    if (!historyLoaded || !topicParam) return
    if (autoSendFired.current === topicParam) return
    autoSendFired.current = topicParam
    window.history.replaceState({}, '', '/chat')
    newConversation()

    let text: string
    if (actionParam === 'record') {
      const format = searchParams.get('format') ?? 'QUESTION_BOX'
      text = `Je veux enregistrer la video "${topicParam}" (format: ${format}). Cree directement la session d'enregistrement.`
    } else {
      text = `J'aimerais creer un contenu video sur ce sujet : "${topicParam}". Aide-moi a preparer les questions ou le script, puis on lance l'enregistrement.`
    }
    setTimeout(() => sendMessageRef.current({ text }), 100)
  }, [historyLoaded, topicParam, actionParam, newConversation, searchParams])

  const handleFormSubmit = (e: React.FormEvent) => { e.preventDefault(); handleSend(inputValue) }

  // Hide bottom nav on mobile
  useEffect(() => {
    const bottomNav = document.querySelector('[data-bottom-nav]')
    if (bottomNav) (bottomNav as HTMLElement).style.display = 'none'
    return () => { if (bottomNav) (bottomNav as HTMLElement).style.display = '' }
  }, [])

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="h-12 flex items-center px-3 shrink-0 md:hidden">
          <Link href="/topics" className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            <ChevronLeft size={20} />
          </Link>
          <span className="text-sm font-medium text-foreground ml-1">Kabou</span>
        </div>

        <div className="flex flex-col h-full max-w-[700px] mx-auto w-full">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-4 scrollbar-hide">
            {(threadLoading || (!historyLoaded && messages.length === 0)) && (
              <div className="space-y-4 py-4">
                <div className="flex justify-end"><div className="h-10 bg-primary/10 animate-pulse rounded-2xl rounded-br-md w-[60%]" /></div>
                <div className="flex justify-start"><div className="h-16 bg-muted animate-pulse rounded-2xl w-[75%]" /></div>
                <div className="flex justify-end"><div className="h-8 bg-primary/10 animate-pulse rounded-2xl rounded-br-md w-[45%]" /></div>
                <div className="flex justify-start"><div className="h-24 bg-muted animate-pulse rounded-2xl w-[70%]" /></div>
              </div>
            )}
            {messages.length === 0 && historyLoaded && !threadLoading && (
              <div className="flex flex-col items-center justify-center h-full px-4 py-8 gap-8">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/lavi-robot.png" alt="Kabou" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Kabou</h2>
                    <p className="text-sm text-muted-foreground mt-1">Sur quoi tu veux faire une video ?</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon
                    return (
                      <button
                        key={action.label}
                        onClick={() => handleSend(action.label)}
                        className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-surface border border-border text-left text-sm text-foreground/80 hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
                      >
                        <Icon size={14} className="text-primary shrink-0 mt-0.5" />
                        <span className="leading-snug">{action.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === 'user'
              return (
                <div key={message.id}>
                  {message.parts.map((part, idx) => {
                    if (part.type === 'text' && part.text) {
                      return (
                        <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start gap-2'}`}>
                          {!isUser && (
                            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mt-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="/lavi-robot.png" alt="Kabou" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser ? 'bg-primary text-primary-foreground rounded-br-md' : 'text-foreground/80'}`}>
                            {isUser ? <p className="whitespace-pre-wrap">{part.text}</p> : (
                              <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-foreground [&_a]:text-primary">
                                <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>, p: ({ children }) => { if (typeof children === 'string') { const parts = children.split(/(https?:\/\/[^\s]+)/g); if (parts.length > 1) return <p>{parts.map((p, i) => /^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{p}</a> : p)}</p>; } return <p>{children}</p> } }}>{part.text}</ReactMarkdown>
                              </div>
                            )}
                            {!isUser && (
                              <MakeSubjectButton text={part.text} sourceThreadId={activeThreadId} />
                            )}
                          </div>
                        </div>
                      )
                    }
                    if (part.type === 'tool-invocation') {
                      const toolPart = part as unknown as { toolInvocation: { toolName: string; state: string; args?: Record<string, unknown>; result?: Record<string, unknown> } }
                      const inv = toolPart.toolInvocation
                      if (inv.state === 'result' && inv.result) return <ToolResultCard key={idx} toolName={inv.toolName} result={inv.result} />
                      return <ToolCallingCard key={idx} toolName={inv.toolName} args={inv.args} state={inv.state} />
                    }
                    return null
                  })}
                </div>
              )
            })}

            {status === 'submitted' && (
              <div className="flex justify-start gap-2">
                <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/lavi-robot.png" alt="Kabou" className="w-full h-full object-cover" />
                </div>
                <TypingIndicator />
              </div>
            )}
          </div>

          {/* Quick actions + Input */}
          <div className="shrink-0 bg-background px-4 py-3 space-y-3">
            {showQuickActions && messages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon
                  return (
                    <button key={action.label} onClick={() => handleSend(action.label)} disabled={isLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all disabled:opacity-50">
                      <Icon size={12} />{action.label}
                    </button>
                  )
                })}
              </div>
            )}

            <form ref={formRef} onSubmit={handleFormSubmit} className="flex items-center gap-2">
              {transcribing ? (
                <div className="shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center"><Loader size={16} className="text-primary animate-spin" /></div>
              ) : recording ? (
                <button type="button" onClick={stopRecording} className="shrink-0 w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors animate-pulse"><Square size={14} /></button>
              ) : (
                <button type="button" onClick={startRecording} disabled={isLoading || transcribing} className="shrink-0 w-10 h-10 rounded-full bg-surface-raised text-muted-foreground flex items-center justify-center hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"><Mic size={16} /></button>
              )}
              <input ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                placeholder={recording ? 'Ecoute en cours...' : 'Ecris ton message...'} disabled={isLoading || recording || transcribing}
                className="flex-1 rounded-full bg-surface border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors disabled:opacity-50" />
              <button type="submit" disabled={isLoading || !inputValue.trim() || recording || transcribing}
                className="shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-30"><Send size={16} /></button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
