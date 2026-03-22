export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function GET(
  req: Request,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId } = await params
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return new Response('Missing sessionId', { status: 400 })

  // Get the presigned URL from the internal API (server-side, no mixed content)
  const urlRes = await fetch(
    `${API}/api/sessions/${sessionId}/recordings/${recordingId}/url`,
    { headers: { 'x-admin-secret': ADMIN_SECRET }, cache: 'no-store' },
  )
  if (!urlRes.ok) return new Response('Not found', { status: 404 })

  const presignedUrl = await urlRes.text()

  // Fetch the video from MinIO server-side and stream to browser
  const videoRes = await fetch(presignedUrl)
  if (!videoRes.ok) return new Response('Video unavailable', { status: 502 })

  return new Response(videoRes.body, {
    headers: {
      'Content-Type': videoRes.headers.get('Content-Type') ?? 'video/webm',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
