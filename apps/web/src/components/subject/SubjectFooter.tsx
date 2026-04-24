'use client'

import { Archive, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Hairline } from './Hairline'

interface SubjectFooterProps {
  topicId: string
  status: 'DRAFT' | 'READY' | 'ARCHIVED'
  onArchive: () => void
  onUnarchive?: () => void
  onBackToExplore: () => void
  disabled?: boolean
}

export function SubjectFooter({
  topicId,
  status,
  onArchive,
  onUnarchive,
  onBackToExplore,
  disabled,
}: SubjectFooterProps) {
  const isArchived = status === 'ARCHIVED'
  return (
    <>
      <Hairline className="my-8" />
      <div className="flex flex-wrap items-center gap-3">
        {status === 'READY' && (
          <Button variant="ghost" size="sm" onClick={onBackToExplore} disabled={disabled}>
            <RotateCcw className="h-3 w-3" />
            Remettre en exploration
          </Button>
        )}
        {!isArchived && (
          <Button variant="ghost" size="sm" onClick={onArchive} disabled={disabled}>
            <Archive className="h-3 w-3" />
            Archiver ce sujet
          </Button>
        )}
        {isArchived && onUnarchive && (
          <Button variant="outline" size="sm" onClick={onUnarchive} disabled={disabled}>
            Ressortir le sujet
          </Button>
        )}
        <span className="ml-auto text-[11px] font-mono text-muted-foreground/70">
          ID · {topicId}
        </span>
      </div>
    </>
  )
}
