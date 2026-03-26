import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

export const runtime = 'nodejs'

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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const sound = await prisma.soundAsset.findUnique({ where: { id } })
  if (!sound) return new Response('Not found', { status: 404 })

  const s3 = getS3Client()
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: sound.fileKey }))
  await prisma.soundAsset.delete({ where: { id } })

  return new Response(null, { status: 204 })
}
