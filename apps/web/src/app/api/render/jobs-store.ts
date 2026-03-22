export interface Job {
  progress: number
  done: boolean
  outputPath: string | null
  error: string | null
}

export const jobs = new Map<string, Job>()
