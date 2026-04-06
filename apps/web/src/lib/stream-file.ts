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
 * Stream a file to a Response without loading it into JS heap.
 * Replaces: new Response(fs.readFileSync(filePath), { headers })
 */
export function streamFileResponse(filePath: string, contentType: string, fileSize: number): Response {
  const stream = fs.createReadStream(filePath)
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
    },
  })
}
