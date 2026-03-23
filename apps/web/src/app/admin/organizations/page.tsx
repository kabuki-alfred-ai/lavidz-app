'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface Org {
  id: string
  name: string
  slug: string
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED'
  createdAt: string
  _count: { users: number; themes: number }
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/organizations')
      .then(r => r.json())
      .then(setOrgs)
      .finally(() => setLoading(false))
  }, [])

  const updateStatus = async (id: string, status: Org['status']) => {
    setUpdating(id)
    const res = await fetch(`/api/admin/organizations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setOrgs(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    }
    setUpdating(null)
  }

  return (
    <div className="max-w-5xl animate-fade-in">
      <div className="mb-8">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Superadmin</p>
        <h1 className="font-sans font-extrabold text-3xl text-foreground tracking-tight">Organisations</h1>
        <p className="text-xs text-muted-foreground mt-1">{orgs.length} organisation{orgs.length !== 1 ? 's' : ''}</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs font-mono">Chargement...</span>
        </div>
      ) : orgs.length === 0 ? (
        <div className="border border-border border-dashed p-16 text-center">
          <p className="text-sm text-muted-foreground">Aucune organisation</p>
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_80px_80px_200px] border-b border-border bg-surface">
            {['Organisation', 'Statut', 'Users', 'Thèmes', 'Actions'].map(h => (
              <div key={h} className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{h}</div>
            ))}
          </div>
          {orgs.map((org, i) => (
            <div key={org.id} className={`grid grid-cols-[1fr_140px_80px_80px_200px] items-center border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-surface/50'}`}>
              <div className="px-4 py-3.5">
                <p className="font-sans font-semibold text-sm text-foreground">{org.name}</p>
                <code className="text-[10px] text-muted-foreground">{org.slug}</code>
              </div>
              <div className="px-4 py-3.5">
                <Badge variant={org.status === 'ACTIVE' ? 'active' : org.status === 'PENDING' ? 'default' : 'inactive'}>
                  {org.status === 'ACTIVE' ? 'Actif' : org.status === 'PENDING' ? 'En attente' : 'Suspendu'}
                </Badge>
              </div>
              <div className="px-4 py-3.5 text-xs font-mono text-foreground">{org._count.users}</div>
              <div className="px-4 py-3.5 text-xs font-mono text-foreground">{org._count.themes}</div>
              <div className="px-4 py-3.5 flex gap-2">
                {org.status !== 'ACTIVE' && (
                  <Button size="sm" variant="outline" disabled={updating === org.id}
                    onClick={() => updateStatus(org.id, 'ACTIVE')}>
                    {updating === org.id ? <Loader2 size={10} className="animate-spin" /> : 'Approuver'}
                  </Button>
                )}
                {org.status === 'ACTIVE' && (
                  <Button size="sm" variant="outline" disabled={updating === org.id}
                    onClick={() => updateStatus(org.id, 'SUSPENDED')}>
                    {updating === org.id ? <Loader2 size={10} className="animate-spin" /> : 'Suspendre'}
                  </Button>
                )}
                {org.status === 'SUSPENDED' && (
                  <Button size="sm" variant="outline" disabled={updating === org.id}
                    onClick={() => updateStatus(org.id, 'PENDING')}>
                    Remettre en attente
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
