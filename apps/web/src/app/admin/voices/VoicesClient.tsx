'use client'

import React, { useState, useRef } from 'react'
import { Loader2, Mic, Plus, Play, Pause, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'

interface Voice {
  id: string
  name: string
  previewUrl: string
  category: string
  accent: string
  gender: string
  language: string
}

interface Props {
  initialVoices: Voice[]
}

const CATEGORY_LABEL: Record<string, string> = {
  cloned: 'Clone',
  professional: 'Pro',
  generated: 'Design',
}

export function VoicesClient({ initialVoices }: Props) {
  const [voices, setVoices] = useState<Voice[]>(initialVoices)
  const [addId, setAddId] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Cache live-generated MiniMax preview blob URLs to avoid regenerating
  const mmPreviewCache = useRef<Map<string, string>>(new Map())

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch('/api/tts/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: addId.trim() }),
      })
      if (!res.ok) throw new Error(await res.text())
      const voice: Voice = await res.json()
      setVoices(prev => prev.some(v => v.id === voice.id) ? prev : [voice, ...prev])
      setAddId('')
    } catch (err) {
      setAddError(String(err))
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/tts/voices/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (res.ok) {
        setVoices(prev => prev.filter(v => v.id !== id))
        if (previewingId === id) {
          audioRef.current?.pause()
          setPreviewingId(null)
        }
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handlePreview = async (voice: Voice) => {
    if (previewingId === voice.id) {
      audioRef.current?.pause()
      setPreviewingId(null)
      return
    }
    audioRef.current?.pause()
    setPreviewingId(voice.id)

    let src = voice.previewUrl

    if (!src) {
      // MiniMax voices have no previewUrl — generate live TTS sample (cached)
      const cached = mmPreviewCache.current.get(voice.id)
      if (cached) {
        src = cached
      } else {
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'Bonjour, je suis votre voix IA pour vos vidéos.', voiceId: voice.id }),
          })
          if (!res.ok) { setPreviewingId(null); return }
          const blob = await res.blob()
          src = URL.createObjectURL(blob)
          mmPreviewCache.current.set(voice.id, src)
        } catch {
          setPreviewingId(null)
          return
        }
      }
    }

    const audio = new Audio(src)
    audioRef.current = audio
    audio.play()
    audio.onended = () => setPreviewingId(null)
  }

  return (
    <div className="max-w-5xl space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-[1px] bg-primary/40" />
          <p className="text-xs text-primary/60">
            ElevenLabs · MiniMax
          </p>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Voix IA
        </h1>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          {voices.length} voix · utilisées pour lire les questions
        </p>
      </div>

      {/* Add form */}
      <Card className="border-border/60 bg-surface/30 backdrop-blur-sm">
        <CardContent className="p-0">
          <form onSubmit={handleAdd} className="p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-7 h-7 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center">
                <Plus size={13} className="text-primary" />
              </div>
              <h2 className="font-inter font-bold text-base text-foreground">
                Ajouter une voix par ID
              </h2>
            </div>

            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label className="text-xs text-muted-foreground/80">
                  Voice ID
                </Label>
                <Input
                  value={addId}
                  onChange={e => setAddId(e.target.value)}
                  placeholder="ElevenLabs: EXAVITQu4… · MiniMax: mm:female-shaen"
                  required
                  className="h-9 bg-surface/40 text-xs"
                />
                <p className="text-xs text-muted-foreground/50">
                  ElevenLabs : ID bare · MiniMax : préfixe <span className="text-blue-400">mm:</span> (ex: mm:female-shaen)
                </p>
              </div>
              <Button
                type="submit"
                disabled={adding || !addId.trim()}
                className="h-10 px-8 text-xs shadow-lg"
              >
                {adding ? <Loader2 size={13} className="animate-spin mr-2" /> : <Plus size={13} className="mr-2" />}
                {adding ? 'Vérif…' : 'Ajouter'}
              </Button>
            </div>

            {addError && (
              <p className="text-xs text-destructive bg-destructive/5 px-3 py-2 rounded-lg border border-destructive/20">
                {addError}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Voices list */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Mic size={12} className="text-primary/60" />
          <span className="text-xs text-muted-foreground/80">
            Bibliothèque
          </span>
          <span className="text-xs text-muted-foreground/60">
            {voices.length} voix
          </span>
        </div>

        {voices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/30 py-8 text-center">
            <Mic size={20} className="mx-auto text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground/60">
              Aucune voix disponible
            </p>
          </div>
        ) : (
          <div className="border border-border/60 bg-surface/30 rounded-lg overflow-hidden backdrop-blur-sm">
            <div className="grid grid-cols-[1fr_140px_80px_60px] border-b border-border/40 bg-surface/50 px-6 py-3">
              {['Voix', 'Catégorie', 'Écoute', 'Action'].map(h => (
                <div key={h} className="text-xs text-muted-foreground/70">
                  {h}
                </div>
              ))}
            </div>
            <div className="divide-y divide-border/40">
              {voices.map(voice => {
                const isMM = voice.id.startsWith('mm:')
                return (
                  <div
                    key={voice.id}
                    className="grid grid-cols-[1fr_140px_80px_60px] items-center px-6 py-4 hover:bg-primary/[0.02] transition-colors group"
                  >
                    {/* Name + meta */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                        <Mic size={11} className="text-primary/40" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-inter font-bold text-[13px] text-foreground truncate block group-hover:text-primary transition-colors">
                          {voice.name}
                        </span>
                        <span className="text-xs text-muted-foreground/70 truncate block">
                          {[voice.gender, voice.accent].filter(Boolean).join(' · ') || voice.id}
                        </span>
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      {isMM ? (
                        <span className="text-xs px-2 py-1 border bg-blue-500/5 text-blue-400 border-blue-400/20">
                          MiniMax
                        </span>
                      ) : voice.category && CATEGORY_LABEL[voice.category] ? (
                        <span className="text-xs px-2 py-1 border bg-primary/5 text-primary border-primary/10">
                          {CATEGORY_LABEL[voice.category]}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">—</span>
                      )}
                    </div>

                    {/* Preview */}
                    <div>
                      <button
                        onClick={() => handlePreview(voice)}
                        className="w-7 h-7 rounded-lg border border-border/60 flex items-center justify-center hover:border-primary/40 hover:bg-primary/5 transition-colors"
                      >
                        {previewingId === voice.id
                          ? <Pause size={11} className="text-primary" />
                          : <Play size={11} className="text-muted-foreground/80" />
                        }
                      </button>
                    </div>

                    {/* Delete */}
                    <div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            disabled={deletingId === voice.id}
                            className="w-7 h-7 rounded-lg border border-border/60 flex items-center justify-center hover:border-destructive/40 hover:bg-destructive/5 transition-colors disabled:opacity-40"
                          >
                            {deletingId === voice.id
                              ? <Loader2 size={11} className="animate-spin text-muted-foreground" />
                              : <Trash2 size={11} className="text-muted-foreground/70 group-hover:text-destructive" />
                            }
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer "{voice.name}" ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {isMM
                                ? 'Cette voix sera retirée de la liste des voix disponibles.'
                                : 'Cette voix sera définitivement supprimée de ton compte ElevenLabs. Cette action est irréversible.'
                              }
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(voice.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
