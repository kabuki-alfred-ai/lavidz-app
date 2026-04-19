'use client'

import { Play } from 'lucide-react'
import type { IntroSettings, OutroSettings, TransitionTheme, AudioSettings } from '@/remotion/themeTypes'
import { FONT_OPTIONS, SLIDE_PRESETS } from '@/remotion/themeTypes'
import type { SlidePreset } from '@/remotion/themeTypes'
import { S, Card, Label, Toggle, SliderRow, Section } from '@/components/session/process-view-utils'

const PRESET_UI = [
  { id: 'konbini',  label: 'Konbini',   emoji: '🔴', bg: '#FF2D55', accent: '#FFD60A' },
  { id: 'brut',     label: 'Brut',      emoji: '⬛', bg: '#000000', accent: '#FFFFFF' },
  { id: 'magazine', label: 'Magazine',  emoji: '📰', bg: '#F5F0E8', accent: '#1A1209' },
  { id: 'neon',     label: 'Neon',      emoji: '💚', bg: '#0D0D0D', accent: '#00FF88' },
  { id: 'viral',    label: 'Viral',     emoji: '🔥', bg: '#FF6B00', accent: '#FFFFFF' },
  { id: 'minimal',  label: 'Minimal',   emoji: '⬜', bg: '#FFFFFF', accent: '#0A0A0A' },
  { id: 'cinema',   label: 'Cinema',    emoji: '🎬', bg: '#0A0A0A', accent: '#D4AF37' },
  { id: 'retro',    label: 'Rétro',     emoji: '📼', bg: '#1A0A2E', accent: '#FF6EFF' },
  { id: 'editorial',label: 'Editorial', emoji: '📰', bg: '#FAFAFA', accent: '#111111' },
] as const

const BG_PATTERNS = [
  { value: 'solid', label: 'Uni' }, { value: 'dots', label: 'Points' }, { value: 'grid', label: 'Grille' },
  { value: 'diagonal', label: 'Diagonales' }, { value: 'radial', label: 'Radial' }, { value: 'noise', label: 'Bruit' },
  { value: 'confetti', label: 'Confetti' }, { value: 'stripes', label: 'Stripes' }, { value: 'scanlines', label: 'Scanlines' },
  { value: 'gradient-sweep', label: 'Sweep' }, { value: 'aurora', label: 'Aurora' }, { value: 'halftone', label: 'Halftone' },
  { value: 'vhs', label: 'VHS' }, { value: 'plasma', label: '🫧 Plasma' }, { value: 'synthwave', label: '🌅 Synthwave' },
  { value: 'burst', label: '✳ Burst' }, { value: 'liquid', label: '🫠 Liquid' }, { value: 'eq', label: '🎚 EQ' },
] as { value: string; label: string }[]

const TEXT_ANIMATIONS = [
  { value: 'spring-up', label: 'Spring' }, { value: 'flash', label: 'Flash' }, { value: 'typewriter', label: 'Typewriter' },
  { value: 'word-stack', label: 'Word Stack' }, { value: 'zoom-blast', label: 'Zoom Blast' }, { value: 'glitch', label: 'Glitch' },
  { value: 'scramble', label: 'Scramble' }, { value: 'letter-stack', label: 'Letter Stack' }, { value: 'highlight', label: 'Highlight' },
  { value: 'flip-3d', label: 'Flip 3D' }, { value: 'neon-flicker', label: 'Neon' }, { value: 'blur-reveal', label: 'Blur Reveal' },
  { value: 'stamp', label: 'Stamp' }, { value: 'wave', label: 'Wave' }, { value: 'cascade', label: 'Cascade' }, { value: 'split-reveal', label: 'Split' },
] as { value: string; label: string }[]

export interface SoundLibraryItem { id: string; name: string; tag: string; signedUrl: string }

interface BookendsModuleProps {
  bookendTarget: 'intro' | 'outro'
  setBookendTarget: (v: 'intro' | 'outro') => void
  intro: IntroSettings
  setIntro: React.Dispatch<React.SetStateAction<IntroSettings>>
  outro: OutroSettings
  setOutro: React.Dispatch<React.SetStateAction<OutroSettings>>
  theme: TransitionTheme
  audioSettings: AudioSettings
  setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>
  hoveredIntroPreset: string | null
  setHoveredIntroPreset: (v: string | null) => void
  hoveredOutroPreset: string | null
  setHoveredOutroPreset: (v: string | null) => void
  soundLibrary: SoundLibraryItem[]
  soundPreviewAudioRef: React.MutableRefObject<HTMLAudioElement | null>
}

export function SlideEditor({ target, data, setData, theme, audioSettings, setAudioSettings, hoveredPreset, setHoveredPreset, soundLibrary, soundPreviewAudioRef }: {
  target: 'intro' | 'outro'
  data: IntroSettings | OutroSettings
  setData: React.Dispatch<React.SetStateAction<any>>
  theme: TransitionTheme
  audioSettings: AudioSettings
  setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>
  hoveredPreset: string | null
  setHoveredPreset: (v: string | null) => void
  soundLibrary: SoundLibraryItem[]
  soundPreviewAudioRef: React.MutableRefObject<HTMLAudioElement | null>
}) {
  const sfxKey = target === 'intro' ? 'introSfx' : 'outroSfx'
  const sounds = soundLibrary.filter(s => s.tag === (target === 'intro' ? 'INTRO' : 'OUTRO'))
  const activeSfx = audioSettings[sfxKey as keyof AudioSettings] as { prompt: string; url: string; volume: number } | undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: data.enabled ? 20 : 0 }}>
          <div>
            <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>{target === 'intro' ? "Slide d'introduction" : "Slide d'outro"}</p>
            <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>{target === 'intro' ? 'Accroche avant le premier clip' : 'CTA final après le dernier clip'}</p>
          </div>
          <Toggle value={data.enabled} onChange={v => setData((p: any) => ({ ...p, enabled: v }))} />
        </div>

        {data.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Presets */}
            <div>
              <Label>Style médias</Label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {PRESET_UI.map(p => {
                  const selected = (data as any).preset === p.id
                  return (
                    <button key={p.id} onClick={() => { const config = SLIDE_PRESETS[p.id as Exclude<SlidePreset, 'custom'>]; if (config) setData((prev: any) => ({ ...prev, ...config, preset: p.id })) }}
                      onMouseEnter={() => setHoveredPreset(p.id)}
                      onMouseLeave={() => setHoveredPreset(null)}
                      style={{
                        padding: '10px 6px', borderRadius: 10, textAlign: 'center',
                        background: selected ? p.bg : hoveredPreset === p.id ? S.surfaceHover : S.surface,
                        border: `2px solid ${selected ? p.accent : hoveredPreset === p.id ? S.borderHover : S.border}`,
                        transition: 'all 0.15s',
                      }}
                      // Override: apply preset directly
                      ref={null}
                    >
                      <div style={{ fontSize: 18, marginBottom: 2 }}>{p.emoji}</div>
                      <div style={{ color: selected ? p.accent : S.muted, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {p.label}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {target === 'intro' ? (
              <>
                <div>
                  <Label>Phrase d'accroche</Label>
                  <input type="text" placeholder="Ce que personne ne te dit sur..."
                    value={(data as IntroSettings).hookText} onChange={e => setData((p: IntroSettings) => ({ ...p, hookText: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }}
                  />
                </div>
                <div>
                  <Label>URL du logo (optionnel)</Label>
                  <input type="text" placeholder="https://..."
                    value={(data as IntroSettings).logoUrl} onChange={e => setData((p: IntroSettings) => ({ ...p, logoUrl: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>CTA principal</Label>
                  <input type="text" placeholder="Abonne-toi pour plus de contenu 🔥"
                    value={(data as OutroSettings).ctaText} onChange={e => setData((p: OutroSettings) => ({ ...p, ctaText: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }}
                  />
                  <p style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace', marginTop: 6 }}>Phrase courte · action directe · max 8 mots</p>
                </div>
                <div>
                  <Label>Texte secondaire</Label>
                  <input type="text" placeholder="@tonhandle · Commente si tu veux la suite"
                    value={(data as OutroSettings).subText} onChange={e => setData((p: OutroSettings) => ({ ...p, subText: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }}
                  />
                </div>
                <div>
                  <Label>URL du logo (optionnel)</Label>
                  <input type="text" placeholder="https://..."
                    value={(data as OutroSettings).logoUrl} onChange={e => setData((p: OutroSettings) => ({ ...p, logoUrl: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }}
                  />
                </div>
              </>
            )}

            <SliderRow label="Durée" value={data.durationSeconds} min={2} max={6} step={0.5}
              format={v => `${v}s`} onChange={v => setData((p: any) => ({ ...p, durationSeconds: v }))} />

            {/* Advanced styling */}
            <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: S.gap.lg }}>
              <Section title="Style avancé" defaultOpen={false}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: S.gap.lg }}>
                  {/* Colors */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <Label>Couleur fond</Label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="color" value={(data as any).bgColor || theme.backgroundColor}
                          onChange={e => setData((p: any) => ({ ...p, bgColor: e.target.value, preset: 'custom' }))}
                          style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', cursor: 'pointer' }} />
                        <input type="text" value={(data as any).bgColor || theme.backgroundColor}
                          onChange={e => setData((p: any) => ({ ...p, bgColor: e.target.value, preset: 'custom' }))}
                          style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 10px', color: S.text, fontSize: 12, fontFamily: 'monospace', outline: 'none' }} />
                      </div>
                    </div>
                    <div>
                      <Label>Couleur accent</Label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="color" value={(data as any).accentColor || theme.textColor}
                          onChange={e => setData((p: any) => ({ ...p, accentColor: e.target.value, preset: 'custom' }))}
                          style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', cursor: 'pointer' }} />
                        <input type="text" value={(data as any).accentColor || theme.textColor}
                          onChange={e => setData((p: any) => ({ ...p, accentColor: e.target.value, preset: 'custom' }))}
                          style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 10px', color: S.text, fontSize: 12, fontFamily: 'monospace', outline: 'none' }} />
                      </div>
                    </div>
                  </div>

                  {/* Background pattern */}
                  <div>
                    <Label>Motif de fond</Label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {BG_PATTERNS.map(opt => {
                        const selected = ((data as any).bgPattern || 'solid') === opt.value
                        return (
                          <button key={opt.value} onClick={() => setData((p: any) => ({ ...p, bgPattern: opt.value, preset: 'custom' }))}
                            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'monospace',
                              background: selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${selected ? 'rgba(255,255,255,0.4)' : S.border}`,
                              color: selected ? S.text : S.muted }}>
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Text animation */}
                  <div>
                    <Label>Animation</Label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {TEXT_ANIMATIONS.map(opt => {
                        const selected = ((data as any).textAnimation || 'spring-up') === opt.value
                        return (
                          <button key={opt.value} onClick={() => setData((p: any) => ({ ...p, textAnimation: opt.value, preset: 'custom' }))}
                            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'monospace',
                              background: selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${selected ? 'rgba(255,255,255,0.4)' : S.border}`,
                              color: selected ? S.text : S.muted }}>
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Size sliders */}
                  <SliderRow label="Taille du texte" value={(data as any).textSize || (target === 'intro' ? 72 : 68)} min={32} max={120} step={4}
                    format={v => `${v}px`} onChange={v => setData((p: any) => ({ ...p, textSize: v }))} />
                  <SliderRow label="Taille du logo" value={(data as any).logoSize || (target === 'intro' ? 64 : 56)} min={32} max={200} step={8}
                    format={v => `${v}px`} onChange={v => setData((p: any) => ({ ...p, logoSize: v }))} />

                  {/* Police */}
                  <div>
                    <Label>Police</Label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {FONT_OPTIONS.map(f => {
                        const active = ((data as any).fontFamily || theme.fontFamily) === f.value
                        return (
                          <button key={f.value} onClick={() => setData((p: any) => ({ ...p, fontFamily: f.value, fontWeight: f.weight }))}
                            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: f.value,
                              background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${active ? 'rgba(255,255,255,0.4)' : S.border}`,
                              color: active ? S.text : S.muted }}>
                            {f.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Décorateur */}
                  <div>
                    <Label>Décorateur</Label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {([
                        { value: 'none', label: 'Aucun' },
                        { value: 'ticker', label: '📺 Ticker' },
                        { value: 'frame-border', label: '⬜ Cadre' },
                        { value: 'corner-label', label: '📌 Coin' },
                      ] as { value: string; label: string }[]).map(opt => {
                        const selected = ((data as any).decorator || 'none') === opt.value
                        return (
                          <button key={opt.value} onClick={() => setData((p: any) => ({ ...p, decorator: opt.value, preset: 'custom' }))}
                            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'monospace',
                              background: selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${selected ? 'rgba(255,255,255,0.4)' : S.border}`,
                              color: selected ? S.text : S.muted }}>
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {(data as any).decorator && (data as any).decorator !== 'none' && (
                    <div>
                      <Label>{(data as any).decorator === 'ticker' ? 'Texte du ticker' : 'Texte du coin'}</Label>
                      <input type="text" value={(data as any).decoratorText || ''}
                        onChange={e => setData((p: any) => ({ ...p, decoratorText: e.target.value }))}
                        placeholder={(data as any).decorator === 'ticker' ? 'Ex: @monhandle · LAVIDZ' : 'Ex: EP.01'}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 12px', color: S.text, fontSize: 13, outline: 'none' }}
                      />
                    </div>
                  )}
                </div>
              </Section>
            </div>
          </div>
        )}
      </Card>

      {/* Son d'intro/outro */}
      <Card>
        <p style={{ color: S.text, fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Son d'{target === 'intro' ? 'intro' : 'outro'}</p>
        {sounds.length === 0 ? (
          <p style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace' }}>
            Aucun son "{target === 'intro' ? 'Intro' : 'Outro'}" dans la bibliothèque — ajoutez-en depuis l'admin.
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
                      padding: '8px 12px', borderRadius: 10, textAlign: 'left',
                      background: isActive ? 'rgba(255,255,255,0.1)' : S.surface,
                      border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : S.border}`,
                    }}
                  >
                    <span style={{ color: isActive ? S.text : S.muted, fontSize: 12 }}>{s.name}</span>
                    {isActive && <span style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace' }}>actif</span>}
                  </button>
                  <button
                    onClick={() => {
                      if (soundPreviewAudioRef.current) { soundPreviewAudioRef.current.pause(); soundPreviewAudioRef.current = null }
                      const a = new Audio(s.signedUrl); soundPreviewAudioRef.current = a
                      a.onended = () => { soundPreviewAudioRef.current = null }; a.play()
                    }}
                    style={{ padding: '8px 10px', borderRadius: 10, background: S.surface, border: `1px solid ${S.border}`, color: S.muted, display: 'flex', alignItems: 'center' }}
                  >
                    <Play size={11} />
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
              format={v => `${v}%`}
              onChange={v => setAudioSettings(p => ({ ...p, [sfxKey]: { ...activeSfx, volume: v / 100 } }))}
            />
          </div>
        )}
      </Card>
    </div>
  )
}

export function BookendsModule(props: BookendsModuleProps) {
  const {
    bookendTarget, setBookendTarget,
    intro, setIntro, outro, setOutro,
    theme, audioSettings, setAudioSettings,
    hoveredIntroPreset, setHoveredIntroPreset,
    hoveredOutroPreset, setHoveredOutroPreset,
    soundLibrary, soundPreviewAudioRef,
  } = props

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', background: S.surface, borderRadius: 10, padding: 3, border: `1px solid ${S.border}` }}>
        {(['intro', 'outro'] as const).map(t => (
          <button key={t} onClick={() => setBookendTarget(t)} style={{
            flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: bookendTarget === t ? S.surfaceActive : 'transparent',
            border: `1px solid ${bookendTarget === t ? S.borderActive : 'transparent'}`,
            color: bookendTarget === t ? S.text : S.muted, transition: 'all 0.15s',
          }}>
            {t === 'intro' ? 'Intro' : 'Outro'}
          </button>
        ))}
      </div>
      {bookendTarget === 'intro' ? (
        <SlideEditor
          target="intro"
          data={intro}
          setData={setIntro}
          theme={theme}
          audioSettings={audioSettings}
          setAudioSettings={setAudioSettings}
          hoveredPreset={hoveredIntroPreset}
          setHoveredPreset={setHoveredIntroPreset}
          soundLibrary={soundLibrary}
          soundPreviewAudioRef={soundPreviewAudioRef}
        />
      ) : (
        <SlideEditor
          target="outro"
          data={outro}
          setData={setOutro}
          theme={theme}
          audioSettings={audioSettings}
          setAudioSettings={setAudioSettings}
          hoveredPreset={hoveredOutroPreset}
          setHoveredPreset={setHoveredOutroPreset}
          soundLibrary={soundLibrary}
          soundPreviewAudioRef={soundPreviewAudioRef}
        />
      )}
    </div>
  )
}
