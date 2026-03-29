import fs from 'fs'
import path from 'path'
import { isTmpFileExpired } from '@/lib/tmp-cleanup'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-z0-9-]+$/.test(id)) return new Response('Not found', { status: 404 })

  const filePath = path.join('/tmp', `cleanvoice-in-${id}.mp4`)
  if (!fs.existsSync(filePath) || isTmpFileExpired(filePath)) return new Response('Not found', { status: 404 })

  const data = fs.readFileSync(filePath)
  return new Response(data, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(data.byteLength),
      'Accept-Ranges': 'bytes',
    },
  })
}
