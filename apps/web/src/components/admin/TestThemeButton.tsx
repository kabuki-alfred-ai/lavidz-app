'use client'

import { useState } from 'react'
import { FlaskConical, Loader2 } from 'lucide-react'

interface Props {
  themeId: string
  title?: string
}

export function TestThemeButton({ themeId, title = 'Tester' }: Props) {
  const [loading, setLoading] = useState(false)

  const handleTest = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const { sessionId } = await res.json()
      window.open(`/s/${sessionId}`, '_blank')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleTest}
      disabled={loading}
      title={title}
      className="p-1.5 rounded-sm hover:bg-surface-raised text-muted-foreground hover:text-foreground transition-all border border-transparent hover:border-border disabled:opacity-40"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
    </button>
  )
}
