import { prisma } from '@lavidz/database'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import type { Readable } from 'stream'

export const runtime = 'nodejs'

// Proxy route for sound assets — does NOT use presigned URLs so it never expires.
// Used by Remotion renderer (server-side) and client previews.
// Auth: open read access (sounds are non-sensitive static assets).

const BUCKET = process.env.RUSTFS_BUCKET ?? 'lavidz-videos'

function getS3Client() {
  return new S3Client({
    endpoint: process.env.RUSTFS_ENDPOINT ?? 'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? 'admin',
      secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? 'password123',
    },
    forcePathStyle: true,
  })
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const sound = await prisma.soundAsset.findUnique({ where: { id } })
  if (!sound) return new Response('Not found', { status: 404 })

  const s3 = getS3Client()
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: sound.fileKey })

  let s3Res
  try {
    s3Res = await s3.send(cmd)
  } catch {
    return new Response('Failed to fetch audio from storage', { status: 502 })
  }

  const ext = sound.fileKey.split('.').pop()?.toLowerCase() ?? 'mp3'
  const contentType = ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : 'audio/mpeg'
  const contentLength = s3Res.ContentLength

  // Support HTTP Range for Remotion's audio seeking
  const rangeHeader = req.headers.get('range')
  const body = s3Res.Body as Readable

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=86400',
  }
  if (contentLength) headers['Content-Length'] = String(contentLength)

  if (rangeHeader && contentLength) {
    const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
    const start = parseInt(startStr, 10)
    const end = endStr ? parseInt(endStr, 10) : contentLength - 1
    headers['Content-Range'] = `bytes ${start}-${end}/${contentLength}`
    headers['Content-Length'] = String(end - start + 1)
    // For range requests we still stream the full body — Remotion handles partial reads
    return new Response(body as any, { status: 206, headers })
  }

  return new Response(body as any, { status: 200, headers })
}
