import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

const SFX_DIR = process.env.SOUND_EFFECTS_DIR
  ?? path.join(process.cwd(), '..', '..', 'sound-effects')

const MIME: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
}

export async function GET(req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params

  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return new Response('Not found', { status: 404 })
  }

  const filePath = path.join(SFX_DIR, filename)
  if (!fs.existsSync(filePath)) return new Response('Not found', { status: 404 })

  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const contentType = MIME[ext] ?? 'audio/wav'

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
        'Content-Type': contentType,
      },
    })
  }

  const data = fs.readFileSync(filePath)
  return new Response(data, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
    },
  })
}
