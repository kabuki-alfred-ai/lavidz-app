import fs from 'fs'
import { jobs } from '../../jobs-store'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const job = jobs.get(jobId)

  if (!job?.done || !job.outputPath) {
    return new Response('Not ready', { status: 404 })
  }
  if (job.error) {
    return new Response(job.error, { status: 500 })
  }

  const data = fs.readFileSync(job.outputPath)
  try { fs.unlinkSync(job.outputPath) } catch {}
  jobs.delete(jobId)

  return new Response(data, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': 'attachment; filename="montage.mp4"',
      'Content-Length': String(data.length),
    },
  })
}
