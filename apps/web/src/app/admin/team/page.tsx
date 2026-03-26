export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { TeamClient } from './TeamClient'
import { redirect } from 'next/navigation'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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

const BUCKET = process.env.RUSTFS_BUCKET ?? 'lavidz-videos'

export default async function TeamPage() {
  const user = await getSessionUser()
  if (user?.role !== 'SUPERADMIN') redirect('/admin')

  const [admins, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'SUPERADMIN' },
      select: { id: true, email: true, firstName: true, lastName: true, createdAt: true, avatarKey: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.adminInvitation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        invitedBy: { select: { email: true, firstName: true, lastName: true } },
      },
    }),
  ])

  const presign = presignS3()
  const adminsWithAvatars = await Promise.all(
    admins.map(async (admin) => ({
      ...admin,
      createdAt: admin.createdAt.toISOString(),
      avatarUrl: admin.avatarKey
        ? await getSignedUrl(presign, new GetObjectCommand({ Bucket: BUCKET, Key: admin.avatarKey }), { expiresIn: 3600 })
        : null,
    })),
  )

  const serializedInvitations = JSON.parse(JSON.stringify(invitations))

  return (
    <TeamClient
      admins={adminsWithAvatars}
      invitations={serializedInvitations}
      currentUserId={user.userId}
    />
  )
}
