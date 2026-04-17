'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Palette, Save, Type, Image, Sparkles, Film, X, Upload, CheckCircle2, AlertCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandKit {
  id?: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontTitle: string
  fontBody: string
  logoUrl: string
  aiTone: AiTone
  introVideoUrl: string
  outroVideoUrl: string
}

type AiTone = 'PROFESSIONAL' | 'CASUAL' | 'EXPERT' | 'ENERGETIC' | 'INSPIRATIONAL'

const AI_TONE_OPTIONS: { value: AiTone; label: string; description: string }[] = [
  { value: 'PROFESSIONAL', label: 'Professionnel', description: 'Ton formel et structuré, adapté au B2B et corporate' },
  { value: 'CASUAL', label: 'Décontracté', description: 'Ton amical et accessible, proche de votre audience' },
  { value: 'EXPERT', label: 'Expert', description: 'Ton technique et précis, axé sur la crédibilité' },
  { value: 'ENERGETIC', label: 'Énergique', description: 'Ton dynamique et enthousiaste, idéal pour motiver' },
  { value: 'INSPIRATIONAL', label: 'Inspirant', description: 'Ton motivant et visionnaire, pour fédérer et inspirer' },
]

const FONT_OPTIONS = [
  'Inter',
  'Montserrat',
  'Poppins',
  'Roboto',
  'Playfair Display',
  'Lora',
  'Space Grotesk',
  'DM Sans',
]

const DEFAULT_BRAND_KIT: BrandKit = {
  primaryColor: '#6366f1',
  secondaryColor: '#a855f7',
  accentColor: '#ec4899',
  fontTitle: 'Inter',
  fontBody: 'Inter',
  logoUrl: '',
  aiTone: 'PROFESSIONAL',
  introVideoUrl: '',
  outroVideoUrl: '',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrandKitClient() {
  const [brandKit, setBrandKit] = useState<BrandKit>(DEFAULT_BRAND_KIT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // ---- Load ----
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/brand-kit', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (data) {
            setBrandKit({ ...DEFAULT_BRAND_KIT, ...data })
          }
        }
      } catch {
        // silently fall back to defaults
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ---- Save ----
  const handleSave = useCallback(async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/admin/brand-kit', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandKit),
      })
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde')
      const data = await res.json()
      setBrandKit({ ...DEFAULT_BRAND_KIT, ...data })
      setFeedback({ type: 'success', message: 'Brand Kit sauvegardé avec succès' })
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Erreur inconnue' })
    } finally {
      setSaving(false)
    }
  }, [brandKit])

  // ---- Auto-dismiss feedback ----
  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(t)
  }, [feedback])

  // ---- Helpers ----
  const update = <K extends keyof BrandKit>(key: K, value: BrandKit[K]) =>
    setBrandKit((prev) => ({ ...prev, [key]: value }))

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Brand Kit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personnalise l&apos;identite visuelle de tes videos
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Sauvegarder
        </Button>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div
          className={`flex items-center gap-2 px-4 py-3 text-sm rounded-xl animate-in slide-in-from-top-2 fade-in duration-300 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {feedback.message}
        </div>
      )}

      {/* Section 1: Couleurs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            Couleurs
          </CardTitle>
          <CardDescription>Définissez la palette de couleurs de votre marque</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <ColorPickerField
              label="Couleur principale"
              value={brandKit.primaryColor}
              onChange={(v) => update('primaryColor', v)}
            />
            <ColorPickerField
              label="Couleur secondaire"
              value={brandKit.secondaryColor}
              onChange={(v) => update('secondaryColor', v)}
            />
            <ColorPickerField
              label="Couleur d'accent"
              value={brandKit.accentColor}
              onChange={(v) => update('accentColor', v)}
            />
          </div>

          {/* Live preview strip */}
          <div>
            <Label className="mb-2 block">Aperçu</Label>
            <div className="flex h-10 overflow-hidden border border-border">
              <div className="flex-1" style={{ backgroundColor: brandKit.primaryColor }} />
              <div className="flex-1" style={{ backgroundColor: brandKit.secondaryColor }} />
              <div className="flex-1" style={{ backgroundColor: brandKit.accentColor }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Typographies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="w-4 h-4 text-primary" />
            Typographies
          </CardTitle>
          <CardDescription>Choisissez les polices pour vos titres et textes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FontSelectField
              label="Police des titres"
              value={brandKit.fontTitle}
              onChange={(v) => update('fontTitle', v)}
            />
            <FontSelectField
              label="Police du corps"
              value={brandKit.fontBody}
              onChange={(v) => update('fontBody', v)}
            />
          </div>

          {/* Font preview */}
          <div className="border border-border p-6 space-y-3 bg-surface-raised/30">
            <p
              className="text-lg font-bold tracking-tight"
              style={{ fontFamily: `"${brandKit.fontTitle}", sans-serif` }}
            >
              Titre d&apos;exemple avec {brandKit.fontTitle}
            </p>
            <p
              className="text-sm text-muted-foreground leading-relaxed"
              style={{ fontFamily: `"${brandKit.fontBody}", sans-serif` }}
            >
              Ceci est un exemple de texte avec la police {brandKit.fontBody}. Lavidz vous permet de
              personnaliser chaque aspect de vos vidéos pour refléter votre identité de marque.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-4 h-4 text-primary" />
            Logo
          </CardTitle>
          <CardDescription>Ajoutez le logo de votre marque</CardDescription>
        </CardHeader>
        <CardContent>
          {brandKit.logoUrl ? (
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 border border-border flex items-center justify-center bg-surface-raised/30 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brandKit.logoUrl}
                  alt="Logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => update('logoUrl', '')}>
                <X className="w-3 h-3" />
                Supprimer
              </Button>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                // Placeholder: in future this will upload and set the URL
              }}
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 px-6 transition-colors cursor-pointer ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground'
              }`}
              onClick={() => {
                // Placeholder: trigger file picker in future
              }}
            >
              <Upload className="w-6 h-6 text-muted-foreground" />
              <div className="text-center">
                <p className="text-xs text-foreground">
                  Glissez-déposez votre logo ici
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ou cliquez pour parcourir (PNG, SVG, JPG)
                </p>
              </div>
            </div>
          )}
          {/* Manual URL input as fallback */}
          <div className="mt-4">
            <Label htmlFor="logoUrl" className="mb-2 block">URL du logo (optionnel)</Label>
            <Input
              id="logoUrl"
              placeholder="https://example.com/logo.png"
              value={brandKit.logoUrl}
              onChange={(e) => update('logoUrl', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Ton de voix IA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Ton de voix IA
          </CardTitle>
          <CardDescription>Définissez le style de communication de l&apos;IA pour votre marque</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {AI_TONE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update('aiTone', option.value)}
                className={`text-left p-4 border transition-all ${
                  brandKit.aiTone === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground hover:bg-surface-raised/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={`w-2 h-2 rounded-full transition-colors ${
                      brandKit.aiTone === option.value ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  />
                  <span className="text-xs font-medium uppercase tracking-wider">
                    {option.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Intro / Outro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" />
            Intro / Outro
          </CardTitle>
          <CardDescription>Ajoutez des séquences d&apos;introduction et de conclusion à vos vidéos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="introVideoUrl" className="mb-2 block">URL de la vidéo d&apos;intro</Label>
            <Input
              id="introVideoUrl"
              placeholder="https://example.com/intro.mp4"
              value={brandKit.introVideoUrl}
              onChange={(e) => update('introVideoUrl', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="outroVideoUrl" className="mb-2 block">URL de la vidéo d&apos;outro</Label>
            <Input
              id="outroVideoUrl"
              placeholder="https://example.com/outro.mp4"
              value={brandKit.outroVideoUrl}
              onChange={(e) => update('outroVideoUrl', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bottom save */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Sauvegarder
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ColorPickerField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-9 cursor-pointer border border-border bg-transparent p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => {
            const v = e.target.value
            if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '') {
              onChange(v)
            }
          }}
          placeholder="#000000"
          className="flex-1 uppercase"
          maxLength={7}
        />
      </div>
    </div>
  )
}

function FontSelectField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-0 cursor-pointer appearance-none"
      >
        {FONT_OPTIONS.map((font) => (
          <option key={font} value={font} style={{ fontFamily: `"${font}", sans-serif` }}>
            {font}
          </option>
        ))}
      </select>
    </div>
  )
}
