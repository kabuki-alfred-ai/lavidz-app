'use client'

import * as React from 'react'
import { PipelineColumn } from '@/components/pipeline/PipelineColumn'
import { RegularityBanner } from '@/components/pipeline/RegularityBanner'
import type { PipelineStage } from '@/lib/pipeline-stage'
import type { PipelineCardTopic } from '@/components/pipeline/PipelineCard'

type PipelineResponse = {
  topics: PipelineCardTopic[]
  regularityAlert: boolean
}

const COLUMNS: Array<{ stage: PipelineStage; title: string; icon: string }> = [
  { stage: 'TO_WORK', title: 'À travailler', icon: '💡' },
  { stage: 'READY', title: 'Prêt', icon: '✅' },
  { stage: 'SHOT', title: 'Tourné', icon: '🎬' },
  { stage: 'EDITING', title: 'Montage', icon: '✂️' },
  { stage: 'PUBLISHED', title: 'Publié', icon: '🌍' },
]

export function PipelineClient() {
  const [data, setData] = React.useState<PipelineResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/pipeline', { credentials: 'include' })
      if (!res.ok) {
        setError(await res.text())
        return
      }
      setData((await res.json()) as PipelineResponse)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline de contenu</h1>
          <p className="text-sm text-muted-foreground">
            De l'idée au contenu — où en sont tes sujets ?
          </p>
        </div>
      </header>

      <RegularityBanner show={data?.regularityAlert ?? false} />

      {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto">
          {COLUMNS.map((col) => (
            <PipelineColumn
              key={col.stage}
              title={col.title}
              icon={col.icon}
              topics={data.topics.filter((t) => t.stage === col.stage)}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}
