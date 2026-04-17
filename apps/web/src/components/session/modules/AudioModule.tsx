'use client'

import { Loader2, Play } from 'lucide-react'
import type { AudioSettings } from '@/remotion/themeTypes'
import { FONT_OPTIONS } from '@/remotion/themeTypes'
import {
  S, Card, Label, Toggle, SliderRow, Section, selectableStyle,
  STANDARD_VOICE_IDS,
  type CleanvoiceConfig, type Voice,
} from '@/components/session/process-view-utils'

interface SoundLibraryItem {
  id: string
  name: string
  tag: string
  signedUrl: string
}

interface AudioModuleProps {
  // Cleanvoice
  cleanvoiceEnabled: boolean
  setCleanvoiceEnabled: (v: boolean) => void
  cleanvoiceConfig: CleanvoiceConfig
  setCleanvoiceConfig: React.Dispatch<React.SetStateAction<CleanvoiceConfig>>
  cleanvoiceError: string
  // Silence cut
  silenceCutEnabled: boolean
  setSilenceCutEnabled: (v: boolean) => void
  silenceThreshold: number
  setSilenceThreshold: (v: number) => void
  silenceCutError: string
  // Filler cut
  fillerCutEnabled: boolean
  setFillerCutEnabled: (v: boolean) => void
  fillerCutError: string
  // Smart cut
  smartCutLoading: boolean
  runSmartMontage: () => void
  smartCutError: string
  // Cold open
  coldOpenLoading: boolean
  runColdOpenAnalysis: () => void
  coldOpenError: string
  coldOpenData: { hookPhrase: string; startInSeconds: number; endInSeconds: number; segmentId: string } | null
  setColdOpenData: React.Dispatch<React.SetStateAction<{ hookPhrase: string; startInSeconds: number; endInSeconds: number; segmentId: string } | null>>
  coldOpenEnabled: boolean
  setColdOpenEnabled: (v: boolean) => void
  coldOpenVideoStyle: 'bw' | 'desaturated' | 'color' | 'raw'
  setColdOpenVideoStyle: (v: 'bw' | 'desaturated' | 'color' | 'raw') => void
  coldOpenTextPosition: 'bottom' | 'center' | 'top'
  setColdOpenTextPosition: (v: 'bottom' | 'center' | 'top') => void
  coldOpenTextColor: string
  setColdOpenTextColor: (v: string) => void
  coldOpenHighlightColor: string
  setColdOpenHighlightColor: (v: string) => void
  coldOpenFontFamily: string
  setColdOpenFontFamily: (v: string) => void
  coldOpenFontSize: number
  setColdOpenFontSize: (v: number) => void
  // Cold open viral options
  coldOpenFreezeFrame: boolean
  setColdOpenFreezeFrame: (v: boolean) => void
  coldOpenTextAnimEnabled: boolean
  setColdOpenTextAnimEnabled: (v: boolean) => void
  coldOpenTextAnimation: 'pop' | 'slam' | 'typewriter'
  setColdOpenTextAnimation: (v: 'pop' | 'slam' | 'typewriter') => void
  coldOpenHighlightModeEnabled: boolean
  setColdOpenHighlightModeEnabled: (v: boolean) => void
  coldOpenHighlightMode: 'word' | 'all' | 'box'
  setColdOpenHighlightMode: (v: 'word' | 'all' | 'box') => void
  coldOpenSfxEnabled: boolean
  setColdOpenSfxEnabled: (v: boolean) => void
  coldOpenSfx: { prompt: string; url: string; volume: number } | null
  setColdOpenSfx: React.Dispatch<React.SetStateAction<{ prompt: string; url: string; volume: number } | null>>
  coldOpenEntrySfxEnabled: boolean
  setColdOpenEntrySfxEnabled: (v: boolean) => void
  coldOpenEntrySfx: { prompt: string; url: string; volume: number } | null
  setColdOpenEntrySfx: React.Dispatch<React.SetStateAction<{ prompt: string; url: string; volume: number } | null>>
  swooshEnabled: boolean
  setSwooshEnabled: (v: boolean) => void
  // Denoise
  denoiseEnabled: boolean
  setDenoiseEnabled: (v: boolean) => void
  denoiseStrength: 'light' | 'moderate' | 'strong' | 'isolate'
  setDenoiseStrength: (v: 'light' | 'moderate' | 'strong' | 'isolate') => void
  hoveredDenoiseStrength: string | null
  setHoveredDenoiseStrength: (v: string | null) => void
  // Voice TTS
  showTTS: boolean
  voiceEnabled: boolean
  setVoiceEnabled: (v: boolean) => void
  voices: Voice[]
  selectedVoiceId: string
  setSelectedVoiceId: (v: string) => void
  hoveredVoiceId: string | null
  setHoveredVoiceId: (v: string | null) => void
  previewingVoiceId: string | null
  previewVoice: (voice: Voice) => void
  audioSettings: AudioSettings
  setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>
  // Sound library
  soundLibrary: SoundLibraryItem[]
  soundPreviewAudioRef: React.MutableRefObject<HTMLAudioElement | null>
  // Display mode
  showOnlyColdOpen?: boolean
  hideColdOpen?: boolean
}

export function AudioModule(props: AudioModuleProps) {
  const {
    cleanvoiceEnabled, setCleanvoiceEnabled, cleanvoiceConfig, setCleanvoiceConfig, cleanvoiceError,
    silenceCutEnabled, setSilenceCutEnabled, silenceThreshold, setSilenceThreshold, silenceCutError,
    fillerCutEnabled, setFillerCutEnabled, fillerCutError,
    smartCutLoading, runSmartMontage, smartCutError,
    coldOpenLoading, runColdOpenAnalysis, coldOpenError,
    coldOpenData, setColdOpenData, coldOpenEnabled, setColdOpenEnabled,
    coldOpenVideoStyle, setColdOpenVideoStyle,
    coldOpenTextPosition, setColdOpenTextPosition,
    coldOpenTextColor, setColdOpenTextColor,
    coldOpenHighlightColor, setColdOpenHighlightColor,
    coldOpenFontFamily, setColdOpenFontFamily,
    coldOpenFontSize, setColdOpenFontSize,
    coldOpenFreezeFrame, setColdOpenFreezeFrame,
    coldOpenTextAnimEnabled, setColdOpenTextAnimEnabled,
    coldOpenTextAnimation, setColdOpenTextAnimation,
    coldOpenHighlightModeEnabled, setColdOpenHighlightModeEnabled,
    coldOpenHighlightMode, setColdOpenHighlightMode,
    coldOpenSfxEnabled, setColdOpenSfxEnabled,
    coldOpenSfx, setColdOpenSfx,
    coldOpenEntrySfxEnabled, setColdOpenEntrySfxEnabled,
    coldOpenEntrySfx, setColdOpenEntrySfx,
    swooshEnabled, setSwooshEnabled,
    denoiseEnabled, setDenoiseEnabled, denoiseStrength, setDenoiseStrength,
    hoveredDenoiseStrength, setHoveredDenoiseStrength,
    showTTS, voiceEnabled, setVoiceEnabled,
    voices, selectedVoiceId, setSelectedVoiceId,
    hoveredVoiceId, setHoveredVoiceId,
    previewingVoiceId, previewVoice,
    audioSettings, setAudioSettings,
    soundLibrary, soundPreviewAudioRef,
    showOnlyColdOpen, hideColdOpen,
  } = props

  // Cold Open only mode — render just the cold open section
  if (showOnlyColdOpen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Cold Open & Incrustations</p>
              <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Gemini extrait l&apos;accroche et les mots-cles visuels</p>
            </div>
            <button
              onClick={props.runColdOpenAnalysis}
              disabled={props.coldOpenLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                background: props.coldOpenLoading ? S.surface : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                border: 'none', color: '#fff', cursor: props.coldOpenLoading ? 'not-allowed' : 'pointer',
              }}>
              {props.coldOpenLoading ? <Loader2 size={12} className="animate-spin" /> : '✨'} Analyser
            </button>
          </div>
          {props.coldOpenError && <p style={{ color: S.error, fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>{props.coldOpenError}</p>}
          {props.coldOpenData && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: S.surface, border: `1px solid ${S.border}` }}>
              <p style={{ color: S.text, fontSize: 13, fontWeight: 600 }}>🎬 Accroche detectee</p>
              <p style={{ color: S.muted, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>&ldquo;{props.coldOpenData.hookPhrase}&rdquo;</p>
              <p style={{ color: S.dim, fontSize: 10, marginTop: 6, fontFamily: 'monospace' }}>
                {props.coldOpenData.startInSeconds.toFixed(1)}s → {props.coldOpenData.endInSeconds.toFixed(1)}s
              </p>
              <div style={{ marginTop: 12 }}>
                <Toggle value={props.coldOpenEnabled} onChange={props.setColdOpenEnabled} />
                <span style={{ color: S.muted, fontSize: 11, marginLeft: 8 }}>{props.coldOpenEnabled ? 'Active' : 'Desactive'}</span>
              </div>
            </div>
          )}
          {!props.coldOpenData && !props.coldOpenLoading && (
            <p style={{ color: S.dim, fontSize: 11, marginTop: 12, fontFamily: 'monospace' }}>
              Clique sur &ldquo;Analyser&rdquo; pour detecter le meilleur hook de la video.
            </p>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Cleanvoice — unified processing */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: cleanvoiceEnabled ? 20 : 0 }}>
          <div>
            <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Nettoyage audio IA</p>
            <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Nettoyage audio complet en une passe (remplace silences, tics, bruit)</p>
          </div>
          <Toggle value={cleanvoiceEnabled} onChange={setCleanvoiceEnabled} />
        </div>
        {cleanvoiceEnabled && (
          <Section title="Options Cleanvoice" defaultOpen={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { key: 'fillers',      label: 'Tics de langage',    desc: '"euh", "hm", "bah"…' },
                { key: 'hesitations',  label: 'Hésitations',        desc: 'Allongements de mots' },
                { key: 'stutters',     label: 'Bégaiements',        desc: 'Répétitions de syllabes' },
                { key: 'muted',        label: 'Sons muets',         desc: 'Bruits de bouche silencieux' },
                { key: 'long_silences',label: 'Silences longs',     desc: 'Remplace silence-cut' },
                { key: 'mouth_sounds', label: 'Bruits de bouche',   desc: 'Claquements, salive…' },
                { key: 'breath',       label: 'Respirations',       desc: 'Souffles audibles' },
                { key: 'remove_noise', label: 'Réduction de bruit', desc: 'Bruit de fond ambiant' },
                { key: 'normalize',    label: 'Normalisation',      desc: 'Volume uniforme (LUFS -16)' },
              ] as { key: keyof CleanvoiceConfig; label: string; desc: string }[]).map(opt => (
                <div key={opt.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: S.radius.sm, border: `1px solid ${S.border}` }}>
                  <div>
                    <span style={{ color: S.text, fontSize: 13, fontWeight: 500 }}>{opt.label}</span>
                    <span style={{ color: S.muted, fontSize: 11, marginLeft: 8 }}>{opt.desc}</span>
                  </div>
                  <Toggle
                    value={!!cleanvoiceConfig[opt.key]}
                    onChange={v => setCleanvoiceConfig(p => ({ ...p, [opt.key]: v }))}
                    label={opt.label}
                  />
                </div>
              ))}
              {/* Studio Sound */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(139,92,246,0.06)', borderRadius: S.radius.sm, border: '1px solid rgba(139,92,246,0.2)' }}>
                <div>
                  <span style={{ color: '#c4b5fd', fontSize: 13, fontWeight: 500 }}>Studio Sound</span>
                  <span style={{ color: S.muted, fontSize: 11, marginLeft: 8 }}>Rehaussement qualité pro</span>
                </div>
                <Toggle
                  value={cleanvoiceConfig.studio_sound === 'nightly'}
                  onChange={v => setCleanvoiceConfig(p => ({ ...p, studio_sound: v ? 'nightly' : false }))}
                  label="Studio Sound"
                />
              </div>
              {cleanvoiceError && <p style={{ color: S.error, fontSize: 11, fontFamily: 'monospace' }}>{cleanvoiceError}</p>}
            </div>
          </Section>
        )}
      </Card>

      {/* Legacy options — only shown when Cleanvoice is OFF */}
      {!cleanvoiceEnabled && (
        <>
          {/* Silence cut */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: silenceCutEnabled ? 16 : 0 }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Couper les silences</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Supprime les pauses dans les clips</p>
              </div>
              <Toggle value={silenceCutEnabled} onChange={setSilenceCutEnabled} />
            </div>
            {silenceCutEnabled && (
              <SliderRow label="Sensibilité" value={silenceThreshold} min={-55} max={-20} step={5}
                format={v => v >= -25 ? 'Agressive' : v >= -38 ? 'Modérée' : 'Légère'}
                onChange={setSilenceThreshold}
              />
            )}
            {silenceCutError && <p style={{ color: S.error, fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>{silenceCutError}</p>}
          </Card>

          {/* Filler cut */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Couper les tics de langage</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Supprime les "euh", "hm", "bah"…</p>
              </div>
              <Toggle value={fillerCutEnabled} onChange={setFillerCutEnabled} />
            </div>
            {fillerCutError && <p style={{ color: S.error, fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>{fillerCutError}</p>}
          </Card>

          {/* Auto-montage IA */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Auto-montage IA</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Gemini analyse la transcription et coupe automatiquement</p>
              </div>
              <button
                onClick={runSmartMontage}
                disabled={smartCutLoading}
                style={{
                  padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: smartCutLoading ? 'not-allowed' : 'pointer',
                  background: smartCutLoading ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)',
                  border: '1px solid rgba(139,92,246,0.5)',
                  color: '#c4b5fd',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: smartCutLoading ? 0.7 : 1,
                }}
              >
                {smartCutLoading
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Analyse...</>
                  : '✂ Lancer'}
              </button>
            </div>
            {smartCutError && <p style={{ color: S.error, fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>{smartCutError}</p>}
          </Card>

      {/* Cold Open & Visual Inlays — hidden when hideColdOpen (shown in dedicated tab instead) */}
      {!hideColdOpen && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Cold Open & Incrustations</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Gemini extrait l'accroche et les mots-clés visuels</p>
              </div>
              <button
                onClick={runColdOpenAnalysis}
                disabled={coldOpenLoading}
                style={{
                  padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: coldOpenLoading ? 'not-allowed' : 'pointer',
                  background: coldOpenLoading ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.15)',
                  border: '1px solid rgba(249,115,22,0.5)',
                  color: '#fdba74',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: coldOpenLoading ? 0.7 : 1,
                }}
              >
                {coldOpenLoading
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Analyse...</>
                  : '🎬 Analyser'}
              </button>
            </div>
            {coldOpenError && <p style={{ color: S.error, fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>{coldOpenError}</p>}

            {coldOpenData && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* ── COLD OPEN SECTION ── */}
                <div style={{ background: S.surface, borderRadius: 12, padding: 14, border: `1px solid ${S.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: coldOpenEnabled ? 14 : 0 }}>
                    <div>
                      <p style={{ color: S.text, fontSize: 13, fontWeight: 600 }}>🎬 Accroche (Cold Open)</p>
                      <p style={{ color: S.dim, fontSize: 10, marginTop: 2 }}>
                        {coldOpenData.startInSeconds.toFixed(1)}s → {coldOpenData.endInSeconds.toFixed(1)}s
                      </p>
                    </div>
                    <Toggle value={coldOpenEnabled} onChange={setColdOpenEnabled} />
                  </div>

                  {coldOpenEnabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                      {/* Editable hook phrase */}
                      <div>
                        <Label>Phrase d'accroche</Label>
                        <input
                          value={coldOpenData.hookPhrase}
                          onChange={e => setColdOpenData(d => d ? { ...d, hookPhrase: e.target.value } : d)}
                          style={{
                            width: '100%', marginTop: 6, padding: '8px 10px',
                            background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`,
                            borderRadius: 8, color: S.text, fontSize: 13,
                            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* Timing sliders */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <Label>Début : {coldOpenData.startInSeconds.toFixed(1)}s</Label>
                          <input type="range" min={0} max={Math.max(coldOpenData.endInSeconds - 0.5, 0.5)} step={0.1}
                            value={coldOpenData.startInSeconds}
                            onChange={e => setColdOpenData(d => d ? { ...d, startInSeconds: parseFloat(e.target.value) } : d)}
                            style={{ width: '100%', marginTop: 4, accentColor: '#f97316' }}
                          />
                        </div>
                        <div>
                          <Label>Fin : {coldOpenData.endInSeconds.toFixed(1)}s</Label>
                          <input type="range" min={coldOpenData.startInSeconds + 0.5} max={30} step={0.1}
                            value={coldOpenData.endInSeconds}
                            onChange={e => setColdOpenData(d => d ? { ...d, endInSeconds: parseFloat(e.target.value) } : d)}
                            style={{ width: '100%', marginTop: 4, accentColor: '#f97316' }}
                          />
                        </div>
                      </div>

                      {/* Video style */}
                      <div>
                        <Label>Traitement vidéo</Label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
                          {(['bw', 'desaturated', 'color', 'raw'] as const).map(vs => (
                            <button key={vs}
                              onClick={() => setColdOpenVideoStyle(vs)}
                              style={{
                                padding: '7px 4px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                                textAlign: 'center', cursor: 'pointer',
                                background: coldOpenVideoStyle === vs ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${coldOpenVideoStyle === vs ? 'rgba(249,115,22,0.7)' : S.border}`,
                                color: coldOpenVideoStyle === vs ? '#fdba74' : S.muted,
                              }}
                            >
                              {vs === 'bw' ? 'N&B' : vs === 'desaturated' ? 'Désat.' : vs === 'color' ? 'Couleur' : 'Brut'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Text position */}
                      <div>
                        <Label>Position du texte</Label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
                          {(['top', 'center', 'bottom'] as const).map(pos => (
                            <button key={pos}
                              onClick={() => setColdOpenTextPosition(pos)}
                              style={{
                                padding: '7px 4px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                                textAlign: 'center', cursor: 'pointer',
                                background: coldOpenTextPosition === pos ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${coldOpenTextPosition === pos ? 'rgba(249,115,22,0.7)' : S.border}`,
                                color: coldOpenTextPosition === pos ? '#fdba74' : S.muted,
                              }}
                            >
                              {pos === 'top' ? '▲ Haut' : pos === 'center' ? '● Centre' : '▼ Bas'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Colors */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <Label>Couleur texte</Label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <input type="color" value={coldOpenTextColor}
                              onChange={e => setColdOpenTextColor(e.target.value)}
                              style={{ width: 36, height: 28, borderRadius: 6, border: `1px solid ${S.border}`, cursor: 'pointer', background: 'transparent' }}
                            />
                            <span style={{ color: S.muted, fontSize: 11, fontFamily: 'monospace' }}>{coldOpenTextColor}</span>
                          </div>
                        </div>
                        <div>
                          <Label>Couleur accroche</Label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <input type="color" value={coldOpenHighlightColor}
                              onChange={e => setColdOpenHighlightColor(e.target.value)}
                              style={{ width: 36, height: 28, borderRadius: 6, border: `1px solid ${S.border}`, cursor: 'pointer', background: 'transparent' }}
                            />
                            <span style={{ color: S.muted, fontSize: 11, fontFamily: 'monospace' }}>{coldOpenHighlightColor}</span>
                          </div>
                        </div>
                      </div>

                      {/* Font family */}
                      <div>
                        <Label>Police</Label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginTop: 6 }}>
                          {FONT_OPTIONS.map(f => (
                            <button key={f.value}
                              onClick={() => setColdOpenFontFamily(f.value)}
                              style={{
                                padding: '7px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                                textAlign: 'center', cursor: 'pointer', fontFamily: f.value,
                                background: coldOpenFontFamily === f.value ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${coldOpenFontFamily === f.value ? 'rgba(249,115,22,0.7)' : S.border}`,
                                color: coldOpenFontFamily === f.value ? '#fdba74' : S.muted,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Font size slider */}
                      <div>
                        <Label>Taille texte : {coldOpenFontSize}px</Label>
                        <input type="range" min={36} max={120} step={2}
                          value={coldOpenFontSize}
                          onChange={e => setColdOpenFontSize(parseInt(e.target.value))}
                          style={{ width: '100%', marginTop: 4, accentColor: '#f97316' }}
                        />
                      </div>

                      {/* ── Options virales ── */}
                      <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 12 }}>
                        <Label>Options virales</Label>

                        {/* Presets one-click */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginTop: 6, marginBottom: 12 }}>
                          {([
                            { label: 'Hormozi', anim: 'slam' as const, highlight: 'box' as const, video: 'bw' as const, freeze: true, entrySnd: true },
                            { label: 'Viral',   anim: 'pop'  as const, highlight: 'all' as const, video: 'desaturated' as const, freeze: false, entrySnd: false },
                            { label: 'Typo',    anim: 'typewriter' as const, highlight: 'word' as const, video: 'desaturated' as const, freeze: false, entrySnd: false },
                          ]).map(p => (
                            <button key={p.label}
                              onClick={() => {
                                props.setColdOpenTextAnimEnabled(true); props.setColdOpenTextAnimation(p.anim)
                                props.setColdOpenHighlightModeEnabled(true); props.setColdOpenHighlightMode(p.highlight)
                                props.setColdOpenVideoStyle(p.video)
                                props.setColdOpenFreezeFrame(p.freeze)
                                props.setColdOpenEntrySfxEnabled(p.entrySnd)
                              }}
                              style={{ padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.4)', color: '#fdba74' }}
                            >{p.label}</button>
                          ))}
                        </div>

                        {/* Freeze frame */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div>
                            <p style={{ color: S.text, fontSize: 12, fontWeight: 600 }}>Freeze frame</p>
                            <p style={{ color: S.dim, fontSize: 10 }}>Fige la vidéo sur le moment du hook</p>
                          </div>
                          <Toggle value={coldOpenFreezeFrame} onChange={setColdOpenFreezeFrame} />
                        </div>

                        {/* Animation texte */}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: coldOpenTextAnimEnabled ? 8 : 0 }}>
                            <p style={{ color: S.text, fontSize: 12, fontWeight: 600 }}>Animation texte</p>
                            <Toggle value={coldOpenTextAnimEnabled} onChange={setColdOpenTextAnimEnabled} />
                          </div>
                          {coldOpenTextAnimEnabled && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                              {(['pop', 'slam', 'typewriter'] as const).map(a => (
                                <button key={a}
                                  onClick={() => setColdOpenTextAnimation(a)}
                                  style={{ padding: '6px 4px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: coldOpenTextAnimation === a ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${coldOpenTextAnimation === a ? 'rgba(249,115,22,0.7)' : S.border}`, color: coldOpenTextAnimation === a ? '#fdba74' : S.muted }}
                                >{{ pop: 'Pop', slam: 'Slam', typewriter: 'Typo' }[a]}</button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Highlight mode */}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: coldOpenHighlightModeEnabled ? 8 : 0 }}>
                            <p style={{ color: S.text, fontSize: 12, fontWeight: 600 }}>Mode highlight</p>
                            <Toggle value={coldOpenHighlightModeEnabled} onChange={setColdOpenHighlightModeEnabled} />
                          </div>
                          {coldOpenHighlightModeEnabled && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                              {(['word', 'all', 'box'] as const).map(m => (
                                <button key={m}
                                  onClick={() => setColdOpenHighlightMode(m)}
                                  style={{ padding: '6px 4px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: coldOpenHighlightMode === m ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${coldOpenHighlightMode === m ? 'rgba(249,115,22,0.7)' : S.border}`, color: coldOpenHighlightMode === m ? '#fdba74' : S.muted }}
                                >{{ word: 'Mot', all: 'Tout', box: 'Boîte' }[m]}</button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Son de fin (library) */}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: coldOpenSfxEnabled ? 8 : 0 }}>
                            <div>
                              <p style={{ color: S.text, fontSize: 12, fontWeight: 600 }}>Son de fin</p>
                              <p style={{ color: S.dim, fontSize: 10 }}>Remplace le swoosh</p>
                            </div>
                            <Toggle value={coldOpenSfxEnabled} onChange={v => { setColdOpenSfxEnabled(v); if (!v) setColdOpenSfx(null) }} />
                          </div>
                          {coldOpenSfxEnabled && (() => {
                            const sfxSounds = soundLibrary.filter(s => s.tag === 'TRANSITION')
                            return sfxSounds.length === 0 ? (
                              <p style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace' }}>Aucun son "Transition" dans la bibliothèque.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {sfxSounds.map(s => {
                                  const isActive = coldOpenSfx?.prompt === s.id
                                  return (
                                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <button onClick={() => setColdOpenSfx(isActive ? null : { prompt: s.id, url: `/api/admin/sounds/${s.id}/audio`, volume: 0.8 })}
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, background: isActive ? 'rgba(255,255,255,0.1)' : S.surface, border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : S.border}` }}>
                                        <span style={{ color: isActive ? S.text : S.muted, fontSize: 12 }}>{s.name}</span>
                                        {isActive && <span style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace' }}>actif</span>}
                                      </button>
                                      <button onClick={() => { if (soundPreviewAudioRef.current) { soundPreviewAudioRef.current.pause(); soundPreviewAudioRef.current = null } const a = new Audio(s.signedUrl); soundPreviewAudioRef.current = a; a.onended = () => { soundPreviewAudioRef.current = null }; a.play() }}
                                        style={{ padding: '7px 9px', borderRadius: 8, background: S.surface, border: `1px solid ${S.border}`, color: S.muted, display: 'flex', alignItems: 'center' }}>
                                        <Play size={11} />
                                      </button>
                                    </div>
                                  )
                                })}
                                {coldOpenSfx && (
                                  <SliderRow label="Volume" value={Math.round((coldOpenSfx.volume ?? 0.8) * 100)} min={0} max={100} step={5} format={v => `${v}%`}
                                    onChange={v => setColdOpenSfx(p => p ? { ...p, volume: v / 100 } : p)} />
                                )}
                              </div>
                            )
                          })()}
                        </div>

                        {/* Son d'entrée (library) */}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: coldOpenEntrySfxEnabled ? 8 : 0 }}>
                            <div>
                              <p style={{ color: S.text, fontSize: 12, fontWeight: 600 }}>Son d'entrée</p>
                              <p style={{ color: S.dim, fontSize: 10 }}>Joue quand le texte apparaît</p>
                            </div>
                            <Toggle value={coldOpenEntrySfxEnabled} onChange={v => { setColdOpenEntrySfxEnabled(v); if (!v) setColdOpenEntrySfx(null) }} />
                          </div>
                          {coldOpenEntrySfxEnabled && (() => {
                            const sfxSounds = soundLibrary.filter(s => s.tag === 'TRANSITION')
                            return sfxSounds.length === 0 ? (
                              <p style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace' }}>Aucun son "Transition" dans la bibliothèque.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {sfxSounds.map(s => {
                                  const isActive = coldOpenEntrySfx?.prompt === s.id
                                  return (
                                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <button onClick={() => setColdOpenEntrySfx(isActive ? null : { prompt: s.id, url: `/api/admin/sounds/${s.id}/audio`, volume: 0.7 })}
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, background: isActive ? 'rgba(255,255,255,0.1)' : S.surface, border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : S.border}` }}>
                                        <span style={{ color: isActive ? S.text : S.muted, fontSize: 12 }}>{s.name}</span>
                                        {isActive && <span style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace' }}>actif</span>}
                                      </button>
                                      <button onClick={() => { if (soundPreviewAudioRef.current) { soundPreviewAudioRef.current.pause(); soundPreviewAudioRef.current = null } const a = new Audio(s.signedUrl); soundPreviewAudioRef.current = a; a.onended = () => { soundPreviewAudioRef.current = null }; a.play() }}
                                        style={{ padding: '7px 9px', borderRadius: 8, background: S.surface, border: `1px solid ${S.border}`, color: S.muted, display: 'flex', alignItems: 'center' }}>
                                        <Play size={11} />
                                      </button>
                                    </div>
                                  )
                                })}
                                {coldOpenEntrySfx && (
                                  <SliderRow label="Volume" value={Math.round((coldOpenEntrySfx.volume ?? 0.7) * 100)} min={0} max={100} step={5} format={v => `${v}%`}
                                    onChange={v => setColdOpenEntrySfx(p => p ? { ...p, volume: v / 100 } : p)} />
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      </div>

                      {/* Swoosh toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ color: S.muted, fontSize: 12 }}>Son de transition (swoosh)</p>
                        <Toggle value={swooshEnabled} onChange={setSwooshEnabled} />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </Card>
      )}

          {/* Denoise + ElevenLabs Voice Isolator */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: denoiseEnabled ? 16 : 0 }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Amélioration audio</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>FFmpeg ou Voice Isolator IA (ElevenLabs)</p>
              </div>
              <Toggle value={denoiseEnabled} onChange={setDenoiseEnabled} />
            </div>
            {denoiseEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Label>Méthode</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {([
                    { value: 'light',    label: 'Léger',  desc: 'Discret' },
                    { value: 'moderate', label: 'Modéré', desc: 'Recommandé' },
                    { value: 'strong',   label: 'Fort',   desc: 'Agressif' },
                  ] as { value: 'light' | 'moderate' | 'strong'; label: string; desc: string }[]).map(opt => (
                    <button key={opt.value} onClick={() => setDenoiseStrength(opt.value)}
                      onMouseEnter={() => setHoveredDenoiseStrength(opt.value)}
                      onMouseLeave={() => setHoveredDenoiseStrength(null)}
                      style={{
                        padding: '10px 8px', borderRadius: 12, textAlign: 'center',
                        ...selectableStyle(denoiseStrength === opt.value, hoveredDenoiseStrength === opt.value),
                      }}
                    >
                      <p style={{ color: denoiseStrength === opt.value ? S.text : S.muted, fontWeight: 700, fontSize: 12 }}>{opt.label}</p>
                      <p style={{ color: S.dim, fontSize: 9, marginTop: 2, fontFamily: 'monospace' }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
                <button onClick={() => setDenoiseStrength('isolate')}
                  style={{
                    padding: '10px 12px', borderRadius: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                    background: denoiseStrength === 'isolate' ? 'rgba(139,92,246,0.15)' : S.surface,
                    border: `1px solid ${denoiseStrength === 'isolate' ? 'rgba(139,92,246,0.6)' : S.border}`,
                  }}
                >
                  <span style={{ fontSize: 16 }}>✨</span>
                  <div>
                    <p style={{ color: denoiseStrength === 'isolate' ? '#c4b5fd' : S.muted, fontWeight: 700, fontSize: 12 }}>Voice Isolator IA</p>
                    <p style={{ color: S.dim, fontSize: 9, marginTop: 2, fontFamily: 'monospace' }}>ElevenLabs · Isole la voix, supprime tout le reste</p>
                  </div>
                </button>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Voice toggle — only for formats with TTS */}
      {showTTS && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Voix IA pour les questions</p>
              <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Lit chaque question à voix haute avant l'enregistrement</p>
            </div>
            <Toggle value={voiceEnabled} onChange={setVoiceEnabled} />
          </div>
        </Card>
      )}

      {/* Voice selection — only when enabled */}
      {voiceEnabled && voices.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label>Choisir une voix</Label>
          {voices.map(voice => {
            const isMM = voice.id.startsWith('mm:')
            const isCreator = !isMM && !STANDARD_VOICE_IDS.has(voice.id)
            const selected = selectedVoiceId === voice.id
            return (
              <button key={voice.id} onClick={() => setSelectedVoiceId(voice.id)}
                onMouseEnter={() => setHoveredVoiceId(voice.id)}
                onMouseLeave={() => setHoveredVoiceId(null)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                  ...selectableStyle(selected, hoveredVoiceId === voice.id),
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>{voice.name}</span>
                    {isMM && (
                      <span style={{ fontSize: 9, color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>MiniMax</span>
                    )}
                    {isCreator && (
                      <span style={{ fontSize: 9, color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>Creator</span>
                    )}
                  </div>
                  {(voice.gender || voice.accent) && (
                    <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>{[voice.gender, voice.accent].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <button onClick={e => { e.stopPropagation(); previewVoice(voice) }}
                  style={{ padding: 8, color: previewingVoiceId === voice.id ? '#fff' : S.muted, flexShrink: 0 }}>
                  <Play size={12} style={previewingVoiceId === voice.id ? { opacity: 1 } : {}} />
                </button>
              </button>
            )
          })}
        </div>
      )}

      {/* TTS volume — only when enabled */}
      {voiceEnabled && (
        <Card>
          <SliderRow
            label="Volume voix IA"
            value={audioSettings.ttsVolume ?? 1}
            min={0.1}
            max={2}
            step={0.05}
            format={v => `${Math.round(v * 100)}%`}
            onChange={v => setAudioSettings(p => ({ ...p, ttsVolume: v }))}
          />
          <p style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace', marginTop: 8 }}>
            Ajuste le volume de la voix IA par rapport à la vidéo de l'utilisateur
          </p>
        </Card>
      )}

    </div>
  )
}
