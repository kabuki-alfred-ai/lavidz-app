import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name)
  private readonly client: S3Client
  private readonly presignClient: S3Client
  private readonly bucket: string
  private readonly urlCache = new Map<string, { url: string; expiresAt: number }>()

  constructor() {
    const credentials = {
      accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? 'admin',
      secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? 'password123',
    }
    // MinIO doesn't fully support @aws-sdk v3.7xx's default checksum-mode
    // headers. Those extra params (`x-amz-checksum-mode=ENABLED`, etc.) can
    // hang GET responses and break signed URLs consumed by non-AWS clients
    // (Chromium / Remotion renderer). WHEN_REQUIRED disables the opportunistic
    // checksum path.
    const checksumOpts = {
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
      responseChecksumValidation: 'WHEN_REQUIRED' as const,
    }
    this.client = new S3Client({
      endpoint: process.env.RUSTFS_ENDPOINT ?? 'http://localhost:9000',
      region: 'us-east-1',
      credentials,
      forcePathStyle: true,
      ...checksumOpts,
    })
    this.presignClient = new S3Client({
      endpoint: process.env.RUSTFS_PUBLIC_ENDPOINT ?? process.env.RUSTFS_ENDPOINT ?? 'http://localhost:9000',
      region: 'us-east-1',
      credentials,
      forcePathStyle: true,
      ...checksumOpts,
    })
    this.bucket = process.env.RUSTFS_BUCKET ?? 'lavidz-videos'
  }

  async onModuleInit() {
    await this.ensureBucket()
  }

  private async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
      this.logger.log(`Bucket "${this.bucket}" already exists`)
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
        this.logger.log(`Bucket "${this.bucket}" created`)
      } catch (err) {
        this.logger.error(`Failed to create bucket "${this.bucket}"`, err)
      }
    }
  }

  async upload(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    )
    return key
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const now = Date.now()
    const cached = this.urlCache.get(key)
    if (cached && cached.expiresAt > now) return cached.url

    const url = await getSignedUrl(
      this.presignClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    )
    // Cache for 90% of expiry duration to avoid serving near-expired URLs
    this.urlCache.set(key, { url, expiresAt: now + expiresIn * 900 })
    return url
  }

  async getPresignedPutUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.presignClient,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn },
    )
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}
