'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithToolCalls, DefaultChatTransport } from 'ai'
import { Loader2, Mic, PenLine, RefreshCw, Send, Square, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { LinkedinProposalCard, type LinkedinProposal } from '@/components/chat/LinkedinProposalCard'

interface HomeKabouEntryProps {
  onClose?: () => void
}

type RecordState = 'idle' | 'recording' | 'transcribing' | 'done'
type InputMode = 'voice' | 'text'

const OPENING_QUESTION = "Qu'est-ce qui t'a le plus animé cette semaine — une conversation, une frustration, une victoire ?"

export function HomeKabouEntry({ onClose }: HomeKabouEntryProps) {
  const router = useRouter()
  const [validating, setValidating] = useState(false)
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [inputMode, setInputMode] = useState<InputMode>('voice')
  const [transcript, setTranscript] = useState('')
  const [textInput, setTextInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const transport = useMemo(
    () => new DefaultChatTransport({ body: () => ({ context: 'opening' }) }),
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

  // Auto-focus textarea quand on bascule en mode texte
  useEffect(() => {
    if (inputMode === 'text' && recordState === 'idle') {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [inputMode, recordState])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/mp4'
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        if (blob.size < 1000) { setRecordState('idle'); return }
        setRecordState('transcribing')
        try {
          const fd = new FormData()
          fd.append('audio', blob)
          const res = await fetch('/api/chat/transcribe', { method: 'POST', body: fd })
          if (res.ok) {
            const { text } = await res.json()
            setTranscript(text?.trim() ?? '')
            setRecordState(text?.trim() ? 'done' : 'idle')
          } else {
            setRecordState('idle')
          }
        } catch {
          setRecordState('idle')
        }
      }
      mediaRecorder.start()
      setRecordState('recording')
    } catch { /* micro refusé — user peut basculer en texte */ }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
  }, [])

  const handleSendTranscript = useCallback(() => {
    if (!transcript.trim() || isBusy) return
    sendMessage({ text: transcript.trim() })
    setTranscript('')
    setRecordState('idle')
    setInputMode('voice')
  }, [transcript, isBusy, sendMessage])

  const handleSendText = useCallback(() => {
    const val = textInput.trim()
    if (!val || isBusy) return
    sendMessage({ text: val })
    setTextInput('')
    setRecordState('idle')
    setInputMode('voice')
  }, [textInput, isBusy, sendMessage])

  const redo = useCallback(() => {
    setTranscript('')
    setRecordState('idle')
  }, [])

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

        await fetch(`/api/topics/${topic.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            linkedinContext: {
              mood: proposal.mood,
              moodLabel: proposal.moodLabel,
              format: proposal.format,
              formatLabel: proposal.formatLabel,
              formatDuration: proposal.formatDuration,
              recordingMode,
              coachingTip: proposal.coachingTip,
              coachingExample: proposal.coachingExample,
              pocketScriptBullets: proposal.pocketScriptBullets,
            },
          }),
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
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        <div className="rounded-2xl border border-border/50 bg-surface-raised/40 px-4 py-3">
          <p className="text-sm italic leading-relaxed text-foreground">{OPENING_QUESTION}</p>
        </div>

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

      {/* Zone de réponse */}
      <div className="shrink-0 border-t border-border/40 px-4 pt-4 pb-5">

        {/* Mode voix — idle : gros bouton micro */}
        {inputMode === 'voice' && recordState === 'idle' && (
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={startRecording}
              disabled={isBusy || validating}
              aria-label="Commencer l'enregistrement"
              className="group relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary transition-all hover:scale-105 hover:bg-primary/20 active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Mic size={32} className="transition-transform group-hover:scale-110" />
            </button>
            <p className="text-xs text-muted-foreground">Appuie pour parler</p>
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <PenLine size={13} /> Préférer écrire
            </button>
          </div>
        )}

        {/* Mode voix — enregistrement */}
        {recordState === 'recording' && (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={stopRecording}
              aria-label="Arrêter l'enregistrement"
              className="relative flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white transition-all hover:bg-red-600 active:scale-95"
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-30" />
              <Square size={24} fill="white" />
            </button>
            <p className="animate-pulse text-xs text-muted-foreground">En écoute…</p>
          </div>
        )}

        {/* Mode voix — transcription */}
        {recordState === 'transcribing' && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Transcription…</p>
          </div>
        )}

        {/* Mode voix — transcrit, prêt à envoyer */}
        {recordState === 'done' && (
          <div className="flex flex-col gap-3">
            <p className="rounded-2xl border border-border/50 bg-surface-raised/40 px-4 py-3 text-sm leading-relaxed text-foreground">
              {transcript}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSendTranscript}
                disabled={isBusy || validating}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              >
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer
              </button>
              <button
                type="button"
                onClick={redo}
                className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted/40"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Recommencer
              </button>
            </div>
          </div>
        )}

        {/* Mode texte */}
        {inputMode === 'text' && recordState === 'idle' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendText()
                }}
                placeholder="Réponds à Kabou…"
                rows={3}
                disabled={isBusy || validating}
                style={{ fontSize: 16 }}
                className="flex-1 resize-none rounded-2xl border border-border bg-surface-raised/40 px-4 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSendText}
                disabled={!textInput.trim() || isBusy || validating}
                aria-label="Envoyer"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setInputMode('voice')}
              className="flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <Mic size={13} /> Parler à la place
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
