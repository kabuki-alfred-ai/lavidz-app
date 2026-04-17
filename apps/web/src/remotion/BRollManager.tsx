import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { BRollItem } from './themeTypes'

function BRollClip({ item }: { item: BRollItem }) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  // Fade in over 8 frames
  const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })
  // Fade out last 8 frames
  const fadeOut = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  // Subtle Ken Burns zoom
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.06], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <OffthreadVideo
          src={item.videoUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
        />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

interface BRollManagerProps {
  items: BRollItem[]
  globalFrameOffset: number
}

export function BRollManager({ items, globalFrameOffset }: BRollManagerProps) {
  const { fps } = useVideoConfig()

  if (!items.length) return null

  return (
    <AbsoluteFill style={{ zIndex: 10 }}>
      {items.map((item) => {
        const fromFrame = Math.round(item.timestampSeconds * fps) + globalFrameOffset
        const durationFrames = Math.round(item.durationSeconds * fps)

        return (
          <Sequence key={item.id} from={fromFrame} durationInFrames={durationFrames}>
            <BRollClip item={item} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
