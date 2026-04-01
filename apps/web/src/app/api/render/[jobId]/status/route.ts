import { getJob } from '../../jobs-store'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const job = await getJob(jobId)
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 })
  return Response.json({
    progress: job.progress,
    done: job.done,
    error: job.error,
    hasOutput: !!job.outputPath,
  })
}
