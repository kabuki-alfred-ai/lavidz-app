'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithToolCalls, DefaultChatTransport } from 'ai'
import ReactMarkdown from 'react-markdown'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { ChatLink, ChatParagraph } from '@/components/chat/ChatLink'

const MARKDOWN_COMPONENTS = { a: ChatLink, p: ChatParagraph } as const

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  parts: Array<{ type: 'text'; text: string }>
}

interface SubjectKabouPanelProps {
  topicId: string
  threadId: string
  subjectName: string
  onTopicMutated?: (toolName?: string) => void
  /** Ref exposé au parent pour lui permettre de focus le champ de saisie
   *  (ex: bouton "Explorer avec Kabou" sur desktop). */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
}

// Tools qui, une fois complétés, changent des données affichées dans
// SubjectWorkspace (status, brief, calendrier). Détectés dans les messages
// pour déclencher un refetch automatique côté parent.
const MUTATING_TOOLS = new Set([
  'update_topic_brief',
  'mark_topic_ready',
  'commit_editorial_plan',
  // Nouveaux noms (Task 2.4) + legacy aliases — tant que le dual-write tourne,
  // les 4 clés coexistent et doivent toutes déclencher un refetch du Topic.
  'update_narrative_anchor',
  'reshape_to_recording_script',
  'update_recording_guide_draft',
  'reshape_recording_guide_to_format',
  // Quand Kabou crée une session depuis le chat, la page Sujet doit re-fetcher
  // pour afficher la carte format correspondante + halo sur la session
  // fraîchement PENDING. Sans ça, la workspace reste aveugle au travail de Kabou.
  'create_recording_session',
])

/**
 * Inline Kabou panel — rendered to the right of the SubjectWorkspace on
 * desktop, as a tab on mobile. Wraps useChat against the topic's dedicated
 * thread so the conversation persists between visits.
 */
export function SubjectKabouPanel({ topicId, threadId, subjectName, onTopicMutated, inputRef }: SubjectKabouPanelProps) {
  const threadIdRef = useRef(threadId)
  threadIdRef.current = threadId

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        body: () => ({ threadId: threadIdRef.current, topicId }),
      }),
    [topicId],
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    id: threadId,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })

  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/chat/history?threadId=${threadId}`, { credentials: 'include' })
      .then(async (res) => {
        if (cancelled) return
        if (res.ok) {
          const msgs = (await res.json()) as Array<{ id: string; role: string; content: string }>
          if (msgs.length > 0) {
            setMessages(
              msgs.map((m) => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                parts: [{ type: 'text' as const, text: m.content }],
              })),
            )
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [threadId, setMessages])

  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const isBusy = status === 'submitted' || status === 'streaming'

  const processedToolCallIds = useRef<Set<string>>(new Set())
  const onTopicMutatedRef = useRef(onTopicMutated)
  onTopicMutatedRef.current = onTopicMutated

  useEffect(() => {
    for (const m of messages as unknown as Array<{ id: string; role: string; parts?: Array<Record<string, unknown>> }>) {
      if (m.role !== 'assistant') continue
      for (const part of m.parts ?? []) {
        const type = part.type
        if (typeof type !== 'string' || !type.startsWith('tool-')) continue
        const toolName = type.slice('tool-'.length)
        if (!MUTATING_TOOLS.has(toolName)) continue
        if (part.state !== 'output-available') continue
        const callId = (part.toolCallId as string | undefined) ?? `${m.id}:${toolName}`
        if (processedToolCallIds.current.has(callId)) continue
        processedToolCallIds.current.add(callId)
        const output = part.output as { success?: boolean } | undefined
        if (output && output.success === false) continue
        onTopicMutatedRef.current?.(toolName)
      }
    }
  }, [messages])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isBusy])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isBusy) return
    sendMessage({ text } as any)
    setInput('')
  }, [input, isBusy, sendMessage])

  const renderMessage = (m: ChatMessage) => {
    const text = m.parts.map((p) => ('text' in p ? p.text : '')).join('')
    return (
      <div
        key={m.id}
        className={
          m.role === 'user'
            ? 'ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2 text-sm text-primary-foreground'
            : 'mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-surface-raised/40 px-4 py-2 text-sm leading-relaxed'
        }
      >
        {m.role === 'assistant' ? (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-a:no-underline">
            <ReactMarkdown components={MARKDOWN_COMPONENTS}>{text}</ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{text}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/50 bg-card">
      <header className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">Kabou sur ce sujet</p>
          <p className="text-xs text-muted-foreground truncate">{subjectName}</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!hydrated && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Je relis nos échanges…
          </div>
        )}
        {hydrated && messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 bg-surface-raised/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            On peut creuser ce sujet ensemble — raconte-moi pourquoi tu veux en parler et à qui ça s'adresse.
          </div>
        )}
        {(messages as unknown as ChatMessage[]).map(renderMessage)}
        {isBusy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Je réfléchis…
          </div>
        )}
      </div>

      <div className="border-t border-border/40 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            rows={1}
            placeholder="Parle-moi de ce sujet…"
            className="flex-1 resize-none rounded-xl border border-border/40 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isBusy || !input.trim()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
            aria-label="Envoyer"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
