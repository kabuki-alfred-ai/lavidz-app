'use client'

import Link from 'next/link'
import { ChevronRight, FileText, Plus } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentFormat = 'QUESTION_BOX' | 'TELEPROMPTER' | 'HOT_TAKE' | 'STORYTELLING' | 'DAILY_TIP' | 'MYTH_VS_REALITY'
type TopicStatus = 'READY' | 'FILMING' | 'DONE' | 'ARCHIVED'

type Sujet = {
  id: string
  name: string
  status: string
  format: string | null
  script: Record<string, unknown> | null
  updatedAt: string
  latestSession: { id: string; status: string } | null
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  FILMING:  { dot: '#EF4444', label: 'En cours' },
  READY:    { dot: '#F59E0B', label: 'À tourner' },
  DONE:     { dot: '#22C55E', label: 'Terminé' },
  ARCHIVED: { dot: '#A1A1AA', label: 'Archivé' },
}

const FORMAT_META: Record<ContentFormat, { label: string; emoji: string }> = {
  QUESTION_BOX:    { label: 'Boîte à questions', emoji: '❓' },
  TELEPROMPTER:    { label: 'Téléprompter',       emoji: '📖' },
  HOT_TAKE:        { label: 'Take chaud',          emoji: '🔥' },
  STORYTELLING:    { label: 'Storytelling',        emoji: '🎙️' },
  DAILY_TIP:       { label: 'Conseil du jour',     emoji: '💡' },
  MYTH_VS_REALITY: { label: 'Mythe vs Réalité',    emoji: '⚖️' },
}

const STATUS_ORDER: TopicStatus[] = ['FILMING', 'READY', 'DONE', 'ARCHIVED']

const PASTEL_COLORS = [
  { bg: '#FFE8DC', text: '#9A3412' },
  { bg: '#E0E7FF', text: '#3730A3' },
  { bg: '#DCFCE7', text: '#166534' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#DBEAFE', text: '#1E40AF' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashColor(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PASTEL_COLORS[h % PASTEL_COLORS.length]
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `il y a ${diffD}j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function isNouveauEligible(sujet: Sujet): boolean {
  if (sujet.status !== 'READY') return false
  return Date.now() - new Date(sujet.updatedAt).getTime() < 30 * 60_000
}

// ─── SujetRow ─────────────────────────────────────────────────────────────────

function SujetRow({ sujet }: { sujet: Sujet }) {
  const color = hashColor(sujet.id)
  const initials = getInitials(sujet.name)
  const fmt = sujet.format ? FORMAT_META[sujet.format as ContentFormat] : null
  const status = STATUS_CONFIG[sujet.status] ?? { dot: '#A1A1AA', label: sujet.status }
  const showNouveau = isNouveauEligible(sujet)

  return (
    <Link
      href={`/sujets/${sujet.id}`}
      className="flex items-center gap-4 px-4 py-4 cursor-pointer active:opacity-70 transition-opacity select-none"
    >
      {/* Initials avatar */}
      <div className="relative shrink-0">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black"
          style={{ background: color.bg, color: color.text }}
        >
          {initials}
        </div>
        {showNouveau && (
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[17px] font-bold text-foreground truncate leading-tight">
          {sujet.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {fmt && (
            <>
              <span className="text-[12px] text-muted-foreground">{fmt.emoji} {fmt.label}</span>
              <span className="text-muted-foreground/40 text-[12px]">·</span>
            </>
          )}
          <span
            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: status.dot }}
          />
          <span className="text-[13px] text-muted-foreground font-medium">{status.label}</span>
        </div>
        <p className="text-[12px] text-muted-foreground/50 mt-0.5">
          {formatRelative(sujet.updatedAt)}
        </p>
      </div>

      <ChevronRight size={16} className="text-muted-foreground/30 shrink-0" />
    </Link>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function SujetsList({ topics }: { topics: Sujet[] }) {
  const sorted = [...topics].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status as TopicStatus)
    const bi = STATUS_ORDER.indexOf(b.status as TopicStatus)
    return (ai === -1 ? STATUS_ORDER.length : ai) - (bi === -1 ? STATUS_ORDER.length : bi)
  })

  const readyOrFilming = topics.filter(t => t.status === 'READY' || t.status === 'FILMING').length

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (topics.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 flex flex-col min-h-[70vh]">
        <div className="pt-6 md:pt-8 pb-8">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Mes sujets</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center pb-12">
          <div className="w-20 h-20 rounded-3xl bg-primary/8 flex items-center justify-center">
            <FileText size={36} className="text-primary/60" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">Aucun sujet</p>
            <p className="text-[15px] text-muted-foreground mt-2 max-w-[240px] leading-relaxed">
              Parle à Kabou pour créer ton premier sujet vidéo.
            </p>
          </div>
        </div>

        <div className="pb-6">
          <Link
            href="/home"
            className="flex items-center justify-center gap-2.5 w-full h-14 bg-primary text-white rounded-2xl text-[15px] font-bold active:opacity-80 transition-opacity"
          >
            <Plus size={18} strokeWidth={2.5} />
            Nouveau sujet avec Kabou
          </Link>
        </div>
      </div>
    )
  }

  // ── List state ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">

      {/* Header */}
      <div className="px-4 pt-6 md:pt-8 pb-6">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Mes sujets</h1>
        <p className="text-[14px] text-muted-foreground mt-0.5">
          {topics.length} sujet{topics.length > 1 ? 's' : ''} · {readyOrFilming} à tourner
        </p>
      </div>

      {/* Primary CTA */}
      <div className="px-4 pb-8">
        <Link
          href="/home"
          className="flex items-center justify-center gap-2.5 w-full h-14 bg-primary text-white rounded-2xl text-[15px] font-bold active:opacity-80 transition-opacity"
        >
          <Plus size={18} strokeWidth={2.5} />
          Nouveau sujet avec Kabou
        </Link>
      </div>

      {/* Section label */}
      <p className="px-4 pb-3 text-[11px] font-black uppercase tracking-[0.8px] text-muted-foreground">
        Mes sujets
      </p>

      {/* List */}
      <div className="flex flex-col bg-surface rounded-3xl mx-4 overflow-hidden">
        {sorted.map((sujet, i) => (
          <div key={sujet.id}>
            <SujetRow sujet={sujet} />
            {i < sorted.length - 1 && (
              <div className="ml-[72px] h-px bg-muted/20" />
            )}
          </div>
        ))}
      </div>

      <div className="h-8" />
    </div>
  )
}
