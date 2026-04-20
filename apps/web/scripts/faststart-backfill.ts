/**
 * One-shot: remux every cached processed video in MinIO with `+faststart`.
 *
 * Legacy files were uploaded before the cleanvoice pipeline remuxed to
 * faststart, so their moov atom sits at the end of the file. Chromium (and
 * Remotion's renderer) cannot seek into those files within delayRender's
 * window and times out.
 *
 * Usage (from repo root):
 *   docker compose exec web pnpm tsx scripts/faststart-backfill.ts
 *
 * Options:
 *   --prefix=<s3-prefix>   Scan this prefix instead of the default
 *                          (default: sessions/)
 *   --key=<single-key>     Only remux this exact key (skips listing)
 *   --dry                  List targets, no download/upload
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { spawnSync, spawn } from 'child_process'

const BUCKET = process.env.RUSTFS_BUCKET ?? 'lavidz-videos'
const ENDPOINT = process.env.RUSTFS_ENDPOINT ?? 'http://localhost:9000'

const args = process.argv.slice(2)
const argMap = Object.fromEntries(args
  .filter(a => a.startsWith('--'))
  .map(a => {
    const [k, ...rest] = a.slice(2).split('=')
    return [k, rest.join('=') || true]
  }))

const PREFIX = (argMap.prefix as string) ?? 'sessions/'
const SINGLE_KEY = argMap.key as string | undefined
const DRY_RUN = argMap.dry === true

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? 'admin',
    secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? 'password123',
  },
  forcePathStyle: true,
  // MinIO compat — see lib/s3.ts for rationale.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const FFMPEG_CANDIDATES = ['ffmpeg', '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg']

function findFfmpeg(): string {
  for (const c of FFMPEG_CANDIDATES) {
    const r = spawnSync(c, ['-version'], { timeout: 3000 })
    if (r.status === 0) return c
  }
  throw new Error('ffmpeg not found (tried: ' + FFMPEG_CANDIDATES.join(', ') + ')')
}

async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let token: string | undefined
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
    }))
    for (const obj of res.Contents ?? []) {
      const k = obj.Key!
      if (k.includes('/cache/processed-') && k.endsWith('.mp4')) keys.push(k)
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return keys
}

async function downloadKey(key: string, dest: string): Promise<void> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const body = res.Body as NodeJS.ReadableStream
  await new Promise<void>((resolve, reject) => {
    const out = fs.createWriteStream(dest)
    body.pipe(out)
    out.on('finish', () => resolve())
    out.on('error', reject)
    body.on('error', reject)
  })
}

// Returns true if moov is in the first 64 KiB (faststart-compatible).
function isFaststart(filePath: string): boolean {
  const fd = fs.openSync(filePath, 'r')
  try {
    const size = Math.min(fs.statSync(filePath).size, 64 * 1024)
    const buf = Buffer.alloc(size)
    fs.readSync(fd, buf, 0, size, 0)
    return buf.includes(Buffer.from('moov'))
  } finally {
    fs.closeSync(fd)
  }
}

async function remux(ffmpeg: string, input: string, output: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpeg, ['-y', '-i', input, '-c', 'copy', '-movflags', '+faststart', output], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    p.stderr?.on('data', (d) => { stderr += d.toString() })
    p.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`))
    })
    p.on('error', reject)
  })
}

async function uploadKey(key: string, src: string): Promise<void> {
  const size = fs.statSync(src).size
  const body = fs.createReadStream(src)
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentLength: size,
    ContentType: 'video/mp4',
  }))
}

async function processKey(ffmpeg: string, key: string): Promise<'remuxed' | 'skipped' | 'failed'> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faststart-'))
  const raw = path.join(tmpDir, 'in.mp4')
  const out = path.join(tmpDir, 'out.mp4')
  try {
    await downloadKey(key, raw)
    if (isFaststart(raw)) return 'skipped'
    await remux(ffmpeg, raw, out)
    if (!isFaststart(out)) throw new Error('remux did not produce faststart output')
    await uploadKey(key, out)
    return 'remuxed'
  } catch (e) {
    console.error(`[${key}] failed:`, (e as Error).message)
    return 'failed'
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}

async function main() {
  const ffmpeg = findFfmpeg()
  console.log(`ffmpeg: ${ffmpeg}`)
  console.log(`bucket: ${BUCKET} @ ${ENDPOINT}`)
  console.log(`mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const keys = SINGLE_KEY ? [SINGLE_KEY] : await listKeys(PREFIX)
  console.log(`found ${keys.length} candidate(s)`)
  if (DRY_RUN) {
    for (const k of keys) console.log('  ' + k)
    return
  }

  let remuxed = 0, skipped = 0, failed = 0
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    process.stdout.write(`[${i + 1}/${keys.length}] ${key} ... `)
    const status = await processKey(ffmpeg, key)
    if (status === 'remuxed') remuxed++
    else if (status === 'skipped') skipped++
    else failed++
    console.log(status)
  }

  console.log(`\ndone: ${remuxed} remuxed, ${skipped} already ok, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('fatal:', e)
  process.exit(1)
})
