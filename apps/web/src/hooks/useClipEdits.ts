'use client'

import { useState, useCallback, useRef } from 'react'
import type { ClipEdit } from '@/components/session/Timeline'

/**
 * Non-destructive clip editing — manages split and delete operations
 * as an array of visible frame ranges per recording.
 */
export function useClipEdits(initial: ClipEdit[] = []) {
  const [clipEdits, setClipEdits] = useState<ClipEdit[]>(initial)
  const undoStack = useRef<ClipEdit[][]>([])

  const pushUndo = useCallback((prev: ClipEdit[]) => {
    undoStack.current = [...undoStack.current.slice(-19), prev]
  }, [])

  /**
   * Split a clip at a specific frame (relative to the original video).
   * If the clip has no edits yet, initialise visibleRanges first.
   */
  const splitAt = useCallback((
    recordingId: string,
    frameInOriginal: number,
    originalTotalFrames: number,
  ) => {
    setClipEdits(prev => {
      pushUndo(prev)
      const existing = prev.find(e => e.recordingId === recordingId)
      let ranges = existing
        ? [...existing.visibleRanges]
        : [{ startFrame: 0, endFrame: originalTotalFrames }]

      // Find the range that contains frameInOriginal and split it
      const idx = ranges.findIndex(r => frameInOriginal > r.startFrame && frameInOriginal < r.endFrame)
      if (idx === -1) return prev // frame not inside any visible range

      const target = ranges[idx]
      const left = { startFrame: target.startFrame, endFrame: frameInOriginal }
      const right = { startFrame: frameInOriginal, endFrame: target.endFrame }
      ranges = [...ranges.slice(0, idx), left, right, ...ranges.slice(idx + 1)]

      const updated = prev.filter(e => e.recordingId !== recordingId)
      updated.push({ recordingId, visibleRanges: ranges })
      return updated
    })
  }, [pushUndo])

  /**
   * Delete a specific visible range from a clip.
   */
  const deleteRange = useCallback((recordingId: string, rangeIndex: number) => {
    setClipEdits(prev => {
      pushUndo(prev)
      const existing = prev.find(e => e.recordingId === recordingId)
      if (!existing) return prev

      const ranges = existing.visibleRanges.filter((_, i) => i !== rangeIndex)
      if (ranges.length === 0) {
        // Don't allow deleting ALL ranges — keep the last one
        return prev
      }

      const updated = prev.filter(e => e.recordingId !== recordingId)
      updated.push({ recordingId, visibleRanges: ranges })
      return updated
    })
  }, [pushUndo])

  /**
   * Reset a clip back to its original full range.
   */
  const resetClip = useCallback((recordingId: string) => {
    setClipEdits(prev => {
      pushUndo(prev)
      return prev.filter(e => e.recordingId !== recordingId)
    })
  }, [pushUndo])

  /**
   * Undo the last edit operation.
   */
  const undo = useCallback(() => {
    const stack = undoStack.current
    if (stack.length === 0) return
    const last = stack.pop()!
    setClipEdits(last)
  }, [])

  /**
   * Restore clip edits from saved state (e.g., montageSettings).
   */
  const restore = useCallback((saved: ClipEdit[]) => {
    setClipEdits(saved)
    undoStack.current = []
  }, [])

  /**
   * Directly apply a set of visible ranges for a recording (e.g., from AI smart cut).
   */
  const applyRanges = useCallback((
    recordingId: string,
    ranges: { startFrame: number; endFrame: number }[],
  ) => {
    setClipEdits(prev => {
      pushUndo(prev)
      const updated = prev.filter(e => e.recordingId !== recordingId)
      if (ranges.length > 0) updated.push({ recordingId, visibleRanges: ranges })
      return updated
    })
  }, [pushUndo])

  return { clipEdits, splitAt, deleteRange, resetClip, undo, restore, applyRanges }
}
