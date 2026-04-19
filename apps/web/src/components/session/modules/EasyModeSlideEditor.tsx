'use client'

import { useState } from 'react'
import { Play, Sparkles, Loader2, RefreshCw, X, Palette, Check } from 'lucide-react'
import type { IntroSettings, OutroSettings, TransitionTheme, AudioSettings } from '@/remotion/themeTypes'
import { FONT_OPTIONS } from '@/remotion/themeTypes'
import type { SoundLibraryItem } from './BookendsModule'

// ─── Easy-mode design tokens (aligned with EasyModePanel) ────────────────────

const C = {
  accent: '#FF4D1C',
  accentBg: 'rgba(255,77,28,0.06)',
  text: '#111827',
  textSec: '#6B7280',
  textDim: '#9CA3AF',
  border: '#F3F4F6',
  borderStrong: '#E5E7EB',
  surface: '#F9FAFB',
  bg: '#FFFFFF',
  toggleOn: '#FF4D1C',
  toggleOff: '#E5E7EB',
}

const BG_PATTERNS: { value: string; label: string }[] = [
  { value: 'solid', label: 'Uni' }, { value: 'dots', label: 'Points' }, { value: 'grid', label: 'Grille' },
  { value: 'diagonal', label: 'Diagonales' }, { value: 'radial', label: 'Radial' }, { value: 'noise', label: 'Bruit' },
  { value: 'confetti', label: 'Confetti' }, { value: 'stripes', label: 'Stripes' }, { value: 'scanlines', label: 'Scanlines' },
  { value: 'gradient-sweep', label: 'Sweep' }, { value: 'aurora', label: 'Aurora' }, { value: 'halftone', label: 'Halftone' },
  { value: 'vhs', label: 'VHS' }, { value: 'plasma', label: 'Plasma' }, { value: 'synthwave', label: 'Synthwave' },
  { value: 'burst', label: 'Burst' }, { value: 'liquid', label: 'Liquid' }, { value: 'eq', label: 'EQ' },
]

const TEXT_ANIMATIONS: { value: string; label: string }[] = [
  { value: 'spring-up', label: 'Spring' }, { value: 'flash', label: 'Flash' }, { value: 'typewriter', label: 'Typewriter' },
  { value: 'word-stack', label: 'Word Stack' }, { value: 'zoom-blast', label: 'Zoom Blast' }, { value: 'glitch', label: 'Glitch' },
  { value: 'scramble', label: 'Scramble' }, { value: 'letter-stack', label: 'Letter Stack' }, { value: 'highlight', label: 'Highlight' },
  { value: 'flip-3d', label: 'Flip 3D' }, { value: 'neon-flicker', label: 'Neon' }, { value: 'blur-reveal', label: 'Blur Reveal' },
  { value: 'stamp', label: 'Stamp' }, { value: 'wave', label: 'Wave' }, { value: 'cascade', label: 'Cascade' }, { value: 'split-reveal', label: 'Split' },
]

const DECORATORS: { value: string; label: string }[] = [
  { value: 'none', label: 'Aucun' },
  { value: 'ticker', label: '📺 Ticker' },
  { value: 'frame-border', label: '⬜ Cadre' },
  { value: 'corner-label', label: '📌 Coin' },
]

// ─── Primitives ──────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 600, color: C.textSec,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      margin: '0 0 6px',
    }}>
      {children}
    </p>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
      background: on ? C.toggleOn : C.toggleOff, transition: 'background 0.2s',
      position: 'relative', flexShrink: 0, padding: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2, left: on ? 20 : 2,
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }} />
    </button>
  )
}

function TextInput(props: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      style={{
        width: '100%', background: C.bg, border: `1px solid ${C.borderStrong}`,
        borderRadius: 10, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none',
      }}
    />
  )
}

function SliderRow(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Label>{props.label}</Label>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.text }}>{props.format(props.value)}</span>
      </div>
      <input
        type="range" min={props.min} max={props.max} step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: C.accent }}
      />
    </div>
  )
}

function PillGroup(props: {
  options: { value: string; label: string }[]
  selected: string
  onSelect: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {props.options.map(opt => {
        const active = opt.value === props.selected
        return (
          <button
            key={opt.value}
            onClick={() => props.onSelect(opt.value)}
            style={{
              padding: '6px 12px', borderRadius: 20,
              fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
              background: active ? C.accentBg : C.surface,
              border: `1px solid ${active ? C.accent : C.border}`,
              color: active ? C.accent : C.textSec,
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function ColorInput(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{props.label}</Label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          style={{
            width: 34, height: 34, borderRadius: 8,
            border: `1px solid ${C.borderStrong}`, background: 'transparent', cursor: 'pointer',
            padding: 0,
          }}
        />
        <input
          type="text"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          style={{
            flex: 1, background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12, fontFamily: 'monospace',
            outline: 'none',
          }}
        />
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  target: 'intro' | 'outro'
  data: IntroSettings | OutroSettings
  setData: React.Dispatch<React.SetStateAction<any>>
  theme: TransitionTheme
  audioSettings: AudioSettings
  setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>
  soundLibrary: SoundLibraryItem[]
  soundPreviewAudioRef: React.MutableRefObject<HTMLAudioElement | null>
  /** Intro only — fetches 3 AI hook suggestions based on video content */
  onRequestHookSuggestions?: () => Promise<string[]>
  /** Imports the user's brand kit (logo + colors + font) adapted to intro/outro */
  onApplyBrandKit?: (target: 'intro' | 'outro') => Promise<{ ok: boolean; message?: string }>
}

export function EasyModeSlideEditor({
  target, data, setData, theme,
  audioSettings, setAudioSettings,
  soundLibrary, soundPreviewAudioRef,
  onRequestHookSuggestions,
  onApplyBrandKit,
}: Props) {
  const [hookSuggestions, setHookSuggestions] = useState<string[] | null>(null)
  const [hookLoading, setHookLoading] = useState(false)
  const [hookError, setHookError] = useState<string | null>(null)
  const [brandKitStatus, setBrandKitStatus] = useState<'idle' | 'loading' | 'applied' | 'error'>('idle')
  const [brandKitError, setBrandKitError] = useState<string | null>(null)

  const applyBrandKit = async () => {
    if (!onApplyBrandKit) return
    setBrandKitStatus('loading')
    setBrandKitError(null)
    try {
      const res = await onApplyBrandKit(target)
      if (res.ok) {
        setBrandKitStatus('applied')
        setTimeout(() => setBrandKitStatus('idle'), 2500)
      } else {
        setBrandKitStatus('error')
        setBrandKitError(res.message ?? 'Brand kit indisponible')
      }
    } catch (e: any) {
      setBrandKitStatus('error')
      setBrandKitError(e?.message ?? 'Erreur lors de l\'application')
    }
  }

  const fetchHookSuggestions = async () => {
    if (!onRequestHookSuggestions) return
    setHookLoading(true)
    setHookError(null)
    try {
      const hooks = await onRequestHookSuggestions()
      setHookSuggestions(hooks)
    } catch (e: any) {
      setHookError(e?.message ?? 'Impossible de générer des suggestions')
    } finally {
      setHookLoading(false)
    }
  }

  const sfxKey = target === 'intro' ? 'introSfx' : 'outroSfx'
  const soundTag = target === 'intro' ? 'INTRO' : 'OUTRO'
  const sounds = soundLibrary.filter(s => s.tag === soundTag)
  const activeSfx = audioSettings[sfxKey as keyof AudioSettings] as
    | { prompt: string; url: string; volume: number }
    | undefined

  const custom = data as any

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Enable toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderRadius: 10,
        background: C.surface, border: `1px solid ${C.border}`,
      }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0 }}>
            Slide {target === 'intro' ? 'intro' : 'outro'} activée
          </p>
          <p style={{ fontSize: 11, color: C.textDim, margin: '2px 0 0' }}>
            {data.enabled ? 'Incluse dans l\'export' : 'Masquée de l\'export'}
          </p>
        </div>
        <Toggle on={data.enabled} onClick={() => setData((p: any) => ({ ...p, enabled: !p.enabled }))} />
      </div>

      {!data.enabled ? null : (
        <>
          {/* Target-specific text */}
          {target === 'intro' ? (
            <>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Label>Phrase d'accroche</Label>
                  {onRequestHookSuggestions && (
                    <button
                      onClick={fetchHookSuggestions}
                      disabled={hookLoading}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600,
                        color: C.accent, background: C.accentBg,
                        border: `1px solid ${C.accent}33`, borderRadius: 7,
                        padding: '4px 8px', cursor: hookLoading ? 'default' : 'pointer',
                        marginBottom: 6,
                      }}
                    >
                      {hookLoading
                        ? <Loader2 size={11} className="animate-spin" />
                        : hookSuggestions ? <RefreshCw size={11} /> : <Sparkles size={11} />
                      }
                      {hookLoading
                        ? 'Génération…'
                        : hookSuggestions ? 'Régénérer' : 'Suggestions IA'
                      }
                    </button>
                  )}
                </div>
                <TextInput
                  value={(data as IntroSettings).hookText}
                  onChange={(v) => setData((p: IntroSettings) => ({ ...p, hookText: v }))}
                  placeholder="Ce que personne ne te dit sur..."
                />
                {hookError && (
                  <p style={{ fontSize: 11, color: '#EF4444', margin: '6px 0 0' }}>{hookError}</p>
                )}
                {hookSuggestions && hookSuggestions.length > 0 && (
                  <div style={{
                    marginTop: 8, padding: 10, borderRadius: 10,
                    background: C.accentBg, border: `1px solid ${C.accent}22`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.accent, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Sparkles size={11} /> Suggestions IA
                      </span>
                      <button
                        onClick={() => setHookSuggestions(null)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textDim, padding: 2, display: 'flex' }}
                        aria-label="Fermer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {hookSuggestions.map((h, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setData((p: IntroSettings) => ({ ...p, hookText: h }))
                            setHookSuggestions(null)
                          }}
                          style={{
                            textAlign: 'left', padding: '9px 12px', borderRadius: 8,
                            background: C.bg, border: `1px solid ${C.border}`,
                            cursor: 'pointer', fontSize: 13, color: C.text,
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}
                        >
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: C.accent, background: C.accentBg,
                            padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace',
                          }}>
                            {i + 1}
                          </span>
                          <span style={{ flex: 1 }}>{h}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label>URL du logo (optionnel)</Label>
                <TextInput
                  value={(data as IntroSettings).logoUrl}
                  onChange={(v) => setData((p: IntroSettings) => ({ ...p, logoUrl: v }))}
                  placeholder="https://..."
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>CTA principal</Label>
                <TextInput
                  value={(data as OutroSettings).ctaText}
                  onChange={(v) => setData((p: OutroSettings) => ({ ...p, ctaText: v }))}
                  placeholder="Abonne-toi pour plus de contenu 🔥"
                />
                <p style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace', marginTop: 6 }}>
                  Phrase courte · action directe · max 8 mots
                </p>
              </div>
              <div>
                <Label>Texte secondaire</Label>
                <TextInput
                  value={(data as OutroSettings).subText}
                  onChange={(v) => setData((p: OutroSettings) => ({ ...p, subText: v }))}
                  placeholder="@tonhandle · Commente si tu veux la suite"
                />
              </div>
              <div>
                <Label>URL du logo (optionnel)</Label>
                <TextInput
                  value={(data as OutroSettings).logoUrl}
                  onChange={(v) => setData((p: OutroSettings) => ({ ...p, logoUrl: v }))}
                  placeholder="https://..."
                />
              </div>
            </>
          )}

          {/* Duration */}
          <SliderRow
            label="Durée"
            value={data.durationSeconds}
            min={2} max={6} step={0.5}
            format={(v) => `${v}s`}
            onChange={(v) => setData((p: any) => ({ ...p, durationSeconds: v }))}
          />

          {/* Style customisation (always visible) */}
          <div style={{
            borderTop: `1px solid ${C.border}`, paddingTop: 14,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>Personnaliser le style</p>
              {onApplyBrandKit && (
                <button
                  onClick={applyBrandKit}
                  disabled={brandKitStatus === 'loading'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 600,
                    color: brandKitStatus === 'applied' ? '#059669' : C.accent,
                    background: brandKitStatus === 'applied' ? 'rgba(52,211,153,0.1)' : C.accentBg,
                    border: `1px solid ${brandKitStatus === 'applied' ? 'rgba(52,211,153,0.3)' : C.accent + '33'}`,
                    borderRadius: 7, padding: '5px 10px',
                    cursor: brandKitStatus === 'loading' ? 'default' : 'pointer',
                  }}
                >
                  {brandKitStatus === 'loading'
                    ? <Loader2 size={12} className="animate-spin" />
                    : brandKitStatus === 'applied' ? <Check size={12} /> : <Palette size={12} />
                  }
                  {brandKitStatus === 'loading' && 'Application…'}
                  {brandKitStatus === 'applied' && 'Appliqué'}
                  {(brandKitStatus === 'idle' || brandKitStatus === 'error') && 'Appliquer brand kit'}
                </button>
              )}
            </div>
            {brandKitError && (
              <p style={{ fontSize: 11, color: '#EF4444', margin: 0 }}>{brandKitError}</p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <ColorInput
                label="Fond"
                value={custom.bgColor || theme.backgroundColor}
                onChange={(v) => setData((p: any) => ({ ...p, bgColor: v, preset: 'custom' }))}
              />
              <ColorInput
                label="Accent"
                value={custom.accentColor || theme.textColor}
                onChange={(v) => setData((p: any) => ({ ...p, accentColor: v, preset: 'custom' }))}
              />
              <ColorInput
                label="Texte"
                value={custom.textColor || custom.accentColor || theme.textColor}
                onChange={(v) => setData((p: any) => ({ ...p, textColor: v, preset: 'custom' }))}
              />
            </div>

            <div>
              <Label>Motif de fond</Label>
              <PillGroup
                options={BG_PATTERNS}
                selected={custom.bgPattern || 'solid'}
                onSelect={(v) => setData((p: any) => ({ ...p, bgPattern: v, preset: 'custom' }))}
              />
            </div>

            <div>
              <Label>Animation du texte</Label>
              <PillGroup
                options={TEXT_ANIMATIONS}
                selected={custom.textAnimation || 'spring-up'}
                onSelect={(v) => setData((p: any) => ({ ...p, textAnimation: v, preset: 'custom' }))}
              />
            </div>

            <SliderRow
              label="Taille du texte"
              value={custom.textSize || (target === 'intro' ? 72 : 68)}
              min={32} max={120} step={4}
              format={(v) => `${v}px`}
              onChange={(v) => setData((p: any) => ({ ...p, textSize: v }))}
            />

            <SliderRow
              label="Taille du logo"
              value={custom.logoSize || (target === 'intro' ? 64 : 56)}
              min={32} max={200} step={8}
              format={(v) => `${v}px`}
              onChange={(v) => setData((p: any) => ({ ...p, logoSize: v }))}
            />

            <div>
              <Label>Police</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {FONT_OPTIONS.map(f => {
                  const active = (custom.fontFamily || theme.fontFamily) === f.value
                  return (
                    <button
                      key={f.value}
                      onClick={() => setData((p: any) => ({ ...p, fontFamily: f.value, fontWeight: f.weight }))}
                      style={{
                        padding: '6px 12px', borderRadius: 20,
                        fontSize: 12, fontFamily: f.value, cursor: 'pointer',
                        background: active ? C.accentBg : C.surface,
                        border: `1px solid ${active ? C.accent : C.border}`,
                        color: active ? C.accent : C.textSec,
                      }}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Label>Décorateur</Label>
              <PillGroup
                options={DECORATORS}
                selected={custom.decorator || 'none'}
                onSelect={(v) => setData((p: any) => ({ ...p, decorator: v, preset: 'custom' }))}
              />
            </div>

            {custom.decorator && custom.decorator !== 'none' && (
              <div>
                <Label>{custom.decorator === 'ticker' ? 'Texte du ticker' : 'Texte du coin'}</Label>
                <TextInput
                  value={custom.decoratorText || ''}
                  onChange={(v) => setData((p: any) => ({ ...p, decoratorText: v }))}
                  placeholder={custom.decorator === 'ticker' ? 'Ex: @monhandle · LAVIDZ' : 'Ex: EP.01'}
                />
              </div>
            )}
          </div>

          {/* Intro/outro SFX */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 10px' }}>
              Son d'{target === 'intro' ? 'intro' : 'outro'}
            </p>
            {sounds.length === 0 ? (
              <p style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>
                Aucun son « {target === 'intro' ? 'Intro' : 'Outro'} » — ajoutez-en depuis l'admin.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sounds.map(s => {
                  const isActive = activeSfx?.prompt === s.id
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => setAudioSettings(p => ({
                          ...p,
                          [sfxKey]: isActive ? undefined : { prompt: s.id, url: `/api/admin/sounds/${s.id}/audio`, volume: 1 },
                        }))}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '9px 12px', borderRadius: 10, textAlign: 'left',
                          background: isActive ? C.accentBg : C.surface,
                          border: `1px solid ${isActive ? C.accent : C.border}`,
                          color: isActive ? C.accent : C.text, fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        <span>{s.name}</span>
                        {isActive && <span style={{ fontSize: 10, fontFamily: 'monospace', opacity: 0.7 }}>actif</span>}
                      </button>
                      <button
                        onClick={() => {
                          if (soundPreviewAudioRef.current) {
                            soundPreviewAudioRef.current.pause()
                            soundPreviewAudioRef.current = null
                          }
                          const a = new Audio(s.signedUrl)
                          soundPreviewAudioRef.current = a
                          a.onended = () => { soundPreviewAudioRef.current = null }
                          a.play()
                        }}
                        style={{
                          padding: '9px 11px', borderRadius: 10,
                          background: C.surface, border: `1px solid ${C.border}`,
                          color: C.textSec, display: 'flex', alignItems: 'center', cursor: 'pointer',
                        }}
                      >
                        <Play size={12} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            {activeSfx?.url && (
              <div style={{ marginTop: 12 }}>
                <SliderRow
                  label="Volume"
                  value={Math.round((activeSfx.volume ?? 1) * 100)}
                  min={0} max={100} step={5}
                  format={(v) => `${v}%`}
                  onChange={(v) => setAudioSettings(p => ({ ...p, [sfxKey]: { ...activeSfx, volume: v / 100 } }))}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
