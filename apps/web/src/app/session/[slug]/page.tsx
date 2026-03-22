import { apiClient } from '@/lib/api'
import type { ThemeDto } from '@lavidz/types'
import { RecordingSession } from '@/components/session/RecordingSession'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function SessionPage({ params }: Props) {
  const { slug } = await params
  const theme = await apiClient<ThemeDto>(`/themes/slug/${slug}`)

  return <RecordingSession theme={theme} />
}
