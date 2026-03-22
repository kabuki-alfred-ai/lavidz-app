import { apiClient } from '@/lib/api'
import type { ThemeDto } from '@lavidz/types'
import { MontageClient } from './MontageClient'

interface SubmittedSession {
  id: string
  status: string
  recipientEmail?: string
  recipientName?: string
  finalVideoKey?: string
  submittedAt?: string
  deliveredAt?: string
  theme: { id: string; name: string; slug: string }
}

export default async function MontagePage() {
  let themes: ThemeDto[] = []
  let sessions: SubmittedSession[] = []

  try {
    themes = await apiClient<ThemeDto[]>('/themes/admin/all')
  } catch {
    themes = []
  }

  try {
    sessions = await apiClient<SubmittedSession[]>('/sessions/submitted')
  } catch {
    sessions = []
  }

  return <MontageClient themes={themes} initialSessions={sessions} />
}
