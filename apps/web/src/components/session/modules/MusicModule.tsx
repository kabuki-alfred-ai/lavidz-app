'use client'

import { Play } from 'lucide-react'
import type { AudioSettings } from '@/remotion/themeTypes'
import { S, Card, SliderRow } from '@/components/session/process-view-utils'

interface SoundLibraryItem {
  id: string
  name: string
  tag: string
  signedUrl: string
}

interface MusicModuleProps {
  audioSettings: AudioSettings
  setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>
  soundLibrary: SoundLibraryItem[]
  soundPreviewAudioRef: React.MutableRefObject<HTMLAudioElement | null>
}

export function MusicModule({ audioSettings, setAudioSettings, soundLibrary, soundPreviewAudioRef }: MusicModuleProps) {
  const bgSounds = soundLibrary.filter(s => s.tag === 'BACKGROUND')
  const track = audioSettings.bgMusic

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <p style={{ color: S.text, fontWeight: 700, fontSize: 14 }}>Musique d'ambiance</p>
          <p style={{ color: S.muted, fontSize: 11, marginTop: 4 }}>Choisissez un fond sonore pour accompagner la vidéo</p>
        </div>
        {bgSounds.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <p style={{ color: S.dim, fontSize: 12, fontFamily: 'monospace' }}>
              Aucune musique "Background Sound" dans la bibliothèque.
            </p>
            <p style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace', marginTop: 6 }}>
              Ajoutez-en depuis <strong style={{ color: S.muted }}>Admin → Sons</strong> avec le tag "Background Sound".
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* No music option */}
            <button
              onClick={() => setAudioSettings(p => ({ ...p, bgMusic: undefined }))}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 12, textAlign: 'left',
                background: !track ? 'rgba(255,255,255,0.1)' : S.surface,
                border: `1px solid ${!track ? 'rgba(255,255,255,0.3)' : S.border}`,
              }}
            >
              <span style={{ color: !track ? S.text : S.muted, fontSize: 13, fontFamily: 'monospace' }}>Aucune musique</span>
              {!track && <span style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace' }}>actif</span>}
            </button>
            {bgSounds.map(s => {
              const isActive = track?.prompt === s.id
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setAudioSettings(p => ({
                      ...p,
                      bgMusic: isActive ? undefined : { prompt: s.id, url: `/api/admin/sounds/${s.id}/audio`, volume: 0.25 },
                    }))}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 12, textAlign: 'left',
                      background: isActive ? 'rgba(255,255,255,0.1)' : S.surface,
                      border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : S.border}`,
                    }}
                  >
                    <span style={{ color: isActive ? S.text : S.muted, fontSize: 13 }}>{s.name}</span>
                    {isActive && <span style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace' }}>actif</span>}
                  </button>
                  <button
                    onClick={() => {
                      if (soundPreviewAudioRef.current) { soundPreviewAudioRef.current.pause(); soundPreviewAudioRef.current = null }
                      const a = new Audio(s.signedUrl); soundPreviewAudioRef.current = a
                      a.onended = () => { soundPreviewAudioRef.current = null }; a.play()
                    }}
                    style={{ padding: '10px 12px', borderRadius: 12, background: S.surface, border: `1px solid ${S.border}`, color: S.muted, display: 'flex', alignItems: 'center' }}
                    title="Écouter"
                  >
                    <Play size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {track?.url && (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: S.text, fontWeight: 600, fontSize: 13 }}>Paramètres</p>
          <SliderRow
            label="Volume musique"
            value={Math.round((track.volume ?? 0.25) * 100)}
            min={0} max={100} step={5}
            format={v => `${v}%`}
            onChange={v => setAudioSettings(p => ({ ...p, bgMusic: { ...p.bgMusic!, volume: v / 100 } }))}
          />
        </Card>
      )}
    </div>
  )
}
