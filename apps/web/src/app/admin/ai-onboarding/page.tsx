'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Send, ChevronRight, Bot, User, Loader2, CheckCircle2 } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; content: string }

export default function AiOnboardingPage() {
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userCount = messages.filter((m) => m.role === 'user').length

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    setError(null)

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setStreaming(true)

    try {
      const res = await fetch('/api/admin/ai/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      // Read the text stream
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          assistantText += decoder.decode(value, { stream: true })
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: assistantText }
            return updated
          })
        }
      }

      // Auto-save after enough exchanges
      const newUserCount = newMessages.filter((m) => m.role === 'user').length
      if (newUserCount >= 6 && !saved) {
        await saveProfile([...newMessages, { role: 'assistant', content: assistantText }])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setMessages((prev) => prev.filter((m, i) => !(i === prev.length - 1 && m.content === '')))
    } finally {
      setStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  async function saveProfile(conv: Message[]) {
    setSaving(true)
    try {
      const userAnswers = conv.filter((m) => m.role === 'user').map((m) => m.content)
      const conversation = conv
        .map((m) => `${m.role === 'user' ? 'Entrepreneur' : 'Assistant'}: ${m.content}`)
        .join('\n\n')

      await fetch('/api/admin/ai/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessContext: {
            conversationSummary: conversation,
            answers: userAnswers,
          },
        }),
      })
      setSaved(true)
    } catch {
      // silently continue
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="shrink-0 mb-6">
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">
          <span>IA</span>
          <ChevronRight size={10} />
          <span className="text-foreground">Mon profil</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight uppercase">Configurer mon profil IA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Discutez naturellement — l&apos;IA adapte ses questions selon vos réponses.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-0.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-700"
              style={{ width: `${Math.min(100, (userCount / 6) * 100)}%` }}
            />
          </div>
          {saved ? (
            <span className="text-[10px] font-mono text-emerald-500 flex items-center gap-1 shrink-0">
              <CheckCircle2 size={10} /> Profil sauvegardé
            </span>
          ) : (
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
              {userCount}/6 réponses
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex gap-3">
            <div className="shrink-0 w-7 h-7 rounded-sm flex items-center justify-center border bg-primary/10 border-primary/20 text-primary">
              <Bot size={13} />
            </div>
            <div className="max-w-[80%] px-4 py-3 rounded-sm text-sm leading-relaxed border bg-surface/60 border-border/60 text-muted-foreground italic">
              Dites bonjour pour démarrer — l&apos;IA va vous poser des questions pour apprendre à vous connaître.
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`shrink-0 w-7 h-7 rounded-sm flex items-center justify-center border ${
              msg.role === 'assistant'
                ? 'bg-primary/10 border-primary/20 text-primary'
                : 'bg-surface-raised border-border text-foreground'
            }`}>
              {msg.role === 'assistant' ? <Bot size={13} /> : <User size={13} />}
            </div>
            <div className={`max-w-[80%] px-4 py-3 rounded-sm text-sm leading-relaxed border whitespace-pre-wrap ${
              msg.role === 'assistant'
                ? 'bg-surface/60 border-border/60 text-foreground'
                : 'bg-primary/10 border-primary/20 text-foreground'
            }`}>
              {msg.content}
              {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
                <span className="inline-block w-1.5 h-3.5 bg-primary/60 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className="border border-red-500/30 bg-red-500/5 rounded-sm p-3">
            <p className="text-xs font-mono text-red-400">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Manual save */}
      {userCount >= 5 && !saved && (
        <div className="shrink-0 pb-3">
          <button
            onClick={() => saveProfile(messages)}
            disabled={saving}
            className="w-full text-[10px] font-mono uppercase tracking-widest text-muted-foreground border border-border/60 rounded-sm py-2 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={10} className="animate-spin" /> Sauvegarde…</> : 'Sauvegarder le profil maintenant'}
          </button>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send() }}
        className="shrink-0 flex gap-2 pt-3 border-t border-border"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Votre réponse…"
          disabled={streaming}
          className="flex-1 bg-surface/40 border border-border rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/60 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {streaming ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </form>
    </div>
  )
}
