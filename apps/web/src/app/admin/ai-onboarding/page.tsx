'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Send, ChevronRight, Bot, User, Loader2, CheckCircle2, Linkedin, ArrowRight } from 'lucide-react'
import Link from 'next/link'

type Message = { role: 'user' | 'assistant'; content: string }
type LinkedinStep = 'idle' | 'loading' | 'done' | 'error'

const LINKEDIN_REGEX = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?$/

function isAskingLinkedin(msg: string) {
  return /linkedin/i.test(msg)
}

export default function AiOnboardingPage() {
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const linkedinInputRef = useRef<HTMLInputElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [linkedinStep, setLinkedinStep] = useState<LinkedinStep>('idle')
  const [linkedinError, setLinkedinError] = useState<string | null>(null)
  const [linkedinAnswered, setLinkedinAnswered] = useState(false)

  const userCount = messages.filter((m) => m.role === 'user').length
  const lastMsg = messages[messages.length - 1]
  const showLinkedinInput =
    !streaming &&
    !saved &&
    !linkedinAnswered &&
    lastMsg?.role === 'assistant' &&
    isAskingLinkedin(lastMsg.content)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  useEffect(() => {
    if (saved) {
      setTimeout(() => linkedinInputRef.current?.focus(), 300)
    }
  }, [saved])

  useEffect(() => {
    if (showLinkedinInput) {
      setTimeout(() => linkedinInputRef.current?.focus(), 100)
    }
  }, [showLinkedinInput])

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim()
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

      if (!res.ok) throw new Error(await res.text())

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
          businessContext: { conversationSummary: conversation, answers: userAnswers },
        }),
      })
      setSaved(true)
    } catch {
      // silently continue
    } finally {
      setSaving(false)
    }
  }

  async function submitLinkedinUrl() {
    const url = linkedinUrl.trim()
    if (!url) return

    if (!LINKEDIN_REGEX.test(url)) {
      setLinkedinError('URL invalide — format attendu : https://www.linkedin.com/in/votre-profil')
      return
    }

    setLinkedinError(null)
    setLinkedinAnswered(true)

    // Send URL as chat message
    send(url)

    // Trigger import in background
    setLinkedinStep('loading')
    try {
      const res = await fetch('/api/admin/ai/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinUrl: url }),
      })
      if (!res.ok) throw new Error(await res.text())
      setLinkedinStep('done')
    } catch {
      setLinkedinStep('error')
    }
  }

  function skipLinkedin() {
    setLinkedinAnswered(true)
    send('Je préfère ne pas partager mon LinkedIn pour l\'instant, merci.')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function handleLinkedinKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitLinkedinUrl()
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

        {/* LinkedIn import status badge */}
        {linkedinStep === 'loading' && (
          <div className="flex justify-center">
            <span className="flex items-center gap-2 text-[10px] font-mono text-[#0A66C2]/70 border border-[#0A66C2]/20 bg-[#0A66C2]/5 rounded-full px-3 py-1">
              <Loader2 size={10} className="animate-spin" /> Import LinkedIn en cours…
            </span>
          </div>
        )}
        {linkedinStep === 'done' && (
          <div className="flex justify-center">
            <span className="flex items-center gap-2 text-[10px] font-mono text-emerald-500 border border-emerald-500/20 bg-emerald-500/5 rounded-full px-3 py-1">
              <CheckCircle2 size={10} /> LinkedIn importé dans votre profil IA
            </span>
          </div>
        )}

        {error && (
          <div className="border border-red-500/30 bg-red-500/5 rounded-sm p-3">
            <p className="text-xs font-mono text-red-400">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* LinkedIn step — shown after profile is saved (post-conversation) */}
      {saved && linkedinStep !== 'done' && (
        <div className="shrink-0 mt-2 mb-3">
          <div className="border border-[#0A66C2]/30 bg-[#0A66C2]/5 rounded-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Linkedin size={14} className="text-[#0A66C2]" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#0A66C2]">
                Étape bonus — LinkedIn
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Entrez votre URL LinkedIn pour enrichir l&apos;IA avec votre profil, vos posts récents et votre entreprise.
            </p>
            <div className="flex gap-2">
              <input
                ref={linkedinInputRef}
                type="url"
                value={linkedinUrl}
                onChange={(e) => { setLinkedinUrl(e.target.value); setLinkedinError(null) }}
                onKeyDown={handleLinkedinKeyDown}
                placeholder="https://www.linkedin.com/in/votre-profil"
                disabled={linkedinStep === 'loading'}
                className="flex-1 bg-surface/40 border border-border rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#0A66C2]/60 transition-colors disabled:opacity-50"
              />
              <button
                onClick={submitLinkedinUrl}
                disabled={linkedinStep === 'loading' || !linkedinUrl.trim()}
                className="px-3 py-2 bg-[#0A66C2] text-white rounded-sm hover:bg-[#0A66C2]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 text-xs font-mono"
              >
                {linkedinStep === 'loading' ? <Loader2 size={13} className="animate-spin" /> : 'Importer'}
              </button>
            </div>
            {linkedinError && <p className="text-xs font-mono text-red-400">{linkedinError}</p>}
            <div className="flex items-center justify-end">
              <Link
                href="/admin/ai-profile"
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                Plus tard →
              </Link>
            </div>
          </div>
        </div>
      )}

      {saved && linkedinStep === 'done' && (
        <div className="shrink-0 mb-3 flex items-center justify-between border border-emerald-500/20 bg-emerald-500/5 rounded-sm px-4 py-3">
          <span className="text-sm text-emerald-400 flex items-center gap-2">
            <CheckCircle2 size={14} />
            Profil LinkedIn importé dans votre profil IA
          </span>
          <Link
            href="/admin/ai-profile"
            className="text-[10px] font-mono uppercase tracking-widest text-primary flex items-center gap-1 hover:underline"
          >
            Voir le profil <ArrowRight size={10} />
          </Link>
        </div>
      )}

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

      {/* Input — LinkedIn dedicated input or regular text input */}
      {!saved && (
        <div className="shrink-0 pt-3 border-t border-border">
          {showLinkedinInput ? (
            /* ── LinkedIn URL input dédié ── */
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Linkedin size={12} className="text-[#0A66C2]" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#0A66C2]">
                  URL LinkedIn
                </span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={linkedinInputRef}
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => { setLinkedinUrl(e.target.value); setLinkedinError(null) }}
                    onKeyDown={handleLinkedinKeyDown}
                    placeholder="https://www.linkedin.com/in/votre-profil"
                    className={`w-full bg-surface/40 border rounded-sm pl-3 pr-3 py-2 text-sm font-mono focus:outline-none transition-colors ${
                      linkedinError
                        ? 'border-red-500/50 focus:border-red-500/70'
                        : 'border-[#0A66C2]/30 focus:border-[#0A66C2]/60'
                    }`}
                  />
                </div>
                <button
                  onClick={submitLinkedinUrl}
                  disabled={!linkedinUrl.trim()}
                  className="px-4 py-2 bg-[#0A66C2] text-white rounded-sm hover:bg-[#0A66C2]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center gap-1.5 text-xs font-mono"
                >
                  <Linkedin size={12} />
                  Envoyer
                </button>
              </div>
              {linkedinError && (
                <p className="text-[11px] font-mono text-red-400">{linkedinError}</p>
              )}
              <button
                onClick={skipLinkedin}
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                Passer cette étape →
              </button>
            </div>
          ) : (
            /* ── Regular text input ── */
            <form
              onSubmit={(e) => { e.preventDefault(); send() }}
              className="flex gap-2"
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
          )}
        </div>
      )}
    </div>
  )
}
