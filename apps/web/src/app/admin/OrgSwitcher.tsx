'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronDown, X } from 'lucide-react'

interface Org {
  id: string
  name: string
  status: string
}

interface OrgSwitcherProps {
  activeOrgId?: string | null
}

export function OrgSwitcher({ activeOrgId }: OrgSwitcherProps) {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/admin/organizations')
      .then(r => r.json())
      .then(setOrgs)
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const activeOrg = orgs.find(o => o.id === activeOrgId)

  async function switchOrg(orgId: string | null) {
    setLoading(true)
    setOpen(false)
    try {
      await fetch('/api/admin/switch-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={ref} className="relative flex items-center">
      {activeOrg ? (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600">
            <Building2 size={14} />
            <span className="text-xs font-medium max-w-[100px] truncate">
              {activeOrg.name}
            </span>
          </div>
          <button
            onClick={() => switchOrg(null)}
            disabled={loading}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-raised text-muted-foreground hover:text-foreground transition-colors"
            title="Quitter le contexte org"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(v => !v)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-raised text-muted-foreground hover:text-foreground transition-colors"
        >
          <Building2 size={14} />
          <span className="text-xs font-medium">Changer org</span>
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {open && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-background rounded-xl shadow-lg z-50 overflow-hidden border border-border/40">
          <div className="px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Selectionner une organisation
            </p>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {orgs.length === 0 && (
              <p className="text-sm text-muted-foreground px-4 py-3">Aucune organisation</p>
            )}
            {orgs.map(org => (
              <button
                key={org.id}
                onClick={() => switchOrg(org.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-raised transition-colors group"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${org.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-sm text-foreground group-hover:text-primary transition-colors truncate">
                  {org.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
