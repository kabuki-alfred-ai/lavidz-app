import { apiClient } from '@/lib/api'
import { ResultView } from '@/components/session/ResultView'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ session: string }>
}

export default async function ResultPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { session: sessionId } = await searchParams

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-mono text-sm">Session introuvable.</p>
      </div>
    )
  }

  let session: any = null
  try {
    session = await apiClient(`/sessions/${sessionId}`)
  } catch {
    session = null
  }

  return <ResultView session={session} slug={slug} />
}
