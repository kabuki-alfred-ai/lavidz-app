export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { getFreshUser } from '@/lib/get-fresh-user'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function GET(req: NextRequest) {
  try {
    const user = await getFreshUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { searchParams } = req.nextUrl
    const q = searchParams.get('q') ?? ''
    const perPage = searchParams.get('perPage') ?? '10'

    const res = await fetch(`${API}/api/broll/search?q=${encodeURIComponent(q)}&perPage=${perPage}`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
