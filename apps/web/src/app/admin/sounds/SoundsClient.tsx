'use client'

import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Loader2,
  Music,
  Plus,
  Trash2,
  Upload,
  Play,
  Pause,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SoundAssetDto, SoundTag } from '@lavidz/types'

const TAG_LABELS: Record<SoundTag, string> = {
  TRANSITION: 'Transition',
  INTRO: 'Intro',
  OUTRO: 'Outro',
  BACKGROUND: 'Background Sound',
}

const TAG_COLORS: Record<SoundTag, string> = {
  TRANSITION: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  INTRO: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  OUTRO: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  BACKGROUND: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

interface Props {
  initialSounds: SoundAssetDto[]
}

export function SoundsClient({ initialSounds }: Props) {
  const [sounds, setSounds] = useState<SoundAssetDto[]>(initialSounds)
  const [name, setName] = useState('')
  const [tag, setTag] = useState<SoundTag>('BACKGROUND')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('tag', tag)
      fd.append('file', file)
      const res = await fetch('/api/admin/sounds', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      const created = await res.json()
      // Refresh to get signed URL
      const listRes = await fetch('/api/admin/sounds')
      if (listRes.ok) setSounds(await listRes.json())
      else setSounds((prev) => [created, ...prev])
      setName('')
      setTag('BACKGROUND')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setUploadError(String(err))
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/sounds/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setSounds((prev) => prev.filter((s) => s.id !== id))
      if (playingId === id) {
        audioRef.current?.pause()
        setPlayingId(null)
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handlePlay = (sound: SoundAssetDto) => {
    if (!sound.signedUrl) return
    if (playingId === sound.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    if (audioRef.current) {
      audioRef.current.pause()
    }
    const audio = new Audio(sound.signedUrl)
    audio.onended = () => setPlayingId(null)
    audio.play()
    audioRef.current = audio
    setPlayingId(sound.id)
  }

  const grouped = (['BACKGROUND', 'INTRO', 'TRANSITION', 'OUTRO'] as SoundTag[]).map(
    (t) => ({ tag: t, items: sounds.filter((s) => s.tag === t) }),
  )

  return (
    <div className="max-w-5xl space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-[1px] bg-primary/40" />
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60">
              Assets
            </p>
          </div>
          <h1 className="font-inter font-black text-4xl text-foreground tracking-tighter">
            Bibliothèque Sonore
          </h1>
          <p className="text-[11px] font-mono text-muted-foreground/60 mt-2 uppercase tracking-widest leading-relaxed">
            Sons pour transitions, intro & outro du montage
          </p>
        </div>
      </div>

      {/* Upload form */}
      <Card className="border-border/60 bg-surface/30 backdrop-blur-sm">
        <CardContent className="p-0">
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-7 h-7 rounded-sm bg-primary/5 border border-primary/10 flex items-center justify-center">
                <Plus size={13} className="text-primary" />
              </div>
              <h2 className="font-inter font-bold text-base text-foreground">
                Ajouter un son
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                  Nom
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Swoosh doux"
                  required
                  className="h-9 bg-surface/40 font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                  Tag
                </Label>
                <select
                  value={tag}
                  onChange={(e) => setTag(e.target.value as SoundTag)}
                  className="flex h-9 w-full border border-input bg-surface/40 px-3 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary transition-colors appearance-none"
                >
                  <option value="BACKGROUND">Background Sound</option>
                  <option value="TRANSITION">Transition</option>
                  <option value="INTRO">Intro</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                  Fichier audio
                </Label>
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    required
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                    id="sound-file"
                  />
                  <label
                    htmlFor="sound-file"
                    className={cn(
                      'flex h-9 w-full items-center gap-2 border border-input bg-surface/40 px-3 cursor-pointer text-xs font-mono transition-colors hover:border-primary/40',
                      file ? 'text-foreground' : 'text-muted-foreground/40',
                    )}
                  >
                    <Upload size={12} className="shrink-0 text-primary/40" />
                    <span className="truncate">
                      {file ? file.name : 'Choisir un fichier…'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {uploadError && (
              <p className="text-[11px] font-mono text-destructive bg-destructive/5 px-3 py-2 border border-destructive/20">
                {uploadError}
              </p>
            )}

            <Button
              type="submit"
              disabled={uploading || !file}
              className="h-10 px-8 rounded-none font-mono text-[10px] uppercase tracking-[0.2em] shadow-lg"
            >
              {uploading ? (
                <Loader2 size={13} className="animate-spin mr-2" />
              ) : (
                <Upload size={13} className="mr-2" />
              )}
              {uploading ? 'Upload…' : 'Ajouter'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Library grouped by tag */}
      <div className="space-y-8">
        {grouped.map(({ tag: t, items }) => (
          <section key={t} className="space-y-4">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'text-[9px] font-mono uppercase tracking-[0.2em] px-2 py-1 border rounded-none',
                  TAG_COLORS[t],
                )}
              >
                {TAG_LABELS[t]}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/30">
                {items.length} son{items.length !== 1 ? 's' : ''}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="border border-dashed border-border/40 py-8 text-center">
                <Music size={20} className="mx-auto text-muted-foreground/15 mb-2" />
                <p className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-widest">
                  Aucun son {TAG_LABELS[t].toLowerCase()}
                </p>
              </div>
            ) : (
              <div className="border border-border/60 bg-surface/30 rounded-sm overflow-hidden backdrop-blur-sm">
                <div className="grid grid-cols-[1fr_80px_80px] border-b border-border/40 bg-surface/50 px-6 py-3">
                  {['Nom', 'Écoute', 'Action'].map((h) => (
                    <div
                      key={h}
                      className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/40"
                    >
                      {h}
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-border/40">
                  {items.map((sound) => (
                    <div
                      key={sound.id}
                      className="grid grid-cols-[1fr_80px_80px] items-center px-6 py-4 hover:bg-primary/[0.02] transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-6 h-6 rounded-sm bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                          <Music size={11} className="text-primary/40" />
                        </div>
                        <span className="font-inter font-bold text-[13px] text-foreground truncate group-hover:text-primary transition-colors">
                          {sound.name}
                        </span>
                      </div>

                      <div>
                        <button
                          onClick={() => handlePlay(sound)}
                          disabled={!sound.signedUrl}
                          className="w-8 h-8 flex items-center justify-center border border-border/40 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all rounded-none disabled:opacity-30"
                          title={playingId === sound.id ? 'Pause' : 'Écouter'}
                        >
                          {playingId === sound.id ? (
                            <Pause size={12} />
                          ) : (
                            <Play size={12} />
                          )}
                        </button>
                      </div>

                      <div>
                        <button
                          onClick={() => handleDelete(sound.id)}
                          disabled={deletingId === sound.id}
                          className="w-8 h-8 flex items-center justify-center border border-border/40 hover:border-destructive/40 hover:bg-destructive/5 text-muted-foreground/40 hover:text-destructive transition-all rounded-none disabled:opacity-30"
                          title="Supprimer"
                        >
                          {deletingId === sound.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
