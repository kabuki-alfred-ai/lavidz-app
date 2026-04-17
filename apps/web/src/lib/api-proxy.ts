import { getSessionUser } from './auth'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function getAuthHeaders(): Promise<{ orgId: string | null; headers: Record<string, string> } | null> {
  const user = await getSessionUser()
  if (!user) return null

  const orgId = (user.role === 'SUPERADMIN' && user.activeOrgId)
    ? user.activeOrgId
    : user.organizationId

  const headers: Record<string, string> = { 'x-admin-secret': ADMIN_SECRET }
  if (orgId) headers['x-organization-id'] = orgId

  return { orgId, headers }
}

export function apiUrl(path: string): string {
  return `${API}/api${path}`
}

export function unauthorized() {
  return new Response('Unauthorized', { status: 401 })
}

export function noOrg() {
  return new Response('Aucune organisation', { status: 400 })
}
