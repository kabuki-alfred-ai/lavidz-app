'use client'

import * as React from 'react'
import { PipelineCard, type PipelineCardTopic } from './PipelineCard'

export interface PipelineColumnProps {
  title: string
  icon: string
  topics: PipelineCardTopic[]
  onChanged?: () => void
}

export function PipelineColumn({ title, icon, topics, onChanged }: PipelineColumnProps) {
  return (
    <section className="flex flex-col gap-3 min-w-[240px]">
      <header className="flex items-center gap-2 text-sm font-semibold">
        <span>{icon}</span>
        <span>{title}</span>
        <span className="ml-auto text-xs text-muted-foreground">{topics.length}</span>
      </header>
      <div className="flex flex-col gap-2 min-h-[100px] max-h-[70vh] overflow-y-auto pr-1">
        {topics.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-4 text-center">—</p>
        ) : (
          topics.map((topic) => (
            <PipelineCard key={topic.id} topic={topic} onChanged={onChanged} />
          ))
        )}
      </div>
    </section>
  )
}
