import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

const BUCKET = process.env.RUSTFS_BUCKET ?? 'lavidz-videos'

function s3() {
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

function presignS3() {
  return new S3Client({
    endpoint:
      process.env.RUSTFS_PUBLIC_ENDPOINT ??
      process.env.RUSTFS_ENDPOINT ??
      'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? 'admin',
      secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? 'password123',
    },
    forcePathStyle: true,
  })
}

// GET — redirect to signed URL of current avatar
export async function GET() {
  const session = await getSessionUser()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatarKey: true },
  })

  if (!user?.avatarKey) return new Response('No avatar', { status: 404 })

  const url = await getSignedUrl(
    presignS3(),
    new GetObjectCommand({ Bucket: BUCKET, Key: user.avatarKey }),
    { expiresIn: 3600 },
  )

  return Response.redirect(url, 302)
}

// POST — upload new avatar
export async function POST(req: Request) {
  const session = await getSessionUser()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return new Response('file required', { status: 400 })

  if (!file.type.startsWith('image/')) {
    return new Response('Only images are allowed', { status: 400 })
  }

  // Delete old avatar if any
  const existing = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatarKey: true },
  })
  if (existing?.avatarKey) {
    try {
      await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: existing.avatarKey }))
    } catch {}
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const key = `avatars/${session.userId}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await s3().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }),
  )

  await prisma.user.update({
    where: { id: session.userId },
    data: { avatarKey: key },
  })

  return Response.json({ key }, { status: 201 })
}
