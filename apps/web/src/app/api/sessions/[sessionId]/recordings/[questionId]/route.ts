import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export const runtime = 'nodejs'

const s3 = new S3Client({
  endpoint: process.env.RUSTFS_ENDPOINT ?? 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? 'admin',
    secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? 'password123',
  },
  forcePathStyle: true,
})

const BUCKET = process.env.RUSTFS_BUCKET ?? 'lavidz-videos'
const API = process.env.API_URL ?? 'http://localhost:3001'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; questionId: string }> },
) {
  const { sessionId, questionId } = await params
  const contentType = req.headers.get('content-type') ?? 'video/webm'
  const ext = contentType.includes('webm') ? 'webm' : 'mp4'
  const key = `sessions/${sessionId}/raw/${questionId}.${ext}`

  if (!req.body) {
    return NextResponse.json({ error: 'No body' }, { status: 400 })
  }

  const buffer = Buffer.from(await req.arrayBuffer())

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.byteLength,
    }),
  )

  const confirmRes = await fetch(`${API}/api/sessions/${sessionId}/recordings/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, key, mimeType: contentType }),
  })

  if (!confirmRes.ok) {
    return NextResponse.json({ error: 'Failed to confirm recording' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
