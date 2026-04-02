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
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Building2 size={10} />
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider max-w-[100px] truncate">
              {activeOrg.name}
            </span>
          </div>
          <button
            onClick={() => switchOrg(null)}
            disabled={loading}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-surface-raised text-muted-foreground hover:text-foreground transition-colors"
            title="Quitter le contexte org"
          >
            <X size={10} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(v => !v)}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-raised border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
        >
          <Building2 size={10} />
          <span className="text-[9px] font-mono uppercase tracking-wider">Changer org</span>
          <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-52 bg-background border border-border rounded-sm shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-border">
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground px-1">
              Sélectionner une organisation
            </p>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {orgs.length === 0 && (
              <p className="text-[10px] font-mono text-muted-foreground px-3 py-2">Aucune organisation</p>
            )}
            {orgs.map(org => (
              <button
                key={org.id}
                onClick={() => switchOrg(org.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-raised transition-colors group"
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${org.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-[11px] font-mono text-foreground group-hover:text-primary transition-colors truncate">
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
