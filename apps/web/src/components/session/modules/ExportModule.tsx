'use client'

import { Loader2 } from 'lucide-react'
import type { CompositionSegment } from '@/remotion/LavidzComposition'
import type { TransitionTheme, IntroSettings, OutroSettings, MotionSettings, AudioSettings } from '@/remotion/themeTypes'
import type { SubtitleSettings } from '@/remotion/subtitleTypes'
import { ServerRenderer, type ServerRendererHandle } from '@/components/session/ServerRenderer'
import { S, FORMATS, FPS, type FormatKey } from '@/components/session/process-view-utils'

interface ExportModuleProps {
  ready: boolean
  effectiveSegments: CompositionSegment[] | null | undefined
  effectiveVideoUrls: string[]
  recordings: { videoUrl: string }[]
  selectedVoiceId: string
  themeName: string
  theme: TransitionTheme
  intro: IntroSettings
  outro: OutroSettings
  subtitleSettings: SubtitleSettings
  questionCardFrames: number
  format: FormatKey
  sessionId: string
  motionSettings: MotionSettings
  audioSettings: AudioSettings
  serverRendererRef: React.RefObject<ServerRendererHandle | null>
  renderOutputUrl: string | null
  renderOutputUrlRef: React.MutableRefObject<string | null>
  setRenderOutputUrl: (url: string | null) => void
}

export function ExportModule({
  ready, effectiveSegments, effectiveVideoUrls, recordings,
  selectedVoiceId, themeName, theme, intro, outro, subtitleSettings,
  questionCardFrames, format, sessionId, motionSettings, audioSettings,
  serverRendererRef, renderOutputUrl, renderOutputUrlRef, setRenderOutputUrl,
}: ExportModuleProps) {
  const fmt = FORMATS[format]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {ready && effectiveSegments && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${S.border}`, borderRadius: 12, padding: 20 }}>
            <p style={{ color: S.text, fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>Prêt à exporter</p>
            <p style={{ color: S.muted, fontSize: 12, margin: '0 0 16px' }}>
              {fmt.width}×{fmt.height} · {FPS}fps · H264
            </p>
            <button
              onClick={() => serverRendererRef.current?.render()}
              disabled={!!serverRendererRef.current?.rendering}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 10, fontSize: 15, fontWeight: 800,
                background: serverRendererRef.current?.rendering ? 'rgba(255,255,255,0.1)' : '#ffffff',
                border: 'none', color: serverRendererRef.current?.rendering ? S.muted : '#0a0a0a',
                cursor: serverRendererRef.current?.rendering ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'opacity 0.15s',
              }}>
              {serverRendererRef.current?.rendering ? (
                <><Loader2 size={16} className="animate-spin" /> Rendu en cours…</>
              ) : renderOutputUrl ? (
                '↻ Ré-exporter'
              ) : (
                "▶ Lancer l'export"
              )}
            </button>
          </div>
          <ServerRenderer
            ref={serverRendererRef}
            segments={effectiveSegments}
            originalVideoUrls={effectiveVideoUrls.length > 0 ? effectiveVideoUrls : recordings.map(r => r.videoUrl)}
            voiceId={selectedVoiceId}
            themeName={themeName}
            theme={theme}
            intro={intro}
            outro={outro}
            subtitleSettings={subtitleSettings}
            questionCardFrames={questionCardFrames}
            fps={FPS}
            width={fmt.width}
            height={fmt.height}
            sessionId={sessionId}
            motionSettings={motionSettings}
            audioSettings={audioSettings}
            onRenderComplete={(url) => {
              if (renderOutputUrlRef.current) URL.revokeObjectURL(renderOutputUrlRef.current)
              renderOutputUrlRef.current = url
              setRenderOutputUrl(url)
            }}
          />
        </div>
      )}

      {!ready && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 12, padding: 20 }}>
          <p style={{ color: '#f59e0b', fontWeight: 600, fontSize: 13, margin: '0 0 4px' }}>Vidéos en cours de préparation</p>
          <p style={{ color: S.muted, fontSize: 12, margin: 0 }}>Revenez sur cet onglet une fois la préparation terminée.</p>
        </div>
      )}
    </div>
  )
}
