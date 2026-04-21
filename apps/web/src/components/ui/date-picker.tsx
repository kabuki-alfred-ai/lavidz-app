'use client'

import * as React from 'react'
import { Input } from './input'

export interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  min?: string
  className?: string
}

export function DatePicker({ value, onChange, min, className }: DatePickerProps) {
  return (
    <Input
      type="date"
      value={value}
      min={min}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  )
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

export function nextMondayIso(now: Date = new Date()): string {
  const d = new Date(now)
  const day = d.getDay()
  const delta = day === 1 ? 7 : (8 - day) % 7 || 7
  d.setDate(d.getDate() + delta)
  return toIsoDate(d)
}

export function inDaysIso(days: number, now: Date = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}
