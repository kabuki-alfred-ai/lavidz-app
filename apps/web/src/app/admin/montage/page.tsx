import { apiClient } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'
import type { ThemeDto } from '@lavidz/types'
import { MontageClient } from './MontageClient'

interface SubmittedSession {
  id: string
  status: string
  recipientEmail?: string
  recipientName?: string
  version: number
  finalVideoKey?: string
  submittedAt?: string
  deliveredAt?: string
  theme: { id: string; name: string; slug: string }
}

export default async function MontagePage() {
  const user = await getSessionUser()
  const effectiveOrgId =
    user?.role === 'SUPERADMIN' && user?.activeOrgId
      ? user.activeOrgId
      : user?.organizationId ?? null

  const orgHeaders = effectiveOrgId ? { 'x-organization-id': effectiveOrgId } : {}

  let themes: ThemeDto[] = []
  let sessions: SubmittedSession[] = []

  try {
    themes = await apiClient<ThemeDto[]>('/themes/admin/all', { headers: orgHeaders })
  } catch {
    themes = []
  }

  try {
    sessions = await apiClient<SubmittedSession[]>('/sessions/submitted', { headers: orgHeaders })
  } catch {
    sessions = []
  }

  return <MontageClient themes={themes} initialSessions={sessions} />
}
