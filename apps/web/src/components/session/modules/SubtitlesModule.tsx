'use client'

import { Loader2, RefreshCw } from 'lucide-react'
import type { WordTimestamp } from '@/remotion/themeTypes'
import { S, Card } from '@/components/session/process-view-utils'
import { TranscriptEditor } from '@/components/session/TranscriptEditor'
import type { ClipEdit } from '@/components/session/Timeline'
import type { CompositionSegment } from '@/remotion/LavidzComposition'
import { FPS, type RawRecording } from '@/components/session/process-view-utils'

interface SubtitlesModuleProps {
  recordings: RawRecording[]
  localTranscripts: Record<string, string>
  wordTimestampsMap: Record<string, WordTimestamp[]>
  transcribing: Record<string, boolean>
  clipEdits: ClipEdit[]
  playerFrameRef: React.MutableRefObject<number>
  segmentTimelineRef: React.MutableRefObject<{ id: string; startFrame: number; endFrame: number }[]>
  wordTimestampsRef: React.MutableRefObject<Record<string, WordTimestamp[]>>
  localTranscriptsRef: React.MutableRefObject<Record<string, string>>
  segments: CompositionSegment[] | null
  setWordTimestampsMap: React.Dispatch<React.SetStateAction<Record<string, WordTimestamp[]>>>
  setLocalTranscripts: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setSegments: React.Dispatch<React.SetStateAction<CompositionSegment[] | null>>
  regenerateTranscript: (recording: RawRecording) => void
  updateTranscript: (recordingId: string, text: string) => void
}

export function SubtitlesModule({
  recordings, localTranscripts, wordTimestampsMap, transcribing, clipEdits,
  playerFrameRef, segmentTimelineRef, wordTimestampsRef, localTranscriptsRef,
  segments, setWordTimestampsMap, setLocalTranscripts, setSegments,
  regenerateTranscript, updateTranscript,
}: SubtitlesModuleProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <p style={{ color: S.muted, fontSize: 12 }}>
          Les sous-titres sont générés à partir de ces transcriptions. Modifiez-les ou régénérez-les si elles sont vides ou incorrectes.
        </p>
      </Card>
      {recordings.map((rec) => {
        const isTranscribing = !!transcribing[rec.id]
        const text = localTranscripts[rec.id] ?? ''
        const hasText = text.trim().length > 0
        return (
          <Card key={rec.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 13, lineHeight: 1.4 }}>
                  {rec.questionText.length > 80 ? rec.questionText.slice(0, 80) + '…' : rec.questionText}
                </p>
                <span style={{
                  display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 20, fontSize: 10,
                  fontFamily: 'monospace',
                  background: hasText ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                  color: hasText ? 'rgb(52,211,153)' : 'rgb(248,113,113)',
                  border: `1px solid ${hasText ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
                }}>
                  {hasText ? `${text.split(/\s+/).filter(Boolean).length} mots` : 'Aucun transcript'}
                </span>
              </div>
              <button
                onClick={() => regenerateTranscript(rec)}
                disabled={isTranscribing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', flexShrink: 0,
                  borderRadius: 10, background: isTranscribing ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)',
                  border: `1px solid ${S.border}`, color: isTranscribing ? S.muted : S.text,
                  fontSize: 12, fontWeight: 600,
                }}
              >
                {isTranscribing
                  ? <><Loader2 size={12} className="animate-spin" /> Transcription...</>
                  : <><RefreshCw size={12} /> Régénérer</>
                }
              </button>
            </div>
            {/* Token view or editable transcript */}
            {(() => {
              const tokens = wordTimestampsMap[rec.id]
              if (tokens?.length) {
                const recId = rec.id
                const recEdit = clipEdits.find(e => e.recordingId === recId)
                const visibleIntervals = recEdit?.visibleRanges.map(r => ({
                  start: r.startFrame / FPS,
                  end: r.endFrame / FPS,
                }))
                return (
                  <TranscriptEditor
                    tokens={tokens}
                    visibleIntervals={visibleIntervals}
                    getTimeSec={() => {
                      const f = playerFrameRef.current
                      const seg = segmentTimelineRef.current.find(s => s.id === recId)
                      if (!seg || f < seg.startFrame || f >= seg.endFrame) return -1
                      return (f - seg.startFrame) / FPS
                    }}
                    onChange={newTokens => {
                      setWordTimestampsMap(p => ({ ...p, [recId]: newTokens }))
                      wordTimestampsRef.current[recId] = newTokens
                      const newText = newTokens.map(t => t.word).join(' ')
                      setLocalTranscripts(p => ({ ...p, [recId]: newText }))
                      localTranscriptsRef.current[recId] = newText
                      setSegments(prev => prev ? prev.map(s =>
                        s.id === recId ? { ...s, transcript: newText, wordTimestamps: newTokens } : s
                      ) : prev)
                    }}
                  />
                )
              }
              return (
                <textarea
                  value={text}
                  onChange={e => updateTranscript(rec.id, e.target.value)}
                  placeholder="Pas de transcription — cliquez sur Régénérer pour analyser la vidéo avec Whisper"
                  rows={4}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.border}`,
                    borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 13, outline: 'none',
                    resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit',
                  }}
                />
              )
            })()}
          </Card>
        )
      })}
    </div>
  )
}
