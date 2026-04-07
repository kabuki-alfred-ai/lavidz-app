import fs from 'fs'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

/**
 * Stream a fetch Response body directly to a file without loading it into JS heap.
 * Replaces: fs.writeFileSync(path, Buffer.from(await res.arrayBuffer()))
 */
export async function streamResponseToFile(response: Response, filePath: string): Promise<void> {
  if (!response.body) throw new Error('No response body')
  await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), fs.createWriteStream(filePath))
}

/**
 * Serve a local file with proper Range request support (required for video seeking).
 * Replaces the full readFileSync pattern while keeping Range/206 support.
 */
export function serveVideoFile(req: Request, filePath: string, fileSize: number, contentType = 'video/mp4'): Response {
  const rangeHeader = req.headers.get('range')

  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
    const start = parseInt(startStr, 10)
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1
    const chunkSize = end - start + 1

    const stream = fs.createReadStream(filePath, { start, end })
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': contentType,
      },
    })
  }

  const stream = fs.createReadStream(filePath)
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
    },
  })
}
