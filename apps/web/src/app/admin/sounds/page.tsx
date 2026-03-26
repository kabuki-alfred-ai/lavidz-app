import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { redirect } from 'next/navigation'
import { SoundsClient } from './SoundsClient'
import type { SoundAssetDto } from '@lavidz/types'

export const runtime = 'nodejs'

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

export default async function AdminSoundsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/admin/login')

  const sounds = await prisma.soundAsset.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const presign = getPresignClient()
  const soundsWithUrls: SoundAssetDto[] = await Promise.all(
    sounds.map(async (s) => ({
      id: s.id,
      name: s.name,
      tag: s.tag,
      fileKey: s.fileKey,
      createdAt: s.createdAt.toISOString(),
      signedUrl: await getSignedUrl(
        presign,
        new GetObjectCommand({ Bucket: BUCKET, Key: s.fileKey }),
        { expiresIn: 3600 },
      ),
    })),
  )

  return <SoundsClient initialSounds={soundsWithUrls} />
}
