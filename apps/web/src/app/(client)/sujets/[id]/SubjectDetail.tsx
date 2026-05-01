'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Check, X, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { Drawer } from 'vaul'
import { SubjectKabouPanel } from './SubjectKabouPanel'

// ─── Types ───────────────────────────────────────────────────────────────────

type ContentFormat = 'QUESTION_BOX' | 'TELEPROMPTER' | 'HOT_TAKE' | 'STORYTELLING' | 'DAILY_TIP' | 'MYTH_VS_REALITY'
type TopicStatus = 'DRAFT' | 'READY' | 'FILMING' | 'DONE' | 'ARCHIVED'

type Script = {
  scriptType: 'bullets' | 'teleprompter'
  bullets?: string[]
  teleprompterScript?: string
}

type Props = {
  id: string
  name: string
  status: TopicStatus
  format: ContentFormat | null
  script: Script | null
  threadId: string
  brief: string | null
  latestSessionId: string | null
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:      '#FAFAF7',
  surface: '#FFFFFF',
  ink:     '#0A0A0A',
  muted:   '#737373',
  primary: '#FF6B2E',
  border:  'rgba(0,0,0,0.08)',
}

const FORMAT_META: Record<ContentFormat, { label: string; emoji: string; bg: string; color: string; duration: string }> = {
  QUESTION_BOX:    { label: 'Boîte à questions', emoji: '❓', bg: '#EDE9FE', color: '#6D28D9', duration: '60s' },
  TELEPROMPTER:    { label: 'Téléprompter',       emoji: '📖', bg: '#FEF3C7', color: '#92400E', duration: '90s' },
  HOT_TAKE:        { label: 'Take chaud',          emoji: '🔥', bg: '#FEF2F2', color: '#DC2626', duration: '45s' },
  STORYTELLING:    { label: 'Storytelling',        emoji: '📖', bg: '#FEF3C7', color: '#92400E', duration: '90s' },
  DAILY_TIP:       { label: 'Conseil du jour',     emoji: '💡', bg: '#DCFCE7', color: '#15803D', duration: '35s' },
  MYTH_VS_REALITY: { label: 'Mythe vs Réalité',    emoji: '🪞', bg: '#DBEAFE', color: '#1E40AF', duration: '60s' },
}

const COACHING_TIPS: Record<ContentFormat, string> = {
  HOT_TAKE:        "Commence par l'opinion. Pas le contexte.",
  STORYTELLING:    "Commence au milieu de l'histoire. Pas depuis le début.",
  QUESTION_BOX:    "Réponds naturellement — ne performe pas.",
  TELEPROMPTER:    "Lis en parlant, pas en récitant.",
  DAILY_TIP:       "Donne l'exemple concret avant la règle.",
  MYTH_VS_REALITY: "Cite la croyance exacte avant de la démolir.",
}

// ─── Beat edit row ─────────────────────────────────────────────────────────────

function BeatRow({ index, value, editing, onChange }: {
  index: number; value: string; editing: boolean; onChange: (v: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [editing, value])

  return (
    <div style={{
      background: T.surface, borderRadius: 16,
      padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: editing ? T.primary : T.ink,
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 2,
        transition: 'background 0.15s',
      }}>
        {index + 1}
      </div>
      {editing ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
          rows={1}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 14, color: T.ink, lineHeight: 1.6, resize: 'none',
            fontFamily: 'inherit', overflow: 'hidden',
          }}
        />
      ) : (
        <p style={{ flex: 1, fontSize: 14, color: T.ink, lineHeight: 1.6, margin: 0 }}>
          {value}
        </p>
      )}
    </div>
  )
}

// ─── Action buttons (shared between mobile bar and desktop panel) ─────────────

function TournerButton({ canTourner, filming, currentStatus, onClick }: {
  canTourner: boolean; filming: boolean; currentStatus: TopicStatus; onClick: () => void
}) {
  if (!canTourner) return null
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={filming}
      style={{
        background: T.primary, color: '#fff', border: 'none', borderRadius: 18,
        padding: '18px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        letterSpacing: -0.2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        opacity: filming ? 0.6 : 1, minHeight: 56, width: '100%',
        transition: 'opacity 0.15s, transform 0.1s',
      }}
    >
      {filming
        ? <><Loader2 size={16} className="animate-spin" /> Chargement…</>
        : <>{currentStatus === 'FILMING' ? '▶ Continuer le tournage' : '▶ On tourne maintenant'}</>
      }
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SubjectDetail({ id, name, status, format, script, threadId, brief, latestSessionId }: Props) {
  const router = useRouter()

  useEffect(() => {
    document.body.setAttribute('data-sujet-detail', '')
    return () => { document.body.removeAttribute('data-sujet-detail') }
  }, [])

  const [currentStatus, setCurrentStatus] = useState(status)
  const [currentScript, setCurrentScript] = useState<Script | null>(script)
  const [editing, setEditing] = useState(false)
  const [editBullets, setEditBullets] = useState<string[]>(script?.bullets ?? [])
  const [editTeleprompter, setEditTeleprompter] = useState(script?.teleprompterScript ?? '')
  const [saving, setSaving] = useState(false)
  const [filming, setFilming] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const fmt = format ? FORMAT_META[format] : null
  const coachingTip = format ? (COACHING_TIPS[format] ?? 'Prépare-toi. Lance.') : null

  const handleSaveScript = useCallback(async () => {
    setSaving(true)
    try {
      const newScript: Script = currentScript?.scriptType === 'teleprompter'
        ? { scriptType: 'teleprompter', teleprompterScript: editTeleprompter }
        : { scriptType: 'bullets', bullets: editBullets }
      const res = await fetch(`/api/topics/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ script: newScript }),
      })
      if (res.ok) { setCurrentScript(newScript); setEditing(false) }
    } finally { setSaving(false) }
  }, [id, currentScript, editBullets, editTeleprompter])

  const handleCancelEdit = useCallback(() => {
    setEditBullets(currentScript?.bullets ?? [])
    setEditTeleprompter(currentScript?.teleprompterScript ?? '')
    setEditing(false)
  }, [currentScript])

  const handleTourner = useCallback(async () => {
    setFilming(true)
    try {
      if (latestSessionId && currentStatus === 'FILMING') {
        router.push(`/s/${latestSessionId}`); return
      }
      const scriptData = currentScript
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          topicId: id, format: format ?? 'QUESTION_BOX', title: name,
          questions: scriptData?.scriptType === 'bullets' && scriptData.bullets
            ? scriptData.bullets.map((b, i) => ({ text: b, hint: null, order: i })) : undefined,
          teleprompterScript: scriptData?.scriptType === 'teleprompter' ? scriptData.teleprompterScript : undefined,
        }),
      })
      if (!sessionRes.ok) return
      const session = await sessionRes.json()
      await fetch(`/api/topics/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status: 'FILMING' }),
      })
      setCurrentStatus('FILMING')
      router.push(`/s/${session.id}`)
    } finally { setFilming(false) }
  }, [id, name, format, currentScript, currentStatus, latestSessionId, router])

  const handleArchive = useCallback(async () => {
    await fetch(`/api/topics/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ status: 'ARCHIVED' }),
    })
    router.push('/sujets')
  }, [id, router])

  const handleMarkDone = useCallback(async () => {
    await fetch(`/api/topics/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ status: 'DONE' }),
    })
    setCurrentStatus('DONE')
  }, [id])

  const onTopicMutated = useCallback(() => {
    router.refresh(); setDrawerOpen(false)
  }, [router])

  const statusConfig = (() => {
    switch (currentStatus) {
      case 'READY':    return { label: 'À tourner',  dot: '#F59E0B' }
      case 'FILMING':  return { label: 'En cours',   dot: '#EF4444' }
      case 'DONE':     return { label: 'Terminé',    dot: '#22C55E' }
      case 'ARCHIVED': return { label: 'Archivé',    dot: '#A1A1AA' }
      default:         return { label: 'Brouillon',  dot: '#A1A1AA' }
    }
  })()

  const canTourner = currentStatus !== 'DONE' && currentStatus !== 'ARCHIVED'

  // ─── Shared section: coaching + script ─────────────────────────────────────

  const contentSection = (
    <>
      {/* Coaching Kabou */}
      {coachingTip && (currentStatus === 'READY' || currentStatus === 'FILMING' || currentStatus === 'DRAFT') && (
        <div style={{
          borderRadius: 16, padding: '14px 16px',
          background: '#FFF7F0',
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <div>
            <p style={{ fontSize: 10, color: T.primary, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 4px' }}>
              Coaching Kabou
            </p>
            <p style={{ fontSize: 14, color: T.ink, fontWeight: 500, lineHeight: 1.55, margin: 0 }}>
              {coachingTip}
            </p>
          </div>
        </div>
      )}

      {/* Script section */}
      {currentScript ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: T.muted, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', margin: 0 }}>
              {currentScript.scriptType === 'bullets'
                ? `Script · ${currentScript.bullets?.length ?? 0} beats`
                : 'Script'}
            </p>
            {!editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditBullets(currentScript.bullets ?? [])
                  setEditTeleprompter(currentScript.teleprompterScript ?? '')
                  setEditing(true)
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 13, color: T.muted, fontWeight: 600,
                  padding: '8px 10px', minHeight: 40, borderRadius: 10,
                }}
              >
                <Pencil size={14} /> Modifier
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: T.muted, padding: '8px', minHeight: 40, minWidth: 40,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10,
                  }}
                  aria-label="Annuler"
                >
                  <X size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleSaveScript}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: T.primary, fontWeight: 700,
                    padding: '8px 10px', minHeight: 40, borderRadius: 10,
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Sauvegarder
                </button>
              </div>
            )}
          </div>

          {currentScript.scriptType === 'bullets' && currentScript.bullets ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(editing ? editBullets : currentScript.bullets).map((b, i) => (
                <BeatRow
                  key={i} index={i} value={b} editing={editing}
                  onChange={(v) => {
                    const next = [...editBullets]; next[i] = v; setEditBullets(next)
                  }}
                />
              ))}
            </div>
          ) : (
            editing ? (
              <textarea
                value={editTeleprompter}
                onChange={(e) => setEditTeleprompter(e.target.value)}
                rows={8}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: T.surface,
                  borderRadius: 16, padding: '14px 16px',
                  fontSize: 14, color: T.ink, lineHeight: 1.65,
                  fontFamily: 'inherit', resize: 'none', outline: 'none',
                }}
              />
            ) : (
              <div style={{
                background: T.surface, borderRadius: 16,
                padding: '16px',
              }}>
                <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {currentScript.teleprompterScript}
                </p>
              </div>
            )
          )}
        </div>
      ) : (
        <div style={{
          background: T.surface, borderRadius: 18,
          padding: '32px 24px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          <p style={{ fontSize: 15, color: T.muted, margin: 0, fontWeight: 500 }}>
            Pas encore de script pour ce sujet.
          </p>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            style={{
              background: T.primary, color: '#fff', border: 'none', borderRadius: 14,
              padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Demander à Kabou →
          </button>
        </div>
      )}
    </>
  )

  // ─── Shared section: secondary actions ─────────────────────────────────────

  const secondaryActions = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        style={{
          flex: 1, background: T.surface, color: T.ink,
          border: `1px solid ${T.border}`, borderRadius: 16,
          padding: '14px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          minHeight: 52,
        }}
      >
        <Image src="/lavi-robot.png" alt="" width={18} height={18} className="rounded-full" />
        Retravailler avec Kabou
      </button>

      {currentStatus === 'FILMING' && (
        <button
          type="button"
          onClick={handleMarkDone}
          style={{
            background: T.surface, color: '#22C55E',
            border: '1px solid rgba(34,197,94,0.3)', borderRadius: 16,
            padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            whiteSpace: 'nowrap', minHeight: 52,
          }}
        >
          ✅ Terminé
        </button>
      )}

      {(currentStatus === 'READY' || currentStatus === 'DONE') && (
        <button
          type="button"
          onClick={handleArchive}
          style={{
            background: T.surface, color: T.muted,
            border: `1px solid ${T.border}`, borderRadius: 16,
            padding: '14px', fontSize: 13, cursor: 'pointer',
            minHeight: 52, aspectRatio: '1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Archiver"
        >
          🗄
        </button>
      )}
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="mx-auto w-full min-h-dvh max-w-2xl md:max-w-[920px]" style={{ background: T.bg }}>

        {/* ── Sticky header ─────────────────────────────────────────── */}
        <div
          className="sticky top-0 z-20"
          style={{
            background: 'rgba(250,250,247,0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            paddingLeft: 18, paddingRight: 18, paddingBottom: 14,
          }}
        >
          {/* Back + Kabou */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Link
              href="/sujets"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 16, color: T.primary, fontWeight: 700,
                textDecoration: 'none', minHeight: 44, paddingRight: 12, marginLeft: -4,
              }}
            >
              <ChevronLeft size={22} strokeWidth={2.5} />
              Sujets
            </Link>
            <Image src="/lavi-robot.png" alt="Kabou" width={32} height={32} className="rounded-full object-cover" />
          </div>

          {/* Format + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {fmt && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 700, borderRadius: 999,
                padding: '4px 10px', background: fmt.bg, color: fmt.color,
                letterSpacing: 0.1,
              }}>
                {fmt.emoji} {fmt.label} · {fmt.duration}
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: statusConfig.dot }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusConfig.dot, display: 'inline-block' }} />
              {statusConfig.label}
            </span>
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: 0, lineHeight: 1.15, letterSpacing: -0.5 }}>
            {name}
          </h1>
        </div>

        {/* ── Content area: single col mobile / two-col desktop ─────── */}
        <div className="md:grid md:grid-cols-[1fr_272px] md:items-start">

          {/* Left: coaching + script */}
          <div
            className="md:pb-12 md:pr-2"
            style={{ padding: '20px 18px', paddingBottom: 160, display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {contentSection}
          </div>

          {/* Right: desktop-only action panel */}
          <aside
            className="hidden md:flex md:flex-col md:gap-3 md:sticky"
            style={{
              top: 0,
              padding: '20px 18px 20px 4px',
              minHeight: '100%',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Primary CTA */}
              <TournerButton
                canTourner={canTourner}
                filming={filming}
                currentStatus={currentStatus}
                onClick={handleTourner}
              />

              {/* Retravailler */}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                style={{
                  background: T.surface, color: T.ink,
                  borderRadius: 16,
                  padding: '14px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  minHeight: 52, width: '100%',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <Image src="/lavi-robot.png" alt="" width={18} height={18} className="rounded-full" />
                Retravailler avec Kabou
              </button>

              {/* Mark done */}
              {currentStatus === 'FILMING' && (
                <button
                  type="button"
                  onClick={handleMarkDone}
                  style={{
                    background: T.surface, color: '#22C55E',
                    borderRadius: 16,
                    padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    minHeight: 52, width: '100%',
                  }}
                >
                  ✅ Marquer comme terminé
                </button>
              )}

              {/* Archive */}
              {(currentStatus === 'READY' || currentStatus === 'DONE') && (
                <button
                  type="button"
                  onClick={handleArchive}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: T.muted, padding: '8px',
                    textAlign: 'center', width: '100%', fontWeight: 500,
                  }}
                >
                  Archiver ce sujet
                </button>
              )}

              {/* Voir enregistrement */}
              {currentStatus === 'DONE' && latestSessionId && (
                <a
                  href={`/s/${latestSessionId}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, color: T.muted, fontWeight: 500, textDecoration: 'none',
                    padding: '8px', gap: 4,
                  }}
                >
                  ▶ Voir l&apos;enregistrement
                </a>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ── Mobile-only fixed bottom bar ────────────────────────────── */}
      <div
        className="md:hidden flex flex-col"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          maxWidth: 672, margin: '0 auto',
          background: 'rgba(250,250,247,0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '12px 18px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          gap: 8, zIndex: 10,
        }}
      >
        <TournerButton
          canTourner={canTourner}
          filming={filming}
          currentStatus={currentStatus}
          onClick={handleTourner}
        />
        {secondaryActions}

        {currentStatus === 'DONE' && latestSessionId && (
          <a
            href={`/s/${latestSessionId}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: T.muted, fontWeight: 500, textDecoration: 'none',
              padding: '4px 0',
            }}
          >
            ▶ Voir l&apos;enregistrement
          </a>
        )}
      </div>

      {/* ── Kabou drawer ─────────────────────────────────────────────── */}
      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Portal>
          <Drawer.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} />
          <Drawer.Content style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
            background: T.surface, borderRadius: '22px 22px 0 0',
            display: 'flex', flexDirection: 'column',
            height: '88dvh',
            maxWidth: 672, margin: '0 auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.12)' }} />
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <SubjectKabouPanel
                topicId={id}
                threadId={threadId}
                subjectName={name}
                contextBrief={brief}
                onTopicMutated={onTopicMutated}
                onBack={() => setDrawerOpen(false)}
              />
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}
