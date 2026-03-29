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

  // Get the presigned URL from the internal API
  const urlRes = await fetch(
    `${API}/api/sessions/${sessionId}/recordings/${recordingId}/url`,
    { headers: { 'x-admin-secret': ADMIN_SECRET }, cache: 'no-store' },
  )
  if (!urlRes.ok) return new Response('Not found', { status: 404 })

  const presignedUrl = await urlRes.text()

  // Forward Range header so MinIO can serve partial content (required by Chromium)
  const rangeHeader = req.headers.get('Range')
  const fetchHeaders: HeadersInit = {}
  if (rangeHeader) fetchHeaders['Range'] = rangeHeader

  const videoRes = await fetch(presignedUrl, { headers: fetchHeaders })
  if (!videoRes.ok && videoRes.status !== 206) {
    return new Response('Video unavailable', { status: 502 })
  }

  // Build response headers — always declare range support
  const resHeaders = new Headers()
  resHeaders.set('Accept-Ranges', 'bytes')
  resHeaders.set(
    'Content-Type',
    videoRes.headers.get('Content-Type') ?? 'video/mp4',
  )
  resHeaders.set('Cache-Control', 'private, max-age=3600')

  // Forward range-related headers from MinIO response
  const contentLength = videoRes.headers.get('Content-Length')
  if (contentLength) resHeaders.set('Content-Length', contentLength)

  const contentRange = videoRes.headers.get('Content-Range')
  if (contentRange) resHeaders.set('Content-Range', contentRange)

  return new Response(videoRes.body, {
    status: videoRes.status, // 200 or 206
    headers: resHeaders,
  })
}
