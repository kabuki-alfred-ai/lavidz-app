'use client'

import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { Check, ChevronDown, ChevronUp, Plus, Trash2, Smile, Clock, Search } from 'lucide-react'
import type { WordTimestamp } from '@/remotion/themeTypes'
import type { SubtitleSettings, SubtitleStyle } from '@/remotion/subtitleTypes'

/* ------------------------------------------------------------------ */
/* Emoji library (curated, searchable by keywords)                     */
/* ------------------------------------------------------------------ */

const EMOJI_LIB: { emoji: string; keywords: string[] }[] = [
  // Faces / reactions
  { emoji: '😀', keywords: ['sourire', 'smile', 'heureux', 'happy', 'joie', 'content'] },
  { emoji: '😂', keywords: ['rire', 'lol', 'laugh', 'drole', 'funny'] },
  { emoji: '😍', keywords: ['amour', 'love', 'coeur', 'heart', 'aime'] },
  { emoji: '🥰', keywords: ['amour', 'love', 'affection', 'tendresse'] },
  { emoji: '🤩', keywords: ['wow', 'etoiles', 'stars', 'excite', 'amazed'] },
  { emoji: '🤔', keywords: ['reflechir', 'think', 'pensif', 'reflexion', 'hmm'] },
  { emoji: '😎', keywords: ['cool', 'lunettes', 'sunglasses', 'classe'] },
  { emoji: '😱', keywords: ['choc', 'shock', 'wow', 'surpris', 'scream'] },
  { emoji: '😮', keywords: ['surpris', 'surprise', 'wow', 'oh', 'etonne'] },
  { emoji: '🥳', keywords: ['party', 'fete', 'celebration', 'anniversaire'] },
  { emoji: '😤', keywords: ['determine', 'fort', 'fier', 'strong'] },
  { emoji: '🤯', keywords: ['mind blown', 'explose', 'wow', 'incroyable'] },
  { emoji: '😉', keywords: ['clin', 'oeil', 'wink', 'complice'] },
  { emoji: '🙄', keywords: ['roll eyes', 'exaspere', 'annoyed'] },
  { emoji: '😅', keywords: ['gene', 'sweat', 'awkward', 'stress'] },
  // Gestures
  { emoji: '👍', keywords: ['pouce', 'thumbs up', 'bien', 'good', 'ok', 'oui'] },
  { emoji: '👎', keywords: ['pouce bas', 'thumbs down', 'mal', 'bad', 'non'] },
  { emoji: '👏', keywords: ['applaudir', 'clap', 'bravo'] },
  { emoji: '🙌', keywords: ['yes', 'celebration', 'hands up', 'bravo'] },
  { emoji: '🤝', keywords: ['deal', 'accord', 'handshake', 'agreement'] },
  { emoji: '💪', keywords: ['muscle', 'fort', 'strong', 'puissance', 'power'] },
  { emoji: '👊', keywords: ['poing', 'fist', 'punch'] },
  { emoji: '🤞', keywords: ['doigts croises', 'fingers crossed', 'chance'] },
  { emoji: '🤘', keywords: ['rock', 'metal', 'cool'] },
  { emoji: '👀', keywords: ['yeux', 'eyes', 'regarde', 'look', 'voir'] },
  { emoji: '🧠', keywords: ['cerveau', 'brain', 'idee', 'intelligence', 'reflechir'] },
  // Actions / ideas
  { emoji: '💡', keywords: ['idee', 'idea', 'ampoule', 'inspiration', 'light'] },
  { emoji: '⚡', keywords: ['eclair', 'lightning', 'rapide', 'fast', 'energie'] },
  { emoji: '🔥', keywords: ['feu', 'fire', 'hot', 'chaud', 'tendance'] },
  { emoji: '✨', keywords: ['sparkles', 'magie', 'magic', 'wow'] },
  { emoji: '⭐', keywords: ['etoile', 'star', 'favori'] },
  { emoji: '🎯', keywords: ['cible', 'target', 'objectif', 'goal'] },
  { emoji: '🚀', keywords: ['fusee', 'rocket', 'lancer', 'launch', 'croissance'] },
  { emoji: '🎉', keywords: ['fete', 'party', 'celebration', 'bravo'] },
  { emoji: '🏆', keywords: ['trophee', 'trophy', 'gagner', 'win', 'success'] },
  { emoji: '💯', keywords: ['100', 'cent', 'perfect', 'max'] },
  { emoji: '✅', keywords: ['check', 'ok', 'oui', 'yes', 'valide', 'fait'] },
  { emoji: '❌', keywords: ['croix', 'cross', 'non', 'no', 'refuse'] },
  { emoji: '⚠️', keywords: ['warning', 'attention', 'danger'] },
  { emoji: '❓', keywords: ['question', 'doute', 'interrogation'] },
  { emoji: '❗', keywords: ['important', 'exclamation', 'attention'] },
  // Money / business
  { emoji: '💰', keywords: ['argent', 'money', 'cash', 'riche', 'fric'] },
  { emoji: '💵', keywords: ['dollar', 'argent', 'money', 'billet'] },
  { emoji: '💸', keywords: ['depense', 'money', 'argent', 'cash', 'flying'] },
  { emoji: '💳', keywords: ['carte', 'credit', 'paiement', 'card'] },
  { emoji: '📈', keywords: ['croissance', 'growth', 'graphique', 'up', 'monte'] },
  { emoji: '📉', keywords: ['descente', 'decline', 'graphique', 'down', 'baisse'] },
  { emoji: '💼', keywords: ['business', 'travail', 'valise', 'work'] },
  { emoji: '🏢', keywords: ['bureau', 'office', 'entreprise', 'building'] },
  { emoji: '🤑', keywords: ['riche', 'money face', 'fric', 'rich'] },
  // Objects / context
  { emoji: '📱', keywords: ['telephone', 'phone', 'mobile', 'smartphone'] },
  { emoji: '💻', keywords: ['ordinateur', 'laptop', 'computer', 'macbook'] },
  { emoji: '⌚', keywords: ['montre', 'watch', 'temps', 'time'] },
  { emoji: '📊', keywords: ['statistiques', 'stats', 'chart', 'data'] },
  { emoji: '📝', keywords: ['ecrire', 'note', 'write', 'memo'] },
  { emoji: '📚', keywords: ['livres', 'books', 'lecture', 'apprendre'] },
  { emoji: '🎓', keywords: ['diplome', 'graduation', 'etudes', 'education'] },
  { emoji: '🎬', keywords: ['film', 'cinema', 'video', 'clap'] },
  { emoji: '🎥', keywords: ['camera', 'video', 'film'] },
  { emoji: '🎤', keywords: ['micro', 'microphone', 'karaoke', 'chanter'] },
  { emoji: '🎵', keywords: ['musique', 'music', 'note'] },
  { emoji: '📢', keywords: ['annonce', 'megaphone', 'news', 'parler'] },
  { emoji: '⏰', keywords: ['reveil', 'alarm', 'temps', 'time', 'minute'] },
  { emoji: '⏱️', keywords: ['chronometre', 'timer', 'temps'] },
  { emoji: '🔔', keywords: ['cloche', 'bell', 'notification', 'alerte'] },
  // Hearts / love
  { emoji: '❤️', keywords: ['coeur', 'heart', 'amour', 'love', 'rouge'] },
  { emoji: '🧡', keywords: ['coeur orange', 'orange heart'] },
  { emoji: '💛', keywords: ['coeur jaune', 'yellow heart'] },
  { emoji: '💚', keywords: ['coeur vert', 'green heart'] },
  { emoji: '💙', keywords: ['coeur bleu', 'blue heart'] },
  { emoji: '💜', keywords: ['coeur violet', 'purple heart'] },
  // Food
  { emoji: '☕', keywords: ['cafe', 'coffee', 'boisson'] },
  { emoji: '🍕', keywords: ['pizza', 'nourriture', 'food'] },
  { emoji: '🍔', keywords: ['burger', 'hamburger', 'fast food'] },
  { emoji: '🍟', keywords: ['frites', 'fries', 'food'] },
  { emoji: '🍻', keywords: ['biere', 'beer', 'tchin', 'alcool'] },
  // Travel / places
  { emoji: '✈️', keywords: ['avion', 'plane', 'voyage', 'travel'] },
  { emoji: '🌍', keywords: ['monde', 'world', 'terre', 'global'] },
  { emoji: '🏠', keywords: ['maison', 'home', 'house'] },
  { emoji: '🏖️', keywords: ['plage', 'beach', 'vacances', 'holiday'] },
  // Nature / signs
  { emoji: '🌞', keywords: ['soleil', 'sun', 'jour', 'ete'] },
  { emoji: '🌙', keywords: ['lune', 'moon', 'nuit', 'night'] },
  { emoji: '☁️', keywords: ['nuage', 'cloud'] },
  { emoji: '⚽', keywords: ['ballon', 'football', 'soccer', 'sport'] },
  { emoji: '🎮', keywords: ['jeu', 'game', 'gaming', 'manette'] },
]

function searchEmojis(query: string, limit = 48): typeof EMOJI_LIB {
  const q = query.trim().toLowerCase()
  if (!q) return EMOJI_LIB.slice(0, limit)
  return EMOJI_LIB.filter(e =>
    e.emoji === q || e.keywords.some(k => k.includes(q)),
  ).slice(0, limit)
}

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* ------------------------------------------------------------------ */

const C = {
  accent: '#FF4D1C',
  accentBg: 'rgba(255,77,28,0.08)',
  text: '#111827',
  textSec: '#6B7280',
  textDim: '#9CA3AF',
  border: '#F3F4F6',
  surface: '#F9FAFB',
  bg: '#FFFFFF',
  highlight: '#FBBF24',
  activeWord: 'rgba(255,77,28,0.12)',
}

/* ------------------------------------------------------------------ */
/* Caption style templates (visual presets like Submagic)               */
/* ------------------------------------------------------------------ */

type StyleCategory = 'all' | 'trend' | 'emoji' | 'premium'

interface CaptionTemplate {
  id: SubtitleStyle
  label: string
  categories: StyleCategory[]
  pill: { bg: string; text: string; highlight?: string; font: string; weight: number; italic?: boolean; textShadow?: string; border?: string }
  preview: { bg: string; text: string; highlight: string; font: string }
}

const CAPTION_TEMPLATES: CaptionTemplate[] = [
  {
    id: 'hormozi',
    label: 'Hormozi',
    categories: ['all', 'trend', 'premium'],
    pill: { bg: '#0B0B0B', text: '#FFD600', font: 'Impact, Haettenschweiler, sans-serif', weight: 900, textShadow: '0 2px 0 #000' },
    preview: { bg: '#000', text: '#fff', highlight: '#FFD600', font: 'Impact' },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    categories: ['all'],
    pill: { bg: '#FFFFFF', text: '#111827', font: 'Inter, sans-serif', weight: 600, border: '1px solid #E5E7EB' },
    preview: { bg: '#fff', text: '#111', highlight: '#3B82F6', font: 'Inter' },
  },
  {
    id: 'classic',
    label: 'Classic',
    categories: ['all'],
    pill: { bg: '#111827', text: '#FFFFFF', font: "'Times New Roman', serif", weight: 700, italic: true },
    preview: { bg: '#111', text: '#fff', highlight: '#FFD600', font: 'Times New Roman' },
  },
  {
    id: 'karaoke',
    label: 'Karaoke',
    categories: ['all', 'trend'],
    pill: { bg: '#0A0A0A', text: '#FF4D1C', font: "'Arial Black', sans-serif", weight: 900, textShadow: '0 0 8px rgba(255,77,28,0.6)' },
    preview: { bg: '#000', text: '#fff', highlight: '#FF4D1C', font: 'Arial Black' },
  },
  {
    id: 'neon',
    label: 'Neon',
    categories: ['all', 'trend', 'premium'],
    pill: { bg: '#0D0D2A', text: '#00FF88', font: 'Montserrat, sans-serif', weight: 800, textShadow: '0 0 10px #00FF88, 0 0 20px rgba(0,255,136,0.5)' },
    preview: { bg: '#0D0D0D', text: '#fff', highlight: '#00FF88', font: 'Montserrat' },
  },
  {
    id: 'boxed',
    label: 'Boxed',
    categories: ['all'],
    pill: { bg: '#FF4D1C', text: '#FFFFFF', font: 'Inter, sans-serif', weight: 800 },
    preview: { bg: '#FF4D1C', text: '#fff', highlight: '#FFD600', font: 'Inter' },
  },
  {
    id: 'outline',
    label: 'Outline',
    categories: ['all'],
    pill: { bg: '#1F2937', text: '#FFFFFF', font: 'Impact, sans-serif', weight: 900, textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000', border: '2px solid #000' },
    preview: { bg: 'transparent', text: '#fff', highlight: '#FF4D1C', font: 'Impact' },
  },
  {
    id: 'tape',
    label: 'Tape',
    categories: ['all', 'premium'],
    pill: { bg: '#FCD34D', text: '#1F2937', font: "'Courier New', monospace", weight: 700, border: '1px dashed #92400E' },
    preview: { bg: '#FCD34D', text: '#1F2937', highlight: '#DC2626', font: 'Courier New' },
  },
  {
    id: 'glitch',
    label: 'Glitch',
    categories: ['all', 'trend'],
    pill: { bg: '#050505', text: '#F0F0F0', font: 'monospace', weight: 800, textShadow: '2px 0 #FF00E5, -2px 0 #00E5FF' },
    preview: { bg: '#000', text: '#fff', highlight: '#FF00E5', font: 'monospace' },
  },
  {
    id: 'fire',
    label: 'Fire',
    categories: ['all', 'trend', 'emoji', 'premium'],
    pill: { bg: 'linear-gradient(135deg, #FF6A00, #EE0979)', text: '#FFFFFF', font: "'Arial Black', sans-serif", weight: 900, textShadow: '0 1px 0 rgba(0,0,0,0.4)' },
    preview: { bg: '#1F1F1F', text: '#fff', highlight: '#FF6A00', font: 'Arial Black' },
  },
]

const STYLE_CATEGORIES: { id: StyleCategory; label: string }[] = [
  { id: 'all', label: 'all' },
  { id: 'trend', label: 'trend' },
  { id: 'emoji', label: 'emoji' },
  { id: 'premium', label: 'premium' },
]

/* ------------------------------------------------------------------ */
/* Emoji picker (with search)                                          */
/* ------------------------------------------------------------------ */

function EmojiPicker({
  chunkWords,
  editor,
  setEditor,
  currentEmoji,
  onConfirm,
  onRemove,
  onClose,
}: {
  chunkWords: WordTimestamp[]
  editor: { recId: string; word: string; current: string }
  setEditor: (e: { recId: string; word: string; current: string }) => void
  currentEmoji: string | null
  onConfirm: (emoji: string) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchEmojis(query), [query])
  const selected = editor.current || currentEmoji || ''

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8,
      padding: 10, borderRadius: 10,
      background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.25)',
    }}>
      {/* Top row: word select + current emoji + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: C.textSec, fontWeight: 600 }}>Mot :</span>
        <select
          value={editor.word}
          onChange={(e) => setEditor({ ...editor, word: e.target.value })}
          style={{
            flex: 1, padding: '4px 8px', borderRadius: 6, fontSize: 12,
            border: `1px solid ${C.border}`, background: C.bg, color: C.text,
            cursor: 'pointer',
          }}
        >
          {chunkWords.map((w, i) => (
            <option key={i} value={w.word}>{w.word}</option>
          ))}
        </select>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          border: `1.5px solid ${selected ? C.accent : C.border}`,
          background: selected ? 'rgba(255,77,28,0.06)' : C.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          {selected || <Smile size={16} color={C.textDim} />}
        </div>
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative' }}>
        <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: C.textDim }} />
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (argent, feu, idee...)"
          style={{
            width: '100%', padding: '7px 8px 7px 28px', borderRadius: 6, fontSize: 12,
            border: `1px solid ${C.border}`, background: C.bg, color: C.text,
            outline: 'none',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
          onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
        />
      </div>

      {/* Emoji grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4,
        maxHeight: 140, overflowY: 'auto', padding: 2,
      }}>
        {results.length === 0 ? (
          <p style={{
            gridColumn: '1 / -1', textAlign: 'center', fontSize: 11,
            color: C.textDim, padding: '12px 0',
          }}>
            Aucun emoji trouve
          </p>
        ) : (
          results.map((item) => {
            const isSelected = selected === item.emoji
            return (
              <button
                key={item.emoji}
                onClick={() => setEditor({ ...editor, current: item.emoji })}
                title={item.keywords[0]}
                style={{
                  aspectRatio: '1', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 18, padding: 0,
                  background: isSelected ? C.accentBg : 'transparent',
                  outline: isSelected ? `1.5px solid ${C.accent}` : 'none',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = C.surface }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                {item.emoji}
              </button>
            )
          })
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => onConfirm(selected)}
          disabled={!selected}
          style={{
            flex: 1, padding: '7px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
            background: selected ? C.accent : '#FCA58D', color: '#fff',
            border: 'none', cursor: selected ? 'pointer' : 'not-allowed', opacity: selected ? 1 : 0.7,
          }}
        >
          {currentEmoji ? 'Modifier' : 'Ajouter'}
        </button>
        {currentEmoji && (
          <button
            onClick={onRemove}
            title="Supprimer"
            style={{
              padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: 'rgba(239,68,68,0.08)', color: '#EF4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Trash2 size={12} />
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            padding: '7px 10px', borderRadius: 7, fontSize: 11, fontWeight: 500,
            background: 'transparent', color: C.textSec, border: `1px solid ${C.border}`,
            cursor: 'pointer',
          }}
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Word chip                                                           */
/* ------------------------------------------------------------------ */

function WordChip({
  word,
  isActive,
  isEditing,
  onEdit,
  onClick,
}: {
  word: WordTimestamp
  isActive: boolean
  isEditing: boolean
  onEdit: (newWord: string) => void
  onClick: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(word.word)

  useEffect(() => { setDraft(word.word) }, [word.word])
  useEffect(() => { if (isEditing) inputRef.current?.focus() }, [isEditing])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onEdit(draft)}
        onKeyDown={(e) => { if (e.key === 'Enter') { onEdit(draft); (e.target as HTMLInputElement).blur() } }}
        style={{
          fontSize: 14, fontWeight: 500, color: C.text,
          border: `1.5px solid ${C.accent}`, borderRadius: 6,
          padding: '2px 6px', outline: 'none', background: C.accentBg,
          width: Math.max(30, draft.length * 9),
          fontFamily: 'inherit',
        }}
      />
    )
  }

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-block',
        padding: '2px 4px',
        borderRadius: 4,
        fontSize: 14,
        fontWeight: 500,
        color: C.text,
        background: isActive ? C.activeWord : 'transparent',
        cursor: 'text',
        transition: 'background 0.15s',
        lineHeight: 1.8,
      }}
    >
      {word.word}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export interface CaptionEditorProps {
  /** All word timestamps across recordings (merged, in order) */
  wordsByRecording: Record<string, WordTimestamp[]>
  recordings: { id: string; questionText: string }[]
  subtitleSettings: SubtitleSettings
  onSubtitleSettingsChange: (settings: Partial<SubtitleSettings>) => void
  onWordEdit: (recordingId: string, wordIndex: number, newWord: string) => void
  /** Seek player to recording at local time (seconds) */
  onSeek?: (recordingId: string, timeSec: number) => void
  /** Delete a word from a recording */
  onDeleteWord?: (recordingId: string, wordIndex: number) => void
  /** Insert a new word after an existing one */
  onAddWord?: (recordingId: string, afterWordIndex: number) => void
  /** Delete a whole chunk (group of words) */
  onDeleteChunk?: (recordingId: string, startIdx: number, endIdx: number) => void
  /** Returns current playback time for a recording (-1 if not playing) */
  getActiveRecordingTime?: () => { recordingId: string; timeSec: number } | null
  /** Word-emoji links per recording (AI-generated or manual) */
  wordEmojisBySegmentId?: Record<string, { word: string; emoji: string }[]>
  /** Add or update an emoji linked to a specific word */
  onEmojiSet?: (recordingId: string, word: string, emoji: string) => void
  /** Remove the emoji linked to a specific word */
  onEmojiRemove?: (recordingId: string, word: string) => void
  /** Initial tab to display when the editor opens */
  initialTab?: 'style' | 'settings' | 'transcript'
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function CaptionEditor({
  wordsByRecording,
  recordings,
  subtitleSettings,
  onSubtitleSettingsChange,
  onWordEdit,
  onSeek,
  onDeleteWord,
  onAddWord,
  onDeleteChunk,
  getActiveRecordingTime,
  wordEmojisBySegmentId,
  onEmojiSet,
  onEmojiRemove,
  initialTab,
}: CaptionEditorProps) {
  const [emojiEditor, setEmojiEditor] = useState<{ recId: string; word: string; current: string } | null>(null)
  const [collapsedRecs, setCollapsedRecs] = useState<Set<string>>(new Set())
  const [editingWord, setEditingWord] = useState<{ recId: string; idx: number } | null>(null)
  const [activeTab, setActiveTab] = useState<'style' | 'settings' | 'transcript'>(initialTab ?? 'style')
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])
  const [styleCategory, setStyleCategory] = useState<StyleCategory>('all')
  const [activeInfo, setActiveInfo] = useState<{ recordingId: string; timeSec: number } | null>(null)

  const filteredTemplates = useMemo(
    () => CAPTION_TEMPLATES.filter(t => t.categories.includes(styleCategory)),
    [styleCategory],
  )

  // Poll active word during playback
  useEffect(() => {
    if (!getActiveRecordingTime) return
    let raf: number
    const tick = () => {
      setActiveInfo(getActiveRecordingTime())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [getActiveRecordingTime])

  return (
    <div>
      {/* ── Tabs bar ── */}
      <div style={{
        display: 'flex', gap: 4, padding: 3, borderRadius: 10,
        background: C.surface, border: `1px solid ${C.border}`,
        marginBottom: 14,
      }}>
        {([
          { id: 'style', label: 'Choose style' },
          { id: 'settings', label: 'Reglages' },
          { id: 'transcript', label: 'Transcription' },
        ] as const).map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 7, border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: isActive ? C.bg : 'transparent',
                color: isActive ? C.text : C.textSec,
                boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab: Choose Style ── */}
      {activeTab === 'style' && (
        <div>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {STYLE_CATEGORIES.map(cat => {
              const isActive = styleCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setStyleCategory(cat.id)}
                  style={{
                    padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: isActive ? C.text : C.surface,
                    color: isActive ? C.bg : C.textSec,
                    textTransform: 'lowercase',
                  }}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>

          {/* Style pills grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
          }}>
            {filteredTemplates.map((tmpl) => {
              const isActive = subtitleSettings.style === tmpl.id
              return (
                <button
                  key={tmpl.id}
                  onClick={() => onSubtitleSettingsChange({ style: tmpl.id })}
                  style={{
                    position: 'relative',
                    padding: 0, borderRadius: 10, cursor: 'pointer',
                    border: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
                    background: 'transparent',
                    aspectRatio: '16/7',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: tmpl.pill.bg,
                    border: tmpl.pill.border ?? 'none',
                    borderRadius: 8,
                    padding: '0 8px',
                  }}>
                    <span style={{
                      fontFamily: tmpl.pill.font,
                      fontWeight: tmpl.pill.weight,
                      fontStyle: tmpl.pill.italic ? 'italic' : 'normal',
                      color: tmpl.pill.text,
                      fontSize: 15,
                      textShadow: tmpl.pill.textShadow,
                      letterSpacing: 0.3,
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {tmpl.label}
                    </span>
                  </div>
                  {isActive && (
                    <div style={{
                      position: 'absolute', top: 4, right: 4, width: 18, height: 18,
                      borderRadius: '50%', background: C.accent,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }}>
                      <Check size={10} color="#fff" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {filteredTemplates.length === 0 && (
            <p style={{ fontSize: 11, color: C.textDim, textAlign: 'center', padding: '20px 0' }}>
              Aucun style dans cette categorie
            </p>
          )}
        </div>
      )}

      {/* ── Tab: Settings ── */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Position slider */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Caption position</span>
              <span style={{ fontSize: 11, color: C.textSec, fontFamily: 'monospace' }}>{subtitleSettings.position}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={95}
              value={subtitleSettings.position}
              onChange={(e) => onSubtitleSettingsChange({ position: Number(e.target.value) })}
              style={{ width: '100%', accentColor: C.accent }}
            />
          </div>

          {/* Font size slider */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Font size</span>
              <span style={{ fontSize: 11, color: C.textSec, fontFamily: 'monospace' }}>{subtitleSettings.size}px</span>
            </div>
            <input
              type="range"
              min={24}
              max={120}
              value={subtitleSettings.size}
              onChange={(e) => onSubtitleSettingsChange({ size: Number(e.target.value) })}
              style={{ width: '100%', accentColor: C.accent }}
            />
          </div>

          {/* Words per line */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Mots par ligne</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((w) => (
                <button
                  key={w}
                  onClick={() => onSubtitleSettingsChange({ wordsPerLine: w })}
                  style={{
                    width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: subtitleSettings.wordsPerLine === w ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                    background: subtitleSettings.wordsPerLine === w ? C.accentBg : C.bg,
                    color: subtitleSettings.wordsPerLine === w ? C.accent : C.textSec,
                    cursor: 'pointer',
                  }}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Colors row — inherits from Brand Kit on first load */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 4 }}>
            {([
              { key: 'fontColor', label: 'Font', fallback: '#FFFFFF' },
              { key: 'mainColor', label: 'Main', fallback: '#FF4D1C' },
              { key: 'secondColor', label: 'Second', fallback: '#1A1A2E' },
              { key: 'thirdColor', label: 'Third', fallback: '#E94560' },
            ] as const).map(c => {
              const current = (subtitleSettings as any)[c.key] as string | undefined
              const value = current ?? c.fallback
              return (
                <label
                  key={c.key}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: 6, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 11, color: C.textSec, fontWeight: 600 }}>{c.label}</span>
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#FFFFFF'}
                    onChange={(e) => onSubtitleSettingsChange({ [c.key]: e.target.value } as any)}
                    style={{
                      width: '100%', height: 28, border: 'none', padding: 0, cursor: 'pointer',
                      background: 'transparent',
                    }}
                  />
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Transcript ── */}
      {activeTab === 'transcript' && (
      <div>
        <p style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>
          Cliquez sur un mot pour le modifier, sur le timestamp pour naviguer
        </p>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {recordings.map((rec, recIdx) => {
            const words = wordsByRecording[rec.id] ?? []
            const hasWords = words.length > 0
            const isPlayingThis = activeInfo?.recordingId === rec.id
            const isCollapsed = collapsedRecs.has(rec.id)

            // Group words into chunks based on wordsPerLine
            const chunkSize = subtitleSettings.wordsPerLine ?? 3
            const chunks: { start: number; end: number; words: WordTimestamp[]; startIdx: number }[] = []
            for (let i = 0; i < words.length; i += chunkSize) {
              const chunkWords = words.slice(i, i + chunkSize)
              if (!chunkWords.length) continue
              chunks.push({
                start: chunkWords[0].start,
                end: chunkWords[chunkWords.length - 1].end,
                words: chunkWords,
                startIdx: i,
              })
            }

            const totalDuration = hasWords
              ? words[words.length - 1].end - words[0].start
              : 0
            const emojisCount = (wordEmojisBySegmentId?.[rec.id] ?? []).length

            return (
              <div key={rec.id} style={{
                borderRadius: 12,
                background: isPlayingThis ? 'rgba(255,77,28,0.03)' : C.bg,
                border: `1px solid ${isPlayingThis ? C.accent + '33' : C.border}`,
                overflow: 'hidden',
                transition: 'all 0.2s',
              }}>
                {/* Video group header (clickable to collapse) */}
                <button
                  onClick={() => {
                    setCollapsedRecs(prev => {
                      const next = new Set(prev)
                      if (next.has(rec.id)) next.delete(rec.id)
                      else next.add(rec.id)
                      return next
                    })
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 12px', border: 'none', cursor: 'pointer',
                    background: isPlayingThis ? 'rgba(255,77,28,0.06)' : C.surface,
                    borderBottom: !isCollapsed ? `1px solid ${C.border}` : 'none',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Video number badge */}
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: isPlayingThis ? C.accent : C.bg,
                    color: isPlayingThis ? '#fff' : C.textSec,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    border: isPlayingThis ? 'none' : `1px solid ${C.border}`,
                  }}>
                    {recIdx + 1}
                  </div>

                  {/* Title + meta */}
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: C.text, margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {rec.questionText || `Video ${recIdx + 1}`}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>
                        {hasWords
                          ? `${totalDuration.toFixed(1)}s · ${words.length} mots · ${chunks.length} chunks`
                          : 'Transcription non disponible'}
                      </span>
                      {emojisCount > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          padding: '1px 6px', borderRadius: 10,
                          background: 'rgba(251,191,36,0.12)', color: '#B45309',
                        }}>
                          {emojisCount} emoji{emojisCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {isPlayingThis && (
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          padding: '1px 6px', borderRadius: 10,
                          background: C.accent, color: '#fff',
                        }}>
                          En lecture
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Collapse icon */}
                  {isCollapsed
                    ? <ChevronDown size={14} color={C.textDim} />
                    : <ChevronUp size={14} color={C.textDim} />
                  }
                </button>

                {/* Chunks or empty state */}
                {!isCollapsed && !hasWords && (
                  <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: C.textDim, margin: 0 }}>
                      Transcription en cours ou indisponible
                    </p>
                    <p style={{ fontSize: 11, color: C.textDim, margin: '4px 0 0' }}>
                      Cliquez sur "Appliquer" pour regenerer si besoin.
                    </p>
                  </div>
                )}
                {!isCollapsed && hasWords && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10 }}>
                  {chunks.map((chunk, chunkIdx) => {
                    const isActiveChunk = isPlayingThis && activeInfo
                      && activeInfo.timeSec >= chunk.start && activeInfo.timeSec < chunk.end

                    // Find emoji(s) linked to any word in this chunk
                    const chunkEmojis = wordEmojisBySegmentId?.[rec.id] ?? []
                    const linkedEmojis = chunk.words
                      .map(w => {
                        const match = chunkEmojis.find(e => e.word.toLowerCase() === w.word.toLowerCase())
                        return match ? { word: w.word, emoji: match.emoji } : null
                      })
                      .filter((x): x is { word: string; emoji: string } => x !== null)

                    const isEditingEmoji = emojiEditor?.recId === rec.id
                      && chunk.words.some(w => w.word.toLowerCase() === emojiEditor.word.toLowerCase())

                    return (
                      <div
                        key={chunkIdx}
                        style={{
                          padding: 8, borderRadius: 10,
                          background: isActiveChunk ? C.accentBg : C.surface,
                          border: `1px solid ${isActiveChunk ? C.accent + '33' : C.border}`,
                          transition: 'all 0.15s',
                        }}
                      >
                        {/* Top row: timestamp + actions */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
                        }}>
                          {/* Timestamp badge */}
                          <button
                            onClick={() => onSeek?.(rec.id, chunk.start)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 8px', borderRadius: 6,
                              background: isActiveChunk ? C.accent : C.bg,
                              color: isActiveChunk ? '#fff' : C.textSec,
                              fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
                              border: `1px solid ${isActiveChunk ? C.accent : C.border}`,
                              cursor: 'pointer',
                            }}
                          >
                            <Clock size={10} />
                            {chunk.start.toFixed(2)} - {chunk.end.toFixed(2)}
                          </button>

                          {/* Linked emojis (display) */}
                          {linkedEmojis.map((le, lei) => (
                            <button
                              key={lei}
                              onClick={() => setEmojiEditor({ recId: rec.id, word: le.word, current: le.emoji })}
                              title={`Emoji lie au mot "${le.word}"`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                padding: '2px 6px', borderRadius: 6,
                                background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
                                cursor: 'pointer', fontSize: 14,
                              }}
                            >
                              <span style={{ fontSize: 14 }}>{le.emoji}</span>
                              <span style={{ fontSize: 9, color: C.textSec, fontWeight: 600 }}>{le.word}</span>
                            </button>
                          ))}

                          <div style={{ flex: 1 }} />

                          {/* Add emoji button */}
                          <button
                            title="Ajouter un emoji"
                            onClick={() => {
                              // Pick the middle word of the chunk as default target
                              const target = chunk.words[Math.floor(chunk.words.length / 2)]
                              if (target) setEmojiEditor({ recId: rec.id, word: target.word, current: '' })
                            }}
                            style={{
                              width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer',
                              background: 'transparent', color: C.textDim,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <Smile size={13} />
                          </button>

                          {/* Delete chunk button */}
                          <button
                            title="Supprimer ce segment"
                            onClick={() => {
                              if (onDeleteChunk && confirm('Supprimer ce segment ?')) {
                                onDeleteChunk(rec.id, chunk.startIdx, chunk.startIdx + chunk.words.length - 1)
                              }
                            }}
                            style={{
                              width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer',
                              background: 'transparent', color: C.textDim,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
                              e.currentTarget.style.color = '#EF4444'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = C.textDim
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Emoji editor (inline popover with search picker) */}
                        {isEditingEmoji && emojiEditor && (
                          <EmojiPicker
                            chunkWords={chunk.words}
                            editor={emojiEditor}
                            setEditor={setEmojiEditor}
                            currentEmoji={linkedEmojis.find(le => le.word.toLowerCase() === emojiEditor.word.toLowerCase())?.emoji ?? null}
                            onConfirm={(emoji) => {
                              if (emoji && onEmojiSet) onEmojiSet(emojiEditor.recId, emojiEditor.word, emoji)
                              setEmojiEditor(null)
                            }}
                            onRemove={() => {
                              if (onEmojiRemove) onEmojiRemove(emojiEditor.recId, emojiEditor.word)
                              setEmojiEditor(null)
                            }}
                            onClose={() => setEmojiEditor(null)}
                          />
                        )}

                        {/* Words */}
                        <div style={{
                          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2,
                          lineHeight: 1.6,
                        }}>
                          {chunk.words.map((w, wi) => {
                            const globalIdx = chunk.startIdx + wi
                            const isActiveWord = isPlayingThis && activeInfo
                              && activeInfo.timeSec >= w.start && activeInfo.timeSec < w.end
                            const isEditingThis = editingWord?.recId === rec.id && editingWord?.idx === globalIdx

                            return (
                              <span key={globalIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                <WordChip
                                  word={w}
                                  isActive={!!isActiveWord}
                                  isEditing={isEditingThis}
                                  onClick={() => setEditingWord({ recId: rec.id, idx: globalIdx })}
                                  onEdit={(newWord) => {
                                    onWordEdit(rec.id, globalIdx, newWord)
                                    setEditingWord(null)
                                  }}
                                />
                                {onDeleteWord && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteWord(rec.id, globalIdx) }}
                                    title="Supprimer ce mot"
                                    style={{
                                      width: 14, height: 14, borderRadius: 3, border: 'none', cursor: 'pointer',
                                      background: 'transparent', color: C.textDim,
                                      display: 'none', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 10, padding: 0, opacity: 0.5,
                                    }}
                                  >
                                    x
                                  </button>
                                )}
                              </span>
                            )
                          })}

                          {/* Add word button */}
                          {onAddWord && (
                            <button
                              onClick={() => onAddWord(rec.id, chunk.startIdx + chunk.words.length - 1)}
                              title="Ajouter un mot"
                              style={{
                                width: 20, height: 20, borderRadius: 4, border: `1px dashed ${C.border}`,
                                cursor: 'pointer', background: 'transparent', color: C.textDim,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: 0, marginLeft: 4,
                              }}
                            >
                              <Plus size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      )}
    </div>
  )
}
