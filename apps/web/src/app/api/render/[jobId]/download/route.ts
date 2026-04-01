import fs from 'fs'
import { getJob, deleteJob } from '../../jobs-store'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const job = await getJob(jobId)

  if (!job?.done || !job.outputPath) {
    return new Response('Not ready', { status: 404 })
  }
  if (job.error) {
    return new Response(job.error, { status: 500 })
  }

  const outputPath = job.outputPath

  let size: number
  try {
    size = (await fs.promises.stat(outputPath)).size
  } catch {
    return new Response('File not found', { status: 404 })
  }

  // Clean up job metadata immediately so it can't be downloaded twice
  await deleteJob(jobId)

  // Stream the file instead of loading it entirely into memory
  const nodeStream = fs.createReadStream(outputPath)

  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)))
      nodeStream.on('end', () => {
        controller.close()
        // Delete the file after streaming completes
        fs.unlink(outputPath, () => {})
      })
      nodeStream.on('error', (err) => {
        controller.error(err)
        fs.unlink(outputPath, () => {})
      })
    },
    cancel() {
      nodeStream.destroy()
      fs.unlink(outputPath, () => {})
    },
  })

  return new Response(webStream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': 'attachment; filename="montage.mp4"',
      'Content-Length': String(size),
    },
  })
}
