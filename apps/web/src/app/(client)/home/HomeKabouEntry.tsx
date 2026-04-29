'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithToolCalls, DefaultChatTransport } from 'ai'
import { Loader2, Send, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { LinkedinProposalCard, type LinkedinProposal } from '@/components/chat/LinkedinProposalCard'

interface HomeKabouEntryProps {
  onClose?: () => void
}

const OPENING_QUESTION = "Qu'est-ce qui t'a le plus animé cette semaine — une conversation, une frustration, une victoire ?"

export function HomeKabouEntry({ onClose }: HomeKabouEntryProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [validating, setValidating] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        body: () => ({ context: 'opening' }),
      }),
    [],
  )

  const { messages, sendMessage, status } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })

  const isBusy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isBusy])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isBusy) return
    setInput('')
    sendMessage({ text })
  }, [input, isBusy, sendMessage])

  const handleValidate = useCallback(
    async (proposal: LinkedinProposal, recordingMode: 'coached' | 'pocket_script') => {
      setValidating(true)
      try {
        const brief = `${proposal.moodLabel} · ${proposal.formatLabel}`
        const createRes = await fetch('/api/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: proposal.sujet, brief }),
        })
        if (!createRes.ok) return
        const topic = await createRes.json()

        const linkedinContext = {
          mood: proposal.mood,
          moodLabel: proposal.moodLabel,
          format: proposal.format,
          formatLabel: proposal.formatLabel,
          formatDuration: proposal.formatDuration,
          recordingMode,
          coachingTip: proposal.coachingTip,
          coachingExample: proposal.coachingExample,
          pocketScriptBullets: proposal.pocketScriptBullets,
        }

        await fetch(`/api/topics/${topic.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ linkedinContext }),
        })

        router.push(`/sujets/${topic.id}`)
      } finally {
        setValidating(false)
      }
    },
    [router],
  )

  const handleOtherThing = useCallback(() => {
    sendMessage({ text: 'Autre chose' })
  }, [sendMessage])

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lavi-robot.png" alt="Kabou" className="h-8 w-8 rounded-full object-cover" />
          <span className="text-sm font-semibold text-foreground">Kabou</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {/* Static opening question */}
        <div className="rounded-2xl border border-border/50 bg-surface-raised/40 px-4 py-3">
          <p className="text-sm italic leading-relaxed text-foreground">{OPENING_QUESTION}</p>
        </div>

        {/* Messages */}
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'user' ? (
              <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {message.parts
                  .filter((p) => p.type === 'text')
                  .map((p, i) => <span key={i}>{(p as { type: 'text'; text: string }).text}</span>)}
              </div>
            ) : (
              <div className="max-w-[85%] space-y-2">
                {message.parts.map((part, idx) => {
                  if (part.type === 'text') {
                    const text = (part as { type: 'text'; text: string }).text
                    if (!text) return null
                    return (
                      <div key={idx} className="rounded-2xl bg-muted/40 px-4 py-2.5 text-sm leading-relaxed text-foreground">
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </div>
                    )
                  }
                  if (part.type === 'tool-invocation') {
                    const inv = (part as unknown as { toolInvocation: { toolName: string; state: string; result?: Record<string, unknown> } }).toolInvocation
                    if (inv.toolName === 'propose_linkedin_video' && inv.state === 'result' && inv.result) {
                      const proposal = inv.result as unknown as LinkedinProposal
                      return (
                        <LinkedinProposalCard
                          key={idx}
                          proposal={proposal}
                          onValidate={(mode) => handleValidate(proposal, mode)}
                          onOtherThing={handleOtherThing}
                        />
                      )
                    }
                    return null
                  }
                  return null
                })}
              </div>
            )}
          </div>
        ))}

        {isBusy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-muted/40 px-4 py-2.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Kabou réfléchit…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border/40 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
            }}
            placeholder="Réponds à Kabou…"
            rows={2}
            disabled={isBusy || validating}
            style={{ fontSize: 16 }}
            className="flex-1 resize-none rounded-2xl border border-border bg-surface-raised/40 px-4 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isBusy || validating}
            aria-label="Envoyer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {validating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
