import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params
  const body = await req.json()

  const res = await fetch(`${API}/api/sessions/${sessionId}/recordings/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to confirm recording' }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
