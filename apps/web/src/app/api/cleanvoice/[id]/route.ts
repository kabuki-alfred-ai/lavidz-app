import fs from 'fs'
import path from 'path'
import { isTmpFileExpired } from '@/lib/tmp-cleanup'
import { serveVideoFile } from '@/lib/stream-file'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-z0-9-]+$/.test(id)) return new Response('Not found', { status: 404 })

  const filePath = path.join('/tmp', `cleanvoice-${id}.mp4`)
  if (!fs.existsSync(filePath) || isTmpFileExpired(filePath)) return new Response('Not found', { status: 404 })

  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const rangeHeader = req.headers.get('range')

  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
    const start = parseInt(startStr, 10)
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1
    const chunkSize = end - start + 1

    const chunk = Buffer.allocUnsafe(chunkSize)
    const fd = fs.openSync(filePath, 'r')
    fs.readSync(fd, chunk, 0, chunkSize, start)
    fs.closeSync(fd)

    return new Response(chunk, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': 'video/mp4',
      },
    })
  }

  return serveVideoFile(req, filePath, fileSize)
}
