'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithToolCalls, DefaultChatTransport } from 'ai'
import ReactMarkdown from 'react-markdown'
import { Loader2, MoreHorizontal, Paperclip, Mic, Send, Square } from 'lucide-react'
import { ChatLink, ChatParagraph } from '@/components/chat/ChatLink'
import { KabouContextCard } from '@/components/subject/kabou/KabouContextCard'
import { KabouSuggestedReplies } from '@/components/subject/kabou/KabouSuggestedReplies'
import type { CreativeState } from '@/lib/creative-state'
import type { NarrativeAnchor } from '@/lib/narrative-anchor'

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
  /** Contexte chargé affiché en tête du scroll. */
  contextBrief?: string | null
  contextPillarsCount?: number
  contextSourcesCount?: number
  contextSessionsSummary?: string | null
  /** Inputs pour les amorces de conversation contextuelles. */
  creativeState?: CreativeState
  narrativeAnchor?: NarrativeAnchor | null
  hasPendingSession?: boolean
  onTopicMutated?: (toolName?: string) => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
}

const MUTATING_TOOLS = new Set([
  'update_topic_brief',
  'mark_topic_ready',
  'commit_editorial_plan',
  'update_narrative_anchor',
  'reshape_to_recording_script',
  'update_recording_guide_draft',
  'reshape_recording_guide_to_format',
  'create_recording_session',
])

export function SubjectKabouPanel({
  topicId,
  threadId,
  subjectName,
  contextBrief,
  contextPillarsCount = 0,
  contextSourcesCount = 0,
  contextSessionsSummary,
  creativeState,
  narrativeAnchor,
  hasPendingSession = false,
  onTopicMutated,
  inputRef,
}: SubjectKabouPanelProps) {
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

  const handlePickSuggestion = useCallback(
    (text: string) => {
      if (isBusy) return
      sendMessage({ text } as any)
    },
    [isBusy, sendMessage],
  )

  // Enregistrement vocal — aligné sur le flux /chat : MediaRecorder webm/opus,
  // POST /api/chat/transcribe, le texte transcrit est envoyé direct dans le
  // thread. Best-effort : si le mic est refusé, silencieux.
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (blob.size < 1000) return
        setTranscribing(true)
        try {
          const fd = new FormData()
          fd.append('audio', blob)
          const res = await fetch('/api/chat/transcribe', { method: 'POST', body: fd })
          if (res.ok) {
            const { text } = (await res.json()) as { text?: string }
            if (text?.trim()) sendMessage({ text: text.trim() } as any)
          }
        } catch {
          /* silencieux */
        } finally {
          setTranscribing(false)
        }
      }
      mr.start()
      setRecording(true)
    } catch {
      /* mic refusé */
    }
  }, [sendMessage])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }, [])

  // Amorces visibles seulement quand l'user n'est pas déjà engagé dans un tour
  // (pas de message en cours de frappe et pas de stream en route) — sinon elles
  // distraient. Elles s'affichent en bas du scroll, juste avant le composer,
  // pour guider sans jamais masquer la conversation.
  const showSuggestions =
    !isBusy && input.trim().length === 0 && creativeState !== undefined

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative h-9 w-9 rounded-full overflow-hidden border border-primary/30 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lavi-robot.png" alt="Kabou" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold leading-tight">Kabou</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Sur ce sujet · écoute active
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground transition"
          aria-label="Options"
          title={subjectName}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Messages scroll */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <KabouContextCard
          angle={contextBrief ?? null}
          pillarsCount={contextPillarsCount}
          sourcesCount={contextSourcesCount}
          sessionsSummary={contextSessionsSummary ?? null}
        />

        {!hydrated && (
          <div className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Je relis nos échanges…
          </div>
        )}

        {hydrated && messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface-raised/30 px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
            On peut creuser ce sujet ensemble — raconte-moi pourquoi tu veux en parler et à qui ça s'adresse.
          </div>
        )}

        {(messages as unknown as ChatMessage[]).map((m) => {
          const text = m.parts.map((p) => ('text' in p ? p.text : '')).join('')
          if (m.role === 'user') {
            return (
              <div key={m.id} className="flex gap-2.5 justify-end">
                <div className="bubble-me rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-[13.5px] leading-relaxed max-w-[88%] whitespace-pre-wrap">
                  {text}
                </div>
              </div>
            )
          }
          return (
            <div key={m.id} className="flex gap-2.5">
              <div className="h-7 w-7 rounded-full overflow-hidden shrink-0 mt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/lavi-robot.png" alt="Kabou" className="w-full h-full object-cover" />
              </div>
              <div className="bubble-kabou rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[88%]">
                <div className="prose prose-sm dark:prose-invert max-w-none text-[13.5px] leading-relaxed prose-p:my-1 prose-a:no-underline">
                  <ReactMarkdown components={MARKDOWN_COMPONENTS}>{text}</ReactMarkdown>
                </div>
              </div>
            </div>
          )
        })}

        {isBusy && (
          <div className="flex gap-2.5 items-end">
            <div className="h-7 w-7 rounded-full overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lavi-robot.png" alt="Kabou" className="w-full h-full object-cover" />
            </div>
            <div className="bubble-kabou rounded-2xl rounded-tl-sm px-3.5 py-2.5">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}

        {showSuggestions && creativeState && (
          <KabouSuggestedReplies
            brief={contextBrief ?? null}
            narrativeAnchor={narrativeAnchor ?? null}
            creativeState={creativeState}
            hasPendingSession={hasPendingSession}
            onPick={handlePickSuggestion}
          />
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3 bg-background/40">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2">
          {transcribing ? (
            <div className="shrink-0 h-9 w-9 rounded-lg bg-surface-raised flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="shrink-0 h-9 w-9 rounded-lg bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition animate-pulse"
              aria-label="Arrêter l'enregistrement"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={isBusy}
              className="shrink-0 h-9 w-9 rounded-lg bg-surface-raised text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-40 flex items-center justify-center"
              aria-label="Dicter"
              title="Dicter"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
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
            placeholder={recording ? 'Écoute en cours…' : 'Parle-moi de ce sujet…'}
            disabled={recording || transcribing}
            className="flex-1 resize-none bg-transparent text-[14px] outline-none px-2 py-1.5 placeholder:text-muted-foreground/60 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isBusy || !input.trim() || recording || transcribing}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
            aria-label="Envoyer"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-2 px-1">
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition disabled:opacity-50"
            disabled
            title="Bientôt"
          >
            <Paperclip className="h-3 w-3" />
            Joindre
          </button>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground/70">
            ↵ pour envoyer
          </span>
        </div>
      </div>
    </div>
  )
}
