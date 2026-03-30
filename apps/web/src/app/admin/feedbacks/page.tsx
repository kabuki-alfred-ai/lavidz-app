import { apiClient } from '@/lib/api'
import type { FeedbackDto } from '@lavidz/types'
import { FeedbacksClient } from './FeedbacksClient'

export default async function FeedbacksPage() {
  let feedbacks: FeedbackDto[] = []
  let stats = { count: 0, avgOverall: 0, avgQuestion: 0 }

  try {
    feedbacks = await apiClient<FeedbackDto[]>('/feedbacks')
  } catch {
    feedbacks = []
  }

  try {
    stats = await apiClient<typeof stats>('/feedbacks/stats')
  } catch {
    // keep defaults
  }

  return <FeedbacksClient feedbacks={feedbacks} stats={stats} />
}
