import Redis from 'ioredis'

export interface Job {
  progress: number
  done: boolean
  outputPath: string | null
  sessionId: string | null
  error: string | null
}

const JOB_TTL_SECONDS = 3600 // 1h

let _redis: Redis | null = null
function getRedis(): Redis {
  if (!_redis) _redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: false, maxRetriesPerRequest: 3 })
  return _redis
}

function key(jobId: string) {
  return `render:job:${jobId}`
}

export async function setJob(jobId: string, job: Job): Promise<void> {
  await getRedis().set(key(jobId), JSON.stringify(job), 'EX', JOB_TTL_SECONDS)
}

export async function getJob(jobId: string): Promise<Job | null> {
  const data = await getRedis().get(key(jobId))
  return data ? (JSON.parse(data) as Job) : null
}

export async function deleteJob(jobId: string): Promise<void> {
  await getRedis().del(key(jobId))
}
