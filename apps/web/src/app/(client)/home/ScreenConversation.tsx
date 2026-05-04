'use client'

import { Loader2, PenLine, Send, Square, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { T, FULL_H, TOP_SAFE } from './constants'
import { KabouAvatar, MicSVG } from './KabouAvatar'
import type { InputMode, RecordState } from './types'

export function ScreenConversation({
  messages, isBusy,
  inputMode, recordState, transcript, textInput,
  textareaRef, scrollRef,
  onStartRecording, onStopRecording, onDoSend, onResetTranscript,
  onSetInputMode, onSetTextInput, onShowHistory,
}: {
  messages: any[]
  isBusy: boolean
  inputMode: InputMode
  recordState: RecordState
  transcript: string
  textInput: string
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  scrollRef: React.RefObject<HTMLDivElement | null>
  onStartRecording: () => void
  onStopRecording: () => void
  onDoSend: (t: string) => void
  onResetTranscript: () => void
  onSetInputMode: (m: InputMode) => void
  onSetTextInput: (v: string) => void
  onShowHistory: () => void
}) {
  return (
    <div style={{ background: T.bg, height: FULL_H, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
      {/* Header — fixed at top */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        paddingTop: TOP_SAFE, paddingLeft: 18, paddingRight: 18, paddingBottom: 14,
        borderBottom: `1px solid ${T.border}`,
      }}>
        <KabouAvatar size={32} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Kabou</div>
          <div style={{ fontSize: 11, color: isBusy ? T.primary : T.good, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isBusy ? T.primary : T.good, display: 'inline-block' }} />
            {isBusy ? 'réfléchit…' : 'à l\'écoute'}
          </div>
        </div>
        <button
          type="button"
          onClick={onShowHistory}
          style={{
            background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 14,
            width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: T.muted, flexShrink: 0,
          }}
          title="Historique des conversations"
        >
          <Clock size={20} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'user' ? (
              <div style={{
                maxWidth: '82%', background: T.primary, color: '#fff',
                padding: '12px 16px', borderRadius: '20px 20px 4px 20px',
                fontSize: 14, lineHeight: 1.5, fontWeight: 500,
              }}>
                {msg.parts?.filter((p: any) => p.type === 'text').map((p: any, i: number) => (
                  <span key={i}>{p.text}</span>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, maxWidth: '88%' }}>
                <KabouAvatar size={26} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {msg.parts?.map((part: any, idx: number) => {
                    if (part.type === 'text' && part.text) {
                      return (
                        <div key={idx} style={{
                          background: T.surface, padding: '12px 16px',
                          borderRadius: '20px 20px 20px 4px',
                          fontSize: 14, lineHeight: 1.5, color: T.ink,
                          fontWeight: 500,
                        }}>
                          <ReactMarkdown>{part.text}</ReactMarkdown>
                        </div>
                      )
                    }
                    return null
                  })}
                </div>
              </div>
            )}
          </div>
        ))}

        {isBusy && (
          <div style={{ display: 'flex', gap: 8 }}>
            <KabouAvatar size={26} />
            <div style={{
              background: T.surface, borderRadius: '20px 20px 20px 4px',
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: T.muted,
                  animation: `dot 1.2s ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Fallback: après 5 messages user sans proposition, proposer de générer */}
        {!isBusy && messages.filter(m => m.role === 'user').length >= 5 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <button
              type="button"
              onClick={() => onDoSend('go')}
              style={{
                background: 'none', border: `1px solid ${T.primary}40`, borderRadius: 999,
                padding: '6px 14px', fontSize: 12, color: T.primary, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              ✨ Générer la proposition
            </button>
          </div>
        )}
      </div>

      {/* Input bar — fixed at bottom */}
      <div style={{ flexShrink: 0, padding: '10px 18px 28px', borderTop: `1px solid ${T.border}` }}>
        {recordState === 'recording' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              flex: 1, background: T.surface, borderRadius: 22, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              border: `1px solid ${T.primary}40`,
              boxShadow: `0 0 0 4px ${T.primary}10`,
            }}>
              <button
                type="button"
                onClick={onStopRecording}
                style={{
                  width: 48, height: 48, borderRadius: '50%', background: '#EF4444',
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Square size={14} fill="white" color="white" />
              </button>
              <span style={{ fontSize: 13, color: T.primary, fontWeight: 600 }}>En écoute…</span>
            </div>
          </div>
        ) : recordState === 'transcribing' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0' }}>
            <Loader2 size={16} className="animate-spin" style={{ color: T.primary }} />
            <span style={{ fontSize: 13, color: T.muted }}>Transcription…</span>
          </div>
        ) : recordState === 'done' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              background: T.surface, borderRadius: 16, padding: '12px 14px',
              fontSize: 14, color: T.ink, lineHeight: 1.5,
            }}>
              {transcript}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => onDoSend(transcript)}
                disabled={isBusy}
                style={{
                  flex: 1, background: T.primary, color: '#fff', border: 'none',
                  borderRadius: 14, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: isBusy ? 0.5 : 1,
                }}
              >
                <Send size={14} /> Envoyer
              </button>
              <button
                type="button"
                onClick={onResetTranscript}
                style={{
                  background: 'rgba(0,0,0,0.05)', border: 'none',
                  borderRadius: 14, padding: '13px 16px', fontSize: 13, color: T.muted, cursor: 'pointer',
                }}
              >
                ↺
              </button>
            </div>
          </div>
        ) : inputMode === 'text' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, background: T.surface, borderRadius: 16, padding: '10px 14px' }}>
                <textarea
                  ref={textareaRef}
                  value={textInput}
                  onChange={(e) => onSetTextInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onDoSend(textInput) }}
                  placeholder="Réponds à Kabou…"
                  rows={3}
                  disabled={isBusy}
                  style={{
                    width: '100%', border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 15, color: T.ink, lineHeight: 1.5, resize: 'none',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => onDoSend(textInput)}
                disabled={!textInput.trim() || isBusy}
                style={{
                  width: 52, height: 52, borderRadius: '50%', background: T.primary,
                  border: 'none', cursor: 'pointer', alignSelf: 'flex-end',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: !textInput.trim() || isBusy ? 0.4 : 1,
                }}
              >
                <Send size={16} color="#fff" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => onSetInputMode('voice')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 12, color: T.muted, padding: '4px 0',
              }}
            >
              <MicSVG size={12} color={T.muted} /> Parler à la place
            </button>
          </div>
        ) : (
          /* Voice mode idle */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={onStartRecording}
              disabled={isBusy}
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: isBusy ? T.border : T.primary, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isBusy ? 'none' : `0 0 0 10px ${T.primary}18, 0 10px 28px ${T.primary}40`,
                transition: 'all 0.2s',
              }}
            >
              <MicSVG size={24} color={isBusy ? T.muted : '#fff'} />
            </button>
            <button
              type="button"
              onClick={() => onSetInputMode('text')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 8px',
              }}
            >
              <PenLine size={12} color={T.muted} /> Préférer écrire
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
