import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

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

function getPresignClient() {
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

const BUCKET = process.env.RUSTFS_BUCKET ?? 'lavidz-videos'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const sounds = await prisma.soundAsset.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const presign = getPresignClient()
  const result = await Promise.all(
    sounds.map(async (s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      signedUrl: await getSignedUrl(
        presign,
        new GetObjectCommand({ Bucket: BUCKET, Key: s.fileKey }),
        { expiresIn: 3600 },
      ),
    })),
  )

  return Response.json(result)
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const formData = await req.formData()
  const name = formData.get('name') as string | null
  const tag = formData.get('tag') as string | null
  const file = formData.get('file') as File | null

  if (!name || !tag || !file) {
    return new Response('name, tag and file are required', { status: 400 })
  }

  const validTags = ['TRANSITION', 'INTRO', 'OUTRO', 'BACKGROUND']
  if (!validTags.includes(tag)) {
    return new Response('Invalid tag', { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'mp3'
  const key = `sounds/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const s3 = getS3Client()
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type || 'audio/mpeg',
    }),
  )

  const sound = await prisma.soundAsset.create({
    data: { name, tag: tag as any, fileKey: key },
  })

  return Response.json({ ...sound, createdAt: sound.createdAt.toISOString(), updatedAt: sound.updatedAt.toISOString() }, { status: 201 })
}
