'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Film, Search, Trash2, Download, Image, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type BRollItem = {
  id: string
  title: string
  thumbnailUrl?: string | null
  tags?: string[]
  source: string
  url?: string
}

type PexelsResult = {
  id?: number | string
  pexelsId?: number | string
  title?: string
  image?: string
  thumbnailUrl?: string
  url: string
  duration?: number
  video_files?: { link: string; quality: string }[]
}

export function BRollClient() {
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get('search') ?? ''
  const [tab, setTab] = useState<'library' | 'search'>(initialSearch ? 'search' : 'library')
  const [library, setLibrary] = useState<BRollItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [searchResults, setSearchResults] = useState<PexelsResult[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  const fetchLibrary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/broll', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setLibrary(Array.isArray(data) ? data : data.items ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLibrary()
  }, [fetchLibrary])

  async function handleSearch(query?: string) {
    const q = (query ?? searchQuery).trim()
    if (!q) return
    if (query) setSearchQuery(q)
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/broll/search?q=${encodeURIComponent(q)}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : data.results ?? data.videos ?? [])
      }
    } catch {
      // silent
    } finally {
      setSearching(false)
    }
  }

  // Auto-search if opened with ?search= param
  const autoSearchedRef = React.useRef(false)
  useEffect(() => {
    if (initialSearch && !autoSearchedRef.current) {
      autoSearchedRef.current = true
      handleSearch(initialSearch)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearch])

  async function handleSave(result: PexelsResult) {
    const id = String(result.pexelsId ?? result.id)
    setSaving(id)
    try {
      const res = await fetch('/api/admin/broll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: result.title || `Pexels #${id}`,
          url: result.url,
          thumbnailUrl: result.thumbnailUrl ?? result.image,
          source: 'PEXELS',
          duration: result.duration,
        }),
      })
      if (res.ok) {
        await fetchLibrary()
        setTab('library')
      }
    } catch {
      // silent
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/broll/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setLibrary((prev) => prev.filter((item) => item.id !== id))
      }
    } catch {
      // silent
    }
  }

  return (
    <div className="max-w-6xl space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-[1px] bg-primary/40" />
          <p className="text-xs text-primary/60">
            Media
          </p>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          B-Rolls
        </h1>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Gere ta bibliotheque de plans de coupe
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab('library')}
          className={`px-4 py-2.5 text-xs transition-colors border-b-2 -mb-px ${
            tab === 'library'
              ? 'border-primary text-foreground font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Ma bibliotheque
        </button>
        <button
          onClick={() => setTab('search')}
          className={`px-4 py-2.5 text-xs transition-colors border-b-2 -mb-px ${
            tab === 'search'
              ? 'border-primary text-foreground font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Rechercher (Pexels)
        </button>
      </div>

      {/* Library tab */}
      {tab === 'library' && (
        <>
          {loading ? (
            <div className="flex items-center gap-3 py-12 justify-center">
              <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">Chargement...</span>
            </div>
          ) : library.length === 0 ? (
            <div className="border border-dashed border-border/30 p-20 text-center rounded-lg bg-surface/10">
              <Film size={32} className="mx-auto text-muted-foreground/30 mb-4" />
              <p className="font-bold text-lg text-foreground mb-2">Pas encore de B-rolls</p>
              <p className="text-xs text-muted-foreground/80">
                Recherche sur Pexels ou upload les tiens
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {library.map((item) => (
                <Card key={item.id} className="overflow-hidden group">
                  <div className="aspect-video bg-surface/50 relative">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image size={24} className="text-muted-foreground/30" />
                      </div>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                    <div className="flex flex-wrap gap-1">
                      {item.tags?.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[8px] px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                      <Badge
                        variant={item.source === 'PEXELS' ? 'default' : 'secondary'}
                        className="text-[8px] px-1.5 py-0"
                      >
                        {item.source}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Search tab */}
      {tab === 'search' && (
        <div className="space-y-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Rechercher des videos (ex: bureau, nature, technologie...)"
                className="w-full bg-surface/40 border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={searching || !searchQuery.trim()}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {searching ? (
                <span className="w-3 h-3 border border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Search size={13} />
              )}
              Rechercher
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {searchResults.map((result) => {
                const id = String(result.pexelsId ?? result.id ?? Math.random())
                const thumb = result.thumbnailUrl ?? result.image
                return (
                  <Card key={id} className="overflow-hidden">
                    <div className="aspect-video bg-surface/50 relative cursor-pointer" onClick={() => setPlayingId(id)}>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={result.title ?? ''} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film size={24} className="text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                          <span className="text-white text-lg ml-0.5">▶</span>
                        </div>
                      </div>
                      {result.duration != null && (
                        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-lg">
                          {result.duration}s
                        </span>
                      )}
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <p className="text-xs font-medium text-foreground truncate">
                        {result.title || `Video #${id}`}
                      </p>
                      <button
                        onClick={() => handleSave(result)}
                        disabled={saving === id}
                        className="w-full flex items-center justify-center gap-2 border border-border px-3 py-1.5 rounded-lg text-xs hover:border-primary hover:text-primary disabled:opacity-40 transition-colors"
                      >
                        {saving === id ? (
                          <span className="w-3 h-3 border border-current/40 border-t-current rounded-full animate-spin" />
                        ) : (
                          <Download size={11} />
                        )}
                        Sauvegarder
                      </button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Video player modal */}
      {playingId && (() => {
        const result = searchResults.find(r => String(r.pexelsId ?? r.id) === playingId)
        if (!result?.url) return null
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setPlayingId(null)}
          >
            <div
              className="relative w-full max-w-3xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPlayingId(null)}
                className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <div className="rounded-lg overflow-hidden bg-black shadow-2xl">
                <video
                  src={result.url}
                  autoPlay
                  controls
                  className="w-full"
                />
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-sm text-white/60">
                  {result.title || `Video #${playingId}`}
                  {result.duration ? ` · ${result.duration}s` : ''}
                </p>
                <button
                  onClick={() => { handleSave(result); setPlayingId(null) }}
                  disabled={saving === playingId}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
                >
                  <Download size={12} />
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
