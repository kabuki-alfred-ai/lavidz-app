'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithToolCalls, DefaultChatTransport } from 'ai'
import { Loader2, Mic, PenLine, Send, Square, Clock, X, MessageSquare } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

// ─── Types ───────────────────────────────────────────────────────────────────

type ContentFormat = 'QUESTION_BOX' | 'TELEPROMPTER' | 'HOT_TAKE' | 'STORYTELLING' | 'DAILY_TIP' | 'MYTH_VS_REALITY'
type FormatKind = 'histoire' | 'reaction' | 'interview' | 'conseil' | 'mythe' | 'guide'
type FlowPhase = 'home' | 'clarifying' | 'proposal' | 'later' | 'rework'
type RecordState = 'idle' | 'recording' | 'transcribing' | 'done'
type InputMode = 'voice' | 'text'

interface KabouProposal {
  sujet: string
  mood: 'challenger' | 'authentique' | 'expert'
  moodLabel: string
  contentFormat: ContentFormat
  formatKind: FormatKind
  duration: string
  beatLabels: string[]
  beats: string[]
  coachingTip: string
}

// ─── Mobile-safe full-screen height ──────────────────────────────────────────
// Can't use h-full inside overflow-y-auto — use dvh minus nav + safe area.
const FULL_H = 'calc(100dvh - var(--nav-height, 64px) - env(safe-area-inset-bottom, 0px))'
// Top padding: clears status bar + Dynamic Island + breathing room
const TOP_SAFE = 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))'

// ─── Design tokens (from mockup) ─────────────────────────────────────────────

const T = {
  bg:       '#FAFAF7',
  surface:  '#FFFFFF',
  ink:      '#0A0A0A',
  muted:    '#737373',
  primary:  '#FF6B2E',
  border:   'rgba(0,0,0,0.08)',
  good:     '#22c55e',
  warn:     '#F59E0B',
}

const FORMAT_META: Record<FormatKind, { label: string; emoji: string; bg: string; color: string }> = {
  histoire:  { label: 'Histoire',         emoji: '📖', bg: '#FEF3C7', color: '#92400E' },
  reaction:  { label: 'Réaction',         emoji: '🔥', bg: '#FEF2F2', color: '#DC2626' },
  interview: { label: 'Interview',        emoji: '❓', bg: '#EDE9FE', color: '#6D28D9' },
  conseil:   { label: 'Conseil',          emoji: '💡', bg: '#DCFCE7', color: '#15803D' },
  mythe:     { label: 'Mythe vs Réalité', emoji: '🪞', bg: '#DBEAFE', color: '#1E40AF' },
  guide:     { label: 'Guide',            emoji: '📜', bg: '#FCE7F3', color: '#9D174D' },
}

const CONTENT_FORMAT_MAP: Record<FormatKind, ContentFormat> = {
  histoire:  'STORYTELLING',
  reaction:  'HOT_TAKE',
  interview: 'QUESTION_BOX',
  conseil:   'DAILY_TIP',
  mythe:     'MYTH_VS_REALITY',
  guide:     'TELEPROMPTER',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KabouAvatar({ size = 32, ring = false }: { size?: number; ring?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      background: T.surface, flexShrink: 0,
      boxShadow: ring ? `0 0 0 4px ${T.primary}25` : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lavi-robot.png" alt="Kabou" style={{ width: '78%', height: '78%', objectFit: 'contain' }} />
    </div>
  )
}

function MicSVG({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 18 20" fill="none">
      <rect x="6" y="2" width="6" height="11" rx="3" fill={color} />
      <path d="M2 11a7 7 0 0014 0M9 18v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function FormatBadge({ kind, size = 'sm' }: { kind: FormatKind; size?: 'sm' | 'md' }) {
  const meta = FORMAT_META[kind]
  const padding = size === 'md' ? '6px 12px' : '4px 9px'
  const fs = size === 'md' ? 13 : 11
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding, borderRadius: 999, background: meta.bg, color: meta.color,
      fontSize: fs, fontWeight: 600, letterSpacing: 0.1,
    }}>
      <span>{meta.emoji}</span>{meta.label}
    </span>
  )
}

// ─── Screen: Home (big mic button) ───────────────────────────────────────────

function ScreenHome({ onTalk, onWrite, onShowHistory }: { onTalk: () => void; onWrite: () => void; onShowHistory: () => void }) {
  return (
    <div style={{ background: T.bg, minHeight: FULL_H, display: 'flex', flexDirection: 'column', paddingTop: TOP_SAFE, paddingLeft: 22, paddingRight: 22, paddingBottom: 28, boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <KabouAvatar size={44} ring />
        <div style={{ paddingTop: 6, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>Kabou</div>
          <div style={{ fontSize: 11, color: T.good, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.good, display: 'inline-block' }} />
            à l'écoute
          </div>
        </div>
        <button
          type="button"
          onClick={onShowHistory}
          style={{
            background: 'rgba(0,0,0,0.05)', borderRadius: 14,
            width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: T.muted, flexShrink: 0, border: 'none',
          }}
          title="Historique des conversations"
        >
          <Clock size={20} />
        </button>
      </div>

      <h1 style={{
        fontSize: 30, fontWeight: 700, color: T.ink,
        lineHeight: 1.15, margin: '20px 0 0', letterSpacing: -0.6,
      }}>
        Sur quoi tu veux<br />
        <span style={{ color: T.muted, fontWeight: 400 }}>tourner </span>
        aujourd'hui&nbsp;?
      </h1>
      <p style={{ fontSize: 14, color: T.muted, marginTop: 14, lineHeight: 1.55 }}>
        Une anecdote client, une opinion forte, un conseil — choisis-en une.
      </p>

      <div style={{ flex: 1 }} />

      {/* Big mic CTA */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <button
          type="button"
          onClick={onTalk}
          style={{
            width: 132, height: 132, borderRadius: '50%',
            background: T.primary, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 0 12px ${T.primary}1F, 0 0 0 24px ${T.primary}0E, 0 16px 40px ${T.primary}66`,
          }}
        >
          <MicSVG size={42} />
        </button>
        <div style={{ fontSize: 13, color: T.ink, fontWeight: 600, letterSpacing: 0.3 }}>
          APPUIE · PARLE À KABOU
        </div>
      </div>

      <button
        type="button"
        onClick={onWrite}
        style={{
          background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 16,
          padding: '16px 20px', fontSize: 14, color: T.muted, fontWeight: 600, cursor: 'pointer',
          minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        ⌨ Préférer écrire
      </button>
    </div>
  )
}

// ─── Screen: Conversation (messages + input bar) ──────────────────────────────

function ScreenConversation({
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

// ─── Screen: Proposal card ────────────────────────────────────────────────────

function ScreenProposal({
  proposal, saving,
  onAccept, onLater, onRework,
}: {
  proposal: KabouProposal
  saving: boolean
  onAccept: () => void
  onLater: () => void
  onRework: () => void
}) {
  return (
    <div style={{ background: T.bg, minHeight: FULL_H, display: 'flex', flexDirection: 'column', paddingTop: TOP_SAFE, paddingLeft: 18, paddingRight: 18, paddingBottom: 14, boxSizing: 'border-box' }}>
      {/* Top */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <KabouAvatar size={28} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>Kabou</div>
          <div style={{ fontSize: 11, color: T.muted }}>voilà ce que je te propose</div>
        </div>
      </div>

      {/* Proposal card */}
      <div style={{
        background: T.surface, borderRadius: 22, overflow: 'hidden',
        animation: 'slideUp 0.4s',
      }}>
        {/* Header band */}
        <div style={{ background: T.ink, padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999, background: 'rgba(252,165,165,0.15)',
            color: '#FCA5A5', fontSize: 11, fontWeight: 600,
          }}>
            {proposal.moodLabel}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, letterSpacing: 0.4 }}>
            {proposal.duration} · LinkedIn
          </span>
        </div>

        <div style={{ padding: 18 }}>
          <FormatBadge kind={proposal.formatKind} size="md" />

          <h2 style={{
            fontSize: 20, fontWeight: 700, color: T.ink, margin: '12px 0 0',
            lineHeight: 1.22, letterSpacing: -0.4,
          }}>
            {proposal.sujet}
          </h2>

          {/* Script de poche */}
          <div style={{
            marginTop: 16, padding: 14, background: T.bg, borderRadius: 14,
          }}>
            <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 10 }}>
              Script de poche · 3 beats
            </div>
            <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {proposal.beats.map((beat, i) => (
                <li key={i} style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
                  <b>{proposal.beatLabels[i]}</b> — {beat}
                </li>
              ))}
            </ol>
          </div>

          {/* Coaching tip */}
          <div style={{
            marginTop: 12, padding: '12px 14px', background: '#FFF7F0', borderRadius: 12,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 16 }}>🎯</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#E2541A', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 3 }}>
                Coaching Kabou
              </div>
              <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.45, fontWeight: 500 }}>
                {proposal.coachingTip}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* CTAs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        <button
          type="button"
          onClick={onAccept}
          disabled={saving}
          style={{
            background: T.primary, color: '#fff', border: 'none', borderRadius: 16,
            padding: 17, fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 10px 28px ${T.primary}50`, letterSpacing: -0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <span>▶</span>}
          On tourne maintenant
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onLater}
            disabled={saving}
            style={{
              flex: 1, background: 'rgba(0,0,0,0.05)', color: T.ink, border: 'none',
              borderRadius: 16, padding: '18px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              minHeight: 56,
            }}
          >
            📌 Plus tard
          </button>
          <button
            type="button"
            onClick={onRework}
            style={{
              flex: 1, background: 'rgba(0,0,0,0.05)', color: T.ink, border: 'none',
              borderRadius: 16, padding: '18px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              minHeight: 56,
            }}
          >
            ↺ Retravailler
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Screen: Later confirm ────────────────────────────────────────────────────

function ScreenLater({ proposal, onGoToSujets, onBrainstorm, onGoToUnivers }: {
  proposal: KabouProposal
  onGoToSujets: () => void
  onBrainstorm: () => void
  onGoToUnivers: () => void
}) {
  return (
    <div style={{ background: T.bg, minHeight: FULL_H, display: 'flex', flexDirection: 'column', paddingTop: TOP_SAFE, paddingLeft: 22, paddingRight: 22, paddingBottom: 24, boxSizing: 'border-box' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', background: '#FFF7F0',
          border: `2px solid ${T.primary}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'pop 0.4s',
        }}>
          <span style={{ fontSize: 36 }}>📌</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.ink, margin: 0, lineHeight: 1.2, letterSpacing: -0.5 }}>
          Mis dans ta file de tournage.
        </h1>
        <p style={{ fontSize: 15, color: T.muted, margin: 0, lineHeight: 1.55, maxWidth: 280 }}>
          Tu retrouveras ce sujet — script, coaching et tout — dans <b style={{ color: T.ink }}>Mes sujets</b> quand tu seras prêt à tourner.
        </p>

        <div style={{
          marginTop: 8, background: T.surface, borderRadius: 16, padding: 16,
          width: '100%', maxWidth: 300,
          display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left',
        }}>
          <FormatBadge kind={proposal.formatKind} />
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.35 }}>
            {proposal.sujet}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.warn, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.warn, display: 'inline-block' }} />
            En attente de tournage
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onGoToSujets}
        style={{
          background: T.primary, color: '#fff', border: 'none', borderRadius: 16,
          padding: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer',
          boxShadow: `0 8px 24px ${T.primary}40`,
        }}
      >
        Voir ma file →
      </button>
      <button
        type="button"
        onClick={onBrainstorm}
        style={{
          background: 'none', border: 'none', color: T.muted, fontSize: 13,
          padding: 12, marginTop: 4, cursor: 'pointer',
        }}
      >
        Continuer à brainstormer
      </button>
      <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 8, paddingTop: 14, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: T.muted, margin: '0 0 8px' }}>
          Plus Kabou te connaît, plus ses propositions seront précises.
        </p>
        <button
          type="button"
          onClick={onGoToUnivers}
          style={{ background: 'none', border: 'none', color: T.primary, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 4 }}
        >
          Enrichir mon Univers →
        </button>
      </div>
    </div>
  )
}

// ─── Screen: Rework (mini-conversation) ──────────────────────────────────────

const REWORK_CHIPS = [
  'Trop long', 'Pas mon ton', 'Format différent', 'Angle plus tranchant', 'Autre',
]

function ScreenRework({ isBusy, onChip, onBack }: {
  isBusy: boolean
  onChip: (text: string) => void
  onBack: () => void
}) {
  const [textInput, setTextInput] = useState('')
  return (
    <div style={{ background: T.bg, minHeight: FULL_H, display: 'flex', flexDirection: 'column', paddingTop: TOP_SAFE, paddingLeft: 18, paddingRight: 18, paddingBottom: 18, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottom: `1px solid ${T.border}`, marginBottom: 16 }}>
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: 22, color: T.ink, cursor: 'pointer' }}
        >‹</button>
        <KabouAvatar size={30} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Kabou</div>
          <div style={{ fontSize: 11, color: T.primary, fontWeight: 600 }}>on retravaille</div>
        </div>
      </div>

      {/* Kabou question */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <KabouAvatar size={26} />
        <div style={{
          background: T.surface, padding: '12px 16px',
          borderRadius: '20px 20px 20px 4px', fontSize: 14, lineHeight: 1.5, color: T.ink,
          fontWeight: 500,
        }}>
          OK, dis-moi : qu'est-ce qui ne va pas ? Le format, le ton, l'angle ?
        </div>
      </div>

      {/* Quick chips */}
      <div style={{ marginLeft: 34, display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {REWORK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onChip(chip)}
            disabled={isBusy}
            style={{
              background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 999,
              padding: '11px 18px', fontSize: 13, fontWeight: 600, color: T.ink,
              cursor: 'pointer', opacity: isBusy ? 0.5 : 1, minHeight: 44,
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, background: T.surface, borderRadius: 16, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && textInput.trim()) {
                onChip(textInput.trim())
                setTextInput('')
              }
            }}
            placeholder="Ou écris ce que tu veux changer…"
            disabled={isBusy}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, color: T.ink,
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (textInput.trim()) {
              onChip(textInput.trim())
              setTextInput('')
            }
          }}
          disabled={!textInput.trim() || isBusy}
          style={{
            background: T.ink, color: '#fff', border: 'none', borderRadius: 16,
            padding: '0 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            opacity: !textInput.trim() || isBusy ? 0.5 : 1,
            minHeight: 52, minWidth: 80,
          }}
        >
          Voir →
        </button>
      </div>
    </div>
  )
}

// ─── History Drawer ───────────────────────────────────────────────────────────

interface ThreadPreview {
  threadId: string
  preview: string
  lastAt: string
  messageCount: number
}

function HistoryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [threads, setThreads] = useState<ThreadPreview[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/chat/threads')
      .then((r) => r.json())
      .then((data) => setThreads(data.threads ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffH = Math.floor(diffMs / 3600000)
    if (diffH < 1) return 'Il y a moins d\'1h'
    if (diffH < 24) return `Il y a ${diffH}h`
    const diffD = Math.floor(diffH / 24)
    if (diffD === 1) return 'Hier'
    if (diffD < 7) return `Il y a ${diffD}j`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
          zIndex: 100, backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.2s',
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        background: T.surface, borderRadius: '22px 22px 0 0',
        zIndex: 101, maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.3s',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 12px',
          borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color={T.primary} />
            <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Conversations Kabou</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: T.muted }}
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0 24px' }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 size={20} className="animate-spin" style={{ color: T.muted }} />
            </div>
          )}

          {!loading && threads.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 24px', color: T.muted }}>
              <MessageSquare size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: 14, margin: 0 }}>Aucune conversation pour l'instant</p>
            </div>
          )}

          {!loading && threads.map((thread) => (
            <div
              key={thread.threadId}
              style={{
                padding: '14px 20px',
                borderBottom: `1px solid ${T.border}`,
                cursor: 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', background: '#FFF7F0',
                  border: `1px solid ${T.primary}25`, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MessageSquare size={14} color={T.primary} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 13, color: T.ink, fontWeight: 500, margin: '0 0 4px',
                    lineHeight: 1.4, overflow: 'hidden',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {thread.preview || '(conversation sans texte)'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: T.muted }}>{formatDate(thread.lastAt)}</span>
                    <span style={{ fontSize: 11, color: T.muted }}>·</span>
                    <span style={{ fontSize: 11, color: T.muted }}>{thread.messageCount} messages</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HomeKabouEntry() {
  const router = useRouter()

  // Flow state
  const [flowPhase, setFlowPhase] = useState<FlowPhase>('home')
  const [proposal, setProposal] = useState<KabouProposal | null>(null)
  const [saving, setSaving] = useState(false)
  const [createdSession, setCreatedSession] = useState<{ topicId: string; sessionId: string } | null>(null)
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
    if (!createRes.ok) return null
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
    try {
      const topicResult = await createTopicOnly(proposal)
      if (!topicResult) return
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
      if (!sessionRes.ok) return
      const session = await sessionRes.json()
      setCreatedSession({ topicId: topicResult.topicId, sessionId: session.id })
      router.push(`/s/${session.id}`)
    } finally {
      setSaving(false)
    }
  }, [proposal, createTopicOnly, router])

  const handleLater = useCallback(async () => {
    if (!proposal) return
    setSaving(true)
    try {
      const topicResult = await createTopicOnly(proposal)
      if (topicResult) setFlowPhase('later')
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
          onAccept={handleAccept}
          onLater={handleLater}
          onRework={handleRework}
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
