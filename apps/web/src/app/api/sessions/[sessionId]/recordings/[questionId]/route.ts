import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; questionId: string }> },
) {
  const { sessionId, questionId } = await params
  const mimeType = req.nextUrl.searchParams.get('mimeType') ?? 'video/webm'

  const res = await fetch(
    `${API}/api/sessions/${sessionId}/recordings/${questionId}/upload-url?mimeType=${encodeURIComponent(mimeType)}`,
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to get upload URL' }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
