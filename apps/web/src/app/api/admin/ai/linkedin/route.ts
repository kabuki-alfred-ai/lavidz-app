export const runtime = 'nodejs'

import { getFreshUser } from '@/lib/get-fresh-user'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function GET(req: Request) {
  try {
    const user = await getFreshUser()
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url')
    if (!url) return new Response('url requis', { status: 400 })

    const res = await fetch(`${API}/api/ai/linkedin/preview?url=${encodeURIComponent(url)}`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
    })

    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getFreshUser()
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }
    if (!user.organizationId) {
      return new Response('Aucune organisation assignée.', { status: 400 })
    }

    const body = await req.json()

    const res = await fetch(`${API}/api/ai/linkedin/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
      body: JSON.stringify({ ...body, organizationId: user.organizationId }),
    })

    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
