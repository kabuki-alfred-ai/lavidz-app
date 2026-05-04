'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithToolCalls, DefaultChatTransport } from 'ai'
import { CONTENT_FORMAT_MAP } from './constants'
import type { FlowPhase, InputMode, RecordState, KabouProposal } from './types'
import { ScreenHome } from './ScreenHome'
import { ScreenConversation } from './ScreenConversation'
import { ScreenProposal } from './ScreenProposal'
import { ScreenLater } from './ScreenLater'
import { ScreenRework } from './ScreenRework'
import { ScreenLauncher } from './ScreenLauncher'
import { HistoryDrawer } from './HistoryDrawer'
import type { RecordingScript } from '@/lib/recording-script'

export function HomeKabouEntry() {
  const router = useRouter()

  // Flow state
  const [flowPhase, setFlowPhase] = useState<FlowPhase>('home')
  const [proposal, setProposal] = useState<KabouProposal | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // Input state
  const [inputMode, setInputMode] = useState<InputMode>('voice')
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [transcript, setTranscript] = useState('')
  const [textInput, setTextInput] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const processedProposalId = useRef<string | null>(null)
  // Stores the topicId after first successful createTopicOnly — prevents duplicate topics on retry
  const savedTopicIdRef = useRef<string | null>(null)

  const flowPhaseRef = useRef(flowPhase)
  useEffect(() => { flowPhaseRef.current = flowPhase }, [flowPhase])

  // Persists across the clarifying phase so rework messages keep context: 'rework'
  const reworkModeRef = useRef(false)

  const transport = useMemo(
    () => new DefaultChatTransport({
      body: () => ({
        context: reworkModeRef.current ? 'rework' : 'opening',
      }),
    }),
    [],
  )

  const { messages, sendMessage, status } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })

  const isBusy = status === 'submitted' || status === 'streaming'

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isBusy])

  // Detect propose_kabou tool result — AI SDK v6: type='tool-propose_kabou', state='output-available', result in .output
  // processedProposalId prevents re-triggering on the same call when messages update (e.g. auto-send step 2),
  // which would reset flowPhase to 'proposal' even after the user clicked "Retravailler".
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue
      for (const part of (msg.parts ?? [])) {
        const p = part as any
        if (p.type === 'tool-propose_kabou' && p.state === 'output-available' && p.output) {
          const callId: string = p.toolCallId ?? ''
          if (callId && callId === processedProposalId.current) continue
          processedProposalId.current = callId || null
          reworkModeRef.current = false
          setProposal(p.output as KabouProposal)
          setFlowPhase('proposal')
          return
        }
      }
    }
  }, [messages])

  // Recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
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
          } else { setRecordState('idle') }
        } catch { setRecordState('idle') }
      }
      mr.start()
      setRecordState('recording')
    } catch { /* mic denied */ }
  }, [])

  const stopRecording = useCallback(() => { mediaRecorderRef.current?.stop() }, [])

  const doSend = useCallback((text: string) => {
    if (!text.trim() || isBusy) return
    if (flowPhase === 'home') setFlowPhase('clarifying')
    sendMessage({ text: text.trim() })
    setTranscript('')
    setTextInput('')
    setRecordState('idle')
    setInputMode('voice')
  }, [isBusy, sendMessage, flowPhase])

  // Create topic + session, and persist format + script + home threadId on the topic.
  // messages[0]?.id is the stable threadId the backend uses for the whole home conversation
  // (server does: activeThreadId = threadId || messages[0]?.id || randomUUID).
  // Writing it on the topic means SubjectKabouPanel will load the full home thread history.
  // Creates topic + script only — no session yet
  const createTopicOnly = useCallback(async (p: KabouProposal) => {
    const contentFormat = CONTENT_FORMAT_MAP[p.formatKind] ?? p.contentFormat
    const scriptBullets = p.beats.map((b, i) => `${p.beatLabels[i] ?? `Beat ${i + 1}`} — ${b}`)
    const homeThreadId = messages[0]?.id

    const createRes = await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: p.sujet, brief: p.sujet }),
    })
    if (!createRes.ok) {
      console.error('[createTopicOnly] POST /api/topics', createRes.status, await createRes.text().catch(() => ''))
      return null
    }
    const topic = await createRes.json()

    await fetch(`/api/topics/${topic.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        format: contentFormat,
        script: { scriptType: 'bullets', bullets: scriptBullets },
        status: 'READY',
        ...(homeThreadId ? { threadId: homeThreadId } : {}),
      }),
    })

    return { topicId: topic.id, contentFormat, scriptBullets }
  }, [messages])

  const handleAccept = useCallback(async () => {
    if (!proposal) return
    setSaving(true)
    setSaveError(null)
    try {
      const topicResult = await createTopicOnly(proposal)
      if (!topicResult) {
        setSaveError('Impossible de créer le sujet — réessaie.')
        return
      }
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          topicId: topicResult.topicId,
          format: topicResult.contentFormat,
          title: proposal.sujet,
          questions: topicResult.contentFormat !== 'TELEPROMPTER'
            ? topicResult.scriptBullets.map((b) => ({ text: b, hint: null }))
            : undefined,
        }),
      })
      if (!sessionRes.ok) {
        const errText = await sessionRes.text().catch(() => '')
        console.error('[handleAccept] /api/sessions', sessionRes.status, errText)
        setSaveError('Impossible de créer la session — réessaie.')
        return
      }
      const session = await sessionRes.json()
      router.push(`/s/${session.id}`)
    } catch (e) {
      console.error('[handleAccept]', e)
      setSaveError('Une erreur est survenue — réessaie.')
    } finally {
      setSaving(false)
    }
  }, [proposal, createTopicOnly, router])

  const handleLater = useCallback(async () => {
    if (!proposal) return
    setSaving(true)
    setSaveError(null)
    try {
      const topicResult = await createTopicOnly(proposal)
      if (!topicResult) {
        setSaveError('Impossible de créer le sujet — réessaie.')
        return
      }
      setFlowPhase('later')
    } catch (e) {
      console.error('[handleLater]', e)
      setSaveError('Une erreur est survenue — réessaie.')
    } finally {
      setSaving(false)
    }
  }, [proposal, createTopicOnly])

  const handleRework = useCallback(() => {
    reworkModeRef.current = true
    setFlowPhase('rework')
  }, [])

  const handleReworkChip = useCallback((text: string) => {
    // Keep reworkModeRef.current = true — transport will use 'rework' context
    setFlowPhase('clarifying')
    sendMessage({ text })
  }, [sendMessage])

  const handleDeepen = useCallback(() => {
    setSaveError(null)
    savedTopicIdRef.current = null
    setFlowPhase('launcher')
  }, [])

  const handleLauncherFilmer = useCallback(async (script: RecordingScript, chosenFormat: import('@lavidz/types').ContentFormat) => {
    if (!proposal) return
    setSaving(true)
    setSaveError(null)
    try {
      // Reuse existing topicId on retry to avoid duplicate topics
      let topicId = savedTopicIdRef.current
      let scriptBullets: string[]
      if (!topicId) {
        const topicResult = await createTopicOnly(proposal)
        if (!topicResult) {
          setSaveError('Impossible de créer le sujet — réessaie.')
          return
        }
        topicId = topicResult.topicId
        savedTopicIdRef.current = topicId
        scriptBullets = topicResult.scriptBullets
      } else {
        scriptBullets = proposal.beats.map((b, i) => `${proposal.beatLabels[i] ?? `Beat ${i + 1}`} — ${b}`)
      }
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          topicId,
          format: chosenFormat,
          title: proposal.sujet,
          recordingScript: script,
          questions: chosenFormat !== 'TELEPROMPTER'
            ? scriptBullets.map((b) => ({ text: b, hint: null }))
            : undefined,
        }),
      })
      if (!sessionRes.ok) {
        const errText = await sessionRes.text().catch(() => '')
        console.error('[handleLauncherFilmer] /api/sessions', sessionRes.status, errText)
        setSaveError('Impossible de créer la session — réessaie.')
        return
      }
      const session = await sessionRes.json()
      router.push(`/s/${session.id}`)
    } catch (e) {
      console.error('[handleLauncherFilmer]', e)
      setSaveError('Une erreur est survenue — réessaie.')
    } finally {
      setSaving(false)
    }
  }, [proposal, createTopicOnly, router])

  // ── Render ─────────────────────────────────────────────────────────────────

  const historyDrawer = <HistoryDrawer open={showHistory} onClose={() => setShowHistory(false)} />

  if (flowPhase === 'home') {
    return (
      <>
        <ScreenHome
          onTalk={() => { setFlowPhase('clarifying'); setInputMode('voice'); startRecording() }}
          onWrite={() => { setFlowPhase('clarifying'); setInputMode('text') }}
          onShowHistory={() => setShowHistory(true)}
        />
        {historyDrawer}
      </>
    )
  }

  if (flowPhase === 'proposal' && proposal) {
    return (
      <>
        <ScreenProposal
          proposal={proposal}
          saving={saving}
          error={saveError}
          onAccept={handleAccept}
          onLater={handleLater}
          onRework={handleRework}
          onDeepen={handleDeepen}
        />
        {historyDrawer}
      </>
    )
  }

  if (flowPhase === 'launcher' && proposal) {
    return (
      <>
        <ScreenLauncher
          proposal={proposal}
          saving={saving}
          error={saveError}
          onFilmer={handleLauncherFilmer}
          onBack={() => setFlowPhase('proposal')}
        />
        {historyDrawer}
      </>
    )
  }

  if (flowPhase === 'later' && proposal) {
    return (
      <>
        <ScreenLater
          proposal={proposal}
          onGoToSujets={() => router.push('/sujets')}
          onBrainstorm={() => { setFlowPhase('clarifying'); setProposal(null) }}
          onGoToUnivers={() => router.push('/mon-univers')}
        />
        {historyDrawer}
      </>
    )
  }

  if (flowPhase === 'rework') {
    return (
      <>
        <ScreenRework
          isBusy={isBusy}
          onChip={handleReworkChip}
          onBack={() => setFlowPhase('proposal')}
        />
        {historyDrawer}
      </>
    )
  }

  // clarifying
  return (
    <>
      <ScreenConversation
        messages={messages}
        isBusy={isBusy}
        inputMode={inputMode}
        recordState={recordState}
        transcript={transcript}
        textInput={textInput}
        textareaRef={textareaRef}
        scrollRef={scrollRef}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onDoSend={doSend}
        onResetTranscript={() => { setTranscript(''); setRecordState('idle') }}
        onSetInputMode={setInputMode}
        onSetTextInput={setTextInput}
        onShowHistory={() => setShowHistory(true)}
      />
      {historyDrawer}
    </>
  )
}
