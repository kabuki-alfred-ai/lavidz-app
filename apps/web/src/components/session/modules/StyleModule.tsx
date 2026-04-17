'use client'

import { Play } from 'lucide-react'
import type { TransitionTheme, MotionSettings, AudioSettings, TransitionStyle, QuestionCardStyle } from '@/remotion/themeTypes'
import { FONT_OPTIONS, THEME_PRESETS } from '@/remotion/themeTypes'
import type { SubtitleSettings, SubtitleStyle } from '@/remotion/subtitleTypes'
import { S, Card, Label, Toggle, SliderRow, Section, selectableStyle } from '@/components/session/process-view-utils'
import { STYLE_PRESETS } from '@/components/session/process-view-utils'

interface SoundLibraryItem {
  id: string
  name: string
  tag: string
  signedUrl: string
}

interface StyleModuleProps {
  // Style presets
  activePresetId: string | null
  setActivePresetId: (v: string | null) => void
  // Theme
  theme: TransitionTheme
  setTheme: React.Dispatch<React.SetStateAction<TransitionTheme>>
  hoveredFont: string | null
  setHoveredFont: (v: string | null) => void
  // Motion
  motionSettings: MotionSettings
  setMotionSettings: React.Dispatch<React.SetStateAction<MotionSettings>>
  hoveredTransStyle: string | null
  setHoveredTransStyle: (v: string | null) => void
  hoveredQCardStyle: string | null
  setHoveredQCardStyle: (v: string | null) => void
  hoveredQCardTrans: string | null
  setHoveredQCardTrans: (v: string | null) => void
  // Subtitles
  subtitleSettings: SubtitleSettings
  setSubtitleSettings: React.Dispatch<React.SetStateAction<SubtitleSettings>>
  // Question card frames
  questionCardFrames: number
  setQuestionCardFrames: (v: number) => void
  // Format
  setFormat: (v: import('@/components/session/process-view-utils').FormatKey) => void
  // Transition SFX
  audioSettings: AudioSettings
  setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>
  soundLibrary: SoundLibraryItem[]
  soundPreviewAudioRef: React.MutableRefObject<HTMLAudioElement | null>
  // Cold open for emoji
  coldOpenLoading: boolean
  ready: boolean
  runColdOpenAnalysis: () => void
  segments: import('@/remotion/LavidzComposition').CompositionSegment[] | null
  wordEmojisBySegmentId: Record<string, { word: string; emoji: string }[]>
  setWordEmojisBySegmentId: React.Dispatch<React.SetStateAction<Record<string, { word: string; emoji: string }[]>>>
}

export function StyleModule(props: StyleModuleProps) {
  const {
    activePresetId, setActivePresetId,
    theme, setTheme,
    hoveredFont, setHoveredFont,
    motionSettings, setMotionSettings,
    hoveredTransStyle, setHoveredTransStyle,
    hoveredQCardStyle, setHoveredQCardStyle,
    hoveredQCardTrans, setHoveredQCardTrans,
    subtitleSettings, setSubtitleSettings,
    questionCardFrames, setQuestionCardFrames,
    setFormat,
    audioSettings, setAudioSettings,
    soundLibrary, soundPreviewAudioRef,
    coldOpenLoading, ready, runColdOpenAnalysis,
    segments, wordEmojisBySegmentId, setWordEmojisBySegmentId,
  } = props

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Style Presets ── */}
      <Card>
        <Label>Preset de style</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {STYLE_PRESETS.map(preset => {
            const selected = activePresetId === preset.id
            return (
              <button key={preset.id} onClick={() => {
                setActivePresetId(preset.id)
                setFormat(preset.format)
                setTheme({ ...preset.theme })
                setMotionSettings({ ...preset.motionSettings })
                setSubtitleSettings(p => ({ ...p, ...preset.subtitleSettings }))
                setQuestionCardFrames(preset.questionCardFrames)
              }}
                style={{
                  padding: '14px', borderRadius: 14, textAlign: 'left',
                  background: selected ? S.surfaceActive : S.surface,
                  border: `2px solid ${selected ? S.borderActive : S.border}`, transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: preset.theme.backgroundColor, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                  <span style={{ color: S.text, fontWeight: 700, fontSize: 13 }}>{preset.label}</span>
                </div>
                <p style={{ color: S.muted, fontSize: 11, fontFamily: 'monospace' }}>{preset.desc}</p>
              </button>
            )
          })}
        </div>
      </Card>

      {/* ── Transitions clips ── */}
      <div>
        <Label>Entrée des clips</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {([
            { value: 'zoom-punch',  label: 'Zoom Punch',  desc: 'TikTok / Reels' },
            { value: 'slide-up',    label: 'Slide Up',    desc: 'Story / Smooth' },
            { value: 'flash',       label: 'Flash Cut',   desc: 'Énergie / Clip' },
            { value: 'wipe-right',  label: 'Wipe',        desc: 'Slide latéral' },
            { value: 'spin-scale',  label: 'Spin Scale',  desc: 'Social / Punchy' },
            { value: 'glitch-cut',  label: 'Glitch',      desc: 'Cyberpunk / RGB' },
            { value: 'blur-in',     label: 'Blur In',     desc: 'Cinéma / Focus' },
            { value: 'shake',       label: 'Shake',       desc: 'Énergie brute' },
            { value: 'none',        label: 'Aucune',      desc: 'Cut direct' },
          ] as { value: TransitionStyle; label: string; desc: string }[]).map(t => (
            <button key={t.value} onClick={() => setMotionSettings(p => ({ ...p, transitionStyle: t.value }))}
              onMouseEnter={() => setHoveredTransStyle(t.value)}
              onMouseLeave={() => setHoveredTransStyle(null)}
              style={{
                padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                ...selectableStyle(motionSettings.transitionStyle === t.value, hoveredTransStyle === t.value),
              }}
            >
              <p style={{ color: motionSettings.transitionStyle === t.value ? S.text : S.muted, fontWeight: 700, fontSize: 13 }}>{t.label}</p>
              <p style={{ color: S.dim, fontSize: 10, marginTop: 2, fontFamily: 'monospace' }}>{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Cartes question ── */}
      <Section title="Cartes question" defaultOpen={false}>
        <div>
          <Label>Style des cartes question</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {([
              { value: 'default',     label: 'Default',     desc: 'Spring classique',   emoji: '◻' },
              { value: 'flash-word',  label: 'Flash Word',  desc: 'Konbini / Impact',   emoji: '⚡' },
              { value: 'brut',        label: 'Brut',        desc: 'Brutalist / Left',   emoji: '▐' },
              { value: 'split-color', label: 'Split',       desc: 'Bi-color reveal',    emoji: '◨' },
              { value: 'typewriter',  label: 'Typewriter',  desc: 'Char by char',       emoji: '⌨' },
              { value: 'cinematic',   label: 'Cinéma',      desc: 'Letterbox / Serif',  emoji: '🎬' },
              { value: 'pop-art',     label: 'Pop Art',     desc: 'Pills colorées',     emoji: '🎨' },
              { value: 'word-slam',   label: 'Word Slam',   desc: 'Claque des côtés',   emoji: '💥' },
              { value: 'kinetic',     label: 'Kinetic',     desc: 'Zoom stagger x3.5',  emoji: '🚀' },
              { value: 'neon-pulse',  label: 'Neon Pulse',  desc: 'Glow multicolore',   emoji: '🌈' },
            ] as { value: string; label: string; desc: string; emoji: string }[]).map(t => (
              <button key={t.value} onClick={() => setMotionSettings(p => ({ ...p, questionCardStyle: t.value as QuestionCardStyle }))}
                onMouseEnter={() => setHoveredQCardStyle(t.value)}
                onMouseLeave={() => setHoveredQCardStyle(null)}
                style={{
                  padding: '12px 10px', borderRadius: 12, textAlign: 'left',
                  ...selectableStyle((motionSettings.questionCardStyle ?? 'default') === t.value, hoveredQCardStyle === t.value),
                }}
              >
                <p style={{ fontSize: 16, margin: '0 0 4px' }}>{t.emoji}</p>
                <p style={{ color: (motionSettings.questionCardStyle ?? 'default') === t.value ? S.text : S.muted, fontWeight: 700, fontSize: 12 }}>{t.label}</p>
                <p style={{ color: S.dim, fontSize: 9, marginTop: 2, fontFamily: 'monospace' }}>{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Entrée des cartes question</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {([
              { value: 'none',        label: 'Aucune',      desc: 'Cut direct' },
              { value: 'zoom-punch',  label: 'Zoom Punch',  desc: 'TikTok / Reels' },
              { value: 'slide-up',    label: 'Slide Up',    desc: 'Story / Smooth' },
              { value: 'flash',       label: 'Flash Cut',   desc: 'Énergie / Clip' },
              { value: 'wipe-right',  label: 'Wipe',        desc: 'Slide latéral' },
              { value: 'spin-scale',  label: 'Spin Scale',  desc: 'Social / Punchy' },
              { value: 'glitch-cut',  label: 'Glitch',      desc: 'Cyberpunk / RGB' },
              { value: 'blur-in',     label: 'Blur In',     desc: 'Cinéma / Focus' },
              { value: 'shake',       label: 'Shake',       desc: 'Énergie brute' },
            ] as { value: TransitionStyle; label: string; desc: string }[]).map(t => (
              <button key={t.value} onClick={() => setMotionSettings(p => ({ ...p, questionCardTransition: t.value }))}
                onMouseEnter={() => setHoveredQCardTrans(t.value)}
                onMouseLeave={() => setHoveredQCardTrans(null)}
                style={{
                  padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                  ...selectableStyle((motionSettings.questionCardTransition ?? 'none') === t.value, hoveredQCardTrans === t.value),
                }}
              >
                <p style={{ color: (motionSettings.questionCardTransition ?? 'none') === t.value ? S.text : S.muted, fontWeight: 700, fontSize: 13 }}>{t.label}</p>
                <p style={{ color: S.dim, fontSize: 10, marginTop: 2, fontFamily: 'monospace' }}>{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Motif de fond des cartes</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {([
              { value: 'solid', label: 'Uni' }, { value: 'dots', label: 'Points' }, { value: 'grid', label: 'Grille' },
              { value: 'diagonal', label: 'Diagonales' }, { value: 'radial', label: 'Radial' }, { value: 'noise', label: 'Bruit' },
              { value: 'confetti', label: 'Confetti' }, { value: 'stripes', label: 'Stripes' }, { value: 'scanlines', label: 'Scanlines' },
              { value: 'gradient-sweep', label: 'Sweep' }, { value: 'aurora', label: 'Aurora' }, { value: 'halftone', label: 'Halftone' },
              { value: 'vhs', label: 'VHS' }, { value: 'plasma', label: '🫧 Plasma' }, { value: 'synthwave', label: '🌅 Synthwave' },
              { value: 'burst', label: '✳ Burst' }, { value: 'liquid', label: '🫠 Liquid' }, { value: 'eq', label: '🎚 EQ' },
            ] as { value: string; label: string }[]).map(opt => {
              const selected = (motionSettings.questionCardBgPattern ?? 'solid') === opt.value
              return (
                <button key={opt.value} onClick={() => setMotionSettings(p => ({ ...p, questionCardBgPattern: opt.value as any }))}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'monospace',
                    background: selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selected ? 'rgba(255,255,255,0.4)' : S.border}`,
                    color: selected ? S.text : S.muted,
                  }}>
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </Section>

      <div style={{ height: 1, background: S.border }} />

      {/* Preset couleurs */}
      <div>
        <Label>Preset couleurs</Label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {THEME_PRESETS.map(preset => (
            <button key={preset.label} onClick={() => setTheme(p => ({ ...p, backgroundColor: preset.backgroundColor, textColor: preset.textColor }))}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                borderRadius: 20, fontSize: 12, fontFamily: 'monospace',
                background: theme.backgroundColor === preset.backgroundColor ? 'rgba(255,255,255,0.12)' : S.surface,
                border: `1px solid ${theme.backgroundColor === preset.backgroundColor ? 'rgba(255,255,255,0.3)' : S.border}`,
                color: theme.backgroundColor === preset.backgroundColor ? S.text : S.muted,
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 6, background: preset.backgroundColor, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom colors */}
      <Card style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Fond', key: 'backgroundColor' as const },
          { label: 'Texte', key: 'textColor' as const },
        ].map(({ label, key }) => (
          <div key={key} style={{ flex: 1 }}>
            <Label>{label}</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 10, border: `1px solid ${S.border}` }}>
              <input type="color" value={theme[key]} onChange={e => setTheme(p => ({ ...p, [key]: e.target.value }))}
                style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
              <span style={{ color: S.muted, fontSize: 11, fontFamily: 'monospace' }}>{theme[key]}</span>
            </div>
          </div>
        ))}
      </Card>

      {/* Font */}
      <div>
        <Label>Police des transitions</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {FONT_OPTIONS.map(font => (
            <button key={font.label} onClick={() => setTheme(p => ({ ...p, fontFamily: font.value, fontWeight: font.weight }))}
              onMouseEnter={() => setHoveredFont(font.label)}
              onMouseLeave={() => setHoveredFont(null)}
              style={{
                padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                fontFamily: font.value, fontWeight: font.weight, fontSize: 14,
                ...selectableStyle(theme.fontFamily === font.value, hoveredFont === font.label),
              }}
            >
              {font.label}
            </button>
          ))}
        </div>
      </div>

      {/* Visual effects */}
      <Section title="Effets visuels" defaultOpen={false}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { key: 'wordPop'     as const, label: 'Word Pop',      desc: 'Bounce sur le mot actif' },
            { key: 'progressBar' as const, label: 'Progress Bar',  desc: 'Barre de progression en haut' },
            { key: 'kenBurns'    as const, label: 'Ken Burns',     desc: 'Zoom lent cinématique' },
            { key: 'dynamicZoom' as const, label: 'Dynamic Zoom',  desc: 'Punch zoom rythmique tous les 4 mots' },
          ].map(({ key, label, desc }, idx, arr) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: idx < arr.length - 1 ? `1px solid ${S.border}` : 'none' }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>{label}</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>{desc}</p>
              </div>
              <Toggle value={!!motionSettings[key]} onChange={v => setMotionSettings(p => ({ ...p, [key]: v }))} />
            </div>
          ))}
          {/* Lower Third */}
          <div style={{ paddingTop: 12, borderTop: `1px solid ${S.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: motionSettings.lowerThird !== undefined ? 16 : 0 }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Lower Third</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Bandeau nom / titre</p>
              </div>
              <Toggle
                value={motionSettings.lowerThird !== undefined}
                onChange={v => setMotionSettings(p => ({ ...p, lowerThird: v ? { name: '', title: '', style: 'bar', position: 'bottom-left', persistent: true } : undefined }))}
              />
            </div>
            {motionSettings.lowerThird !== undefined && (() => {
              const lt = motionSettings.lowerThird!
              const upd = (patch: Partial<typeof lt>) => setMotionSettings(p => ({ ...p, lowerThird: { ...p.lowerThird!, ...patch } }))
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <Label>Nom</Label>
                    <input type="text" placeholder="Marie Dupont" value={lt.name}
                      onChange={e => upd({ name: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }} />
                  </div>
                  <div>
                    <Label>Titre (optionnel)</Label>
                    <input type="text" placeholder="Co-fondatrice · Lavidz" value={lt.title ?? ''}
                      onChange={e => upd({ title: e.target.value || undefined })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }} />
                  </div>
                  <div>
                    <Label>Style — B2B</Label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      {(['corporate','executive','broadcast','clean','editorial'] as const).map(s => (
                        <button key={s} onClick={() => upd({ style: s })} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: lt.style === s ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${lt.style === s ? 'rgba(59,130,246,0.7)' : S.border}`, color: lt.style === s ? '#93c5fd' : S.muted, textTransform: 'capitalize' }}>{s}</button>
                      ))}
                    </div>
                    <Label>Style — Viral</Label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(['bar', 'pill', 'minimal', 'bold', 'neon'] as const).map(s => (
                        <button key={s} onClick={() => upd({ style: s })} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: lt.style === s ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${lt.style === s ? 'rgba(249,115,22,0.7)' : S.border}`, color: lt.style === s ? '#fdba74' : S.muted, textTransform: 'capitalize' }}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Position</Label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(['bottom-left','bottom-center','bottom-right','top-left','top-right'] as const).map(pos => (
                        <button key={pos} onClick={() => upd({ position: pos })} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: lt.position === pos ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${lt.position === pos ? 'rgba(249,115,22,0.7)' : S.border}`, color: lt.position === pos ? '#fdba74' : S.muted }}>
                          {pos === 'bottom-left' ? '↙ Bas gauche' : pos === 'bottom-center' ? '↓ Bas centre' : pos === 'bottom-right' ? '↘ Bas droite' : pos === 'top-left' ? '↖ Haut gauche' : '↗ Haut droite'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <Label>Couleur nom</Label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="color" value={lt.nameColor ?? '#FFFFFF'} onChange={e => upd({ nameColor: e.target.value })} style={{ width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'none' }} />
                        <span style={{ color: S.muted, fontSize: 11, fontFamily: 'monospace' }}>{lt.nameColor ?? '#FFFFFF'}</span>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <Label>Accent / fond</Label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="color" value={lt.accentColor ?? '#FFFFFF'} onChange={e => upd({ accentColor: e.target.value })} style={{ width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'none' }} />
                        <span style={{ color: S.muted, fontSize: 11, fontFamily: 'monospace' }}>{lt.accentColor ?? '#FFFFFF'}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <Label>Taille ({lt.fontSize ?? 22}px)</Label>
                      <input type="range" min={14} max={48} value={lt.fontSize ?? 22} onChange={e => upd({ fontSize: Number(e.target.value) })} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <Label>Toujours visible</Label>
                      <Toggle value={lt.persistent !== false} onChange={v => upd({ persistent: v })} />
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </Card>
      </Section>

      <div style={{ height: 1, background: S.border }} />

      {/* Transition SFX */}
      <div>
        <Label>Audio</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(() => {
            const transitionSounds = soundLibrary.filter(s => s.tag === 'TRANSITION')
            const track = audioSettings.transitionSfx
            return (
              <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 13 }}>Son de transition</p>
                {transitionSounds.length === 0 ? (
                  <p style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace' }}>
                    Aucun son "Transition" dans la bibliothèque — ajoutez-en depuis l'admin.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {transitionSounds.map(s => {
                      const isActive = track?.prompt === s.id
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            onClick={() => setAudioSettings(p => ({
                              ...p,
                              transitionSfx: isActive ? undefined : { prompt: s.id, url: `/api/admin/sounds/${s.id}/audio`, volume: 0.8 },
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
                            onClick={() => { if (soundPreviewAudioRef.current) { soundPreviewAudioRef.current.pause(); soundPreviewAudioRef.current = null } const a = new Audio(s.signedUrl); soundPreviewAudioRef.current = a; a.onended = () => { soundPreviewAudioRef.current = null }; a.play() }}
                            style={{ padding: '8px 10px', borderRadius: 10, background: S.surface, border: `1px solid ${S.border}`, color: S.muted, display: 'flex', alignItems: 'center' }}
                          >
                            <Play size={11} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
                {track?.url && (
                  <SliderRow
                    label="Volume"
                    value={Math.round((track.volume ?? 0.8) * 100)}
                    min={0} max={100} step={5}
                    format={v => `${v}%`}
                    onChange={v => setAudioSettings(p => ({ ...p, transitionSfx: { ...p.transitionSfx!, volume: v / 100 } }))}
                  />
                )}
              </Card>
            )
          })()}
        </div>
      </div>

      {/* Subtitles section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Sous-titres</p>
            <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Afficher les sous-titres sur la vidéo</p>
          </div>
          <Toggle value={subtitleSettings.enabled} onChange={v => setSubtitleSettings(p => ({ ...p, enabled: v }))} />
        </Card>

        {subtitleSettings.enabled && <>
          <div>
            <Label>Style</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([
                { id: 'hormozi',  label: 'Hormozi',   desc: 'Impact jaune · viral' },
                { id: 'minimal',  label: 'Minimal',   desc: 'Fond flou · épuré' },
                { id: 'classic',  label: 'Classic',   desc: 'Soulignement blanc' },
                { id: 'neon',     label: 'Neon',      desc: 'Glow cyan · électro' },
                { id: 'karaoke',  label: 'Karaoke',   desc: 'Highlight pill actif' },
                { id: 'boxed',    label: 'Boxed',     desc: 'Box par mot · orange' },
                { id: 'outline',  label: 'Outline',   desc: 'Contour · sans remplissage' },
                { id: 'tape',     label: 'Tape',      desc: 'Bande noire · soulignage' },
                { id: 'glitch',   label: 'Glitch',    desc: 'Aberration chromatique' },
                { id: 'fire',     label: 'Fire',      desc: 'Glow orange / rouge' },
              ] as { id: SubtitleStyle; label: string; desc: string }[]).map(s => (
                <button key={s.id} onClick={() => setSubtitleSettings(p => ({ ...p, style: s.id }))}
                  style={{
                    padding: '10px 14px', borderRadius: 12, fontSize: 12, textAlign: 'left',
                    background: subtitleSettings.style === s.id ? 'rgba(255,255,255,0.1)' : S.surface,
                    border: `1px solid ${subtitleSettings.style === s.id ? 'rgba(255,255,255,0.3)' : S.border}`,
                    color: subtitleSettings.style === s.id ? S.text : S.muted,
                  }}
                >
                  <p style={{ fontWeight: 700, fontFamily: 'monospace', marginBottom: 2 }}>{s.label}</p>
                  <p style={{ fontSize: 10, color: S.dim }}>{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <Card style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SliderRow label="Mots par ligne" value={subtitleSettings.wordsPerLine} min={1} max={5} step={1}
              format={v => `${v} mot${v > 1 ? 's' : ''}`} onChange={v => setSubtitleSettings(p => ({ ...p, wordsPerLine: v }))} />
            <SliderRow label="Taille" value={subtitleSettings.size} min={24} max={120} step={4}
              format={v => `${v}px`} onChange={v => setSubtitleSettings(p => ({ ...p, size: v }))} />
            <SliderRow label="Position verticale" value={subtitleSettings.position} min={5} max={95} step={5}
              format={v => v <= 25 ? 'Haut' : v <= 60 ? 'Centre' : 'Bas'}
              onChange={v => setSubtitleSettings(p => ({ ...p, position: v }))} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Label>Décalage temporel</Label>
                <span style={{ fontSize: 11, color: S.muted, fontFamily: 'monospace' }}>
                  {subtitleSettings.offsetMs === 0 ? '0 ms' : subtitleSettings.offsetMs > 0 ? `+${subtitleSettings.offsetMs} ms` : `${subtitleSettings.offsetMs} ms`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {[-300, -200, -100].map(step => (
                  <button key={step} onClick={() => setSubtitleSettings(p => ({ ...p, offsetMs: p.offsetMs + step }))}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', background: S.surface, border: `1px solid ${S.border}`, color: S.muted }}>
                    {step} ms
                  </button>
                ))}
                <button onClick={() => setSubtitleSettings(p => ({ ...p, offsetMs: 0 }))}
                  style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', background: S.surface, border: `1px solid ${S.border}`, color: S.dim }}>
                  0
                </button>
                {[100, 200, 300].map(step => (
                  <button key={step} onClick={() => setSubtitleSettings(p => ({ ...p, offsetMs: p.offsetMs + step }))}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', background: S.surface, border: `1px solid ${S.border}`, color: S.muted }}>
                    +{step} ms
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace' }}>
                Valeur négative = sous-titres en avance · Positive = sous-titres en retard
              </p>
            </div>
          </Card>

          {/* Emoji animés */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Emojis animés sur les mots</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Associe un emoji à un mot — il pop au-dessus des sous-titres quand le mot est prononcé</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 12px', background: S.surface, borderRadius: 10, border: `1px solid ${S.border}` }}>
              <span style={{ fontSize: 16 }}>✨</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: S.text, fontSize: 12, fontWeight: 600 }}>Noto Animated (Google)</p>
                <p style={{ color: S.dim, fontSize: 10 }}>GIFs animés haute qualité au lieu d'emojis statiques</p>
              </div>
              <Toggle
                value={subtitleSettings.animatedEmojis !== false}
                onChange={v => setSubtitleSettings(p => ({ ...p, animatedEmojis: v }))}
              />
            </div>
            <button
              onClick={runColdOpenAnalysis}
              disabled={coldOpenLoading || !ready}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10, marginBottom: 14,
                fontSize: 12, fontWeight: 600, cursor: (coldOpenLoading || !ready) ? 'not-allowed' : 'pointer',
                background: coldOpenLoading ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.12)',
                border: '1px solid rgba(168,85,247,0.45)',
                color: '#c4b5fd',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: !ready ? 0.5 : 1,
              }}
            >
              {coldOpenLoading
                ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> Gemini analyse...</>
                : <><span>🤖</span> Laisser Gemini choisir les emojis</>}
            </button>

            {Object.keys(wordEmojisBySegmentId).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(segments ?? []).filter(s => wordEmojisBySegmentId[s.id]?.length).map((seg, si) => (
                  <div key={seg.id}>
                    <p style={{ color: S.muted, fontSize: 10, fontFamily: 'monospace', marginBottom: 5 }}>Vidéo {si + 1}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {wordEmojisBySegmentId[seg.id].map((we, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', background: S.surface, borderRadius: 8, border: `1px solid ${S.border}` }}>
                          <input
                            value={we.emoji}
                            onChange={e => {
                              const val = [...e.target.value].slice(-2).join('')
                              setWordEmojisBySegmentId(prev => ({
                                ...prev,
                                [seg.id]: prev[seg.id].map((x, i) => i === idx ? { ...x, emoji: val } : x),
                              }))
                            }}
                            style={{ width: 30, padding: '2px 3px', borderRadius: 5, textAlign: 'center', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, color: S.text, fontSize: 16, fontFamily: 'inherit', outline: 'none' }}
                          />
                          <span style={{ color: S.text, fontSize: 11 }}>{we.word}</span>
                          <button
                            onClick={() => setWordEmojisBySegmentId(prev => ({
                              ...prev,
                              [seg.id]: prev[seg.id].filter((_, i) => i !== idx),
                            }))}
                            style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 10, cursor: 'pointer' }}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setWordEmojisBySegmentId({})}
                  style={{ padding: '7px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px dashed rgba(239,68,68,0.3)', color: '#fca5a5' }}
                >Effacer tout</button>
              </div>
            ) : (
              <p style={{ color: S.dim, fontSize: 11, textAlign: 'center', padding: '12px 0' }}>
                Lance l'analyse Gemini ci-dessus pour générer automatiquement les emojis sur les mots clés.
              </p>
            )}
          </Card>
        </>}
      </div>
    </div>
  )
}
