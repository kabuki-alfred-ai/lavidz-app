import { SESSION_STATUS_COPY, type SessionStatus } from '@/lib/kabou-voice'

type Size = 'sm' | 'md'

type Tone = {
  dot: string
  text: string
  pulse: boolean
}

const TONES: Record<SessionStatus, Tone> = {
  PENDING: { dot: 'bg-amber-500', text: 'text-amber-700', pulse: false },
  RECORDING: { dot: 'bg-primary', text: 'text-primary', pulse: true },
  SUBMITTED: { dot: 'bg-primary', text: 'text-primary', pulse: true },
  PROCESSING: { dot: 'bg-primary', text: 'text-primary', pulse: true },
  DONE: { dot: 'bg-emerald-500', text: 'text-emerald-700', pulse: false },
  LIVE: { dot: 'bg-emerald-600', text: 'text-emerald-700', pulse: false },
  REPLACED: { dot: 'bg-muted-foreground/40', text: 'text-muted-foreground', pulse: false },
  FAILED: { dot: 'bg-destructive', text: 'text-destructive', pulse: false },
}

export function SessionStatusBadge({
  status,
  size = 'sm',
}: {
  status: string
  size?: Size
}) {
  const normalized = (TONES[status as SessionStatus] ? (status as SessionStatus) : 'PENDING') as SessionStatus
  const tone = TONES[normalized]
  const label = SESSION_STATUS_COPY[normalized]
  const textSize = size === 'md' ? 'text-sm' : 'text-xs'
  const dotSize = size === 'md' ? 'h-2 w-2' : 'h-1.5 w-1.5'

  return (
    <span className={`inline-flex items-center gap-1.5 ${textSize} ${tone.text}`}>
      <span
        aria-hidden
        className={`inline-block ${dotSize} rounded-full ${tone.dot} ${tone.pulse ? 'animate-pulse' : ''}`}
      />
      {label}
    </span>
  )
}
