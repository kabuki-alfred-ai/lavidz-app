import fs from 'fs'
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export function getS3Client(): S3Client {
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

export function getBucket(): string {
  return process.env.RUSTFS_BUCKET ?? 'lavidz-videos'
}

export async function uploadFileToS3(
  filePath: string,
  key: string,
  contentType: string,
): Promise<void> {
  const { size } = await fs.promises.stat(filePath)
  const stream = fs.createReadStream(filePath)
  const s3 = getS3Client()
  await s3.send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: stream,
    ContentLength: size,
    ContentType: contentType,
  }))
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getS3Client().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }))
    return true
  } catch {
    return false
  }
}

export async function presignedGetUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn },
  )
}
