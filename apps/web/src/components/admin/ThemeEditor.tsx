'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ThemeDto, QuestionDto } from '@lavidz/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, ExternalLink, Plus, Trash2, GripVertical, Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? ''

const adminFetch = (path: string, options?: RequestInit) =>
  fetch(`${API}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': ADMIN_SECRET,
      ...options?.headers,
    },
  })

export function ThemeEditor({ theme }: { theme: ThemeDto }) {
  const [questions, setQuestions] = useState<QuestionDto[]>(theme.questions)
  const [newQ, setNewQ] = useState({ text: '', hint: '' })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [brand, setBrand] = useState({
    brandName: theme.brandName ?? '',
    brandColor: theme.brandColor ?? '#FF4D1C',
    logoUrl: theme.logoUrl ?? '',
  })
  const [savingBrand, setSavingBrand] = useState(false)
  const [brandSaved, setBrandSaved] = useState(false)
  const [introduction, setIntroduction] = useState(theme.introduction ?? '')
  const [savingIntro, setSavingIntro] = useState(false)
  const [introSaved, setIntroSaved] = useState(false)

  const saveIntroduction = async () => {
    setSavingIntro(true)
    try {
      await adminFetch(`/themes/${theme.id}`, {
        method: 'PUT',
        body: JSON.stringify({ introduction: introduction || null }),
      })
      setIntroSaved(true)
      setTimeout(() => setIntroSaved(false), 2000)
    } finally {
      setSavingIntro(false)
    }
  }

  const saveBrand = async () => {
    setSavingBrand(true)
    try {
      await adminFetch(`/themes/${theme.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          brandName: brand.brandName || null,
          brandColor: brand.brandColor || null,
          logoUrl: brand.logoUrl || null,
        }),
      })
      setBrandSaved(true)
      setTimeout(() => setBrandSaved(false), 2000)
    } finally {
      setSavingBrand(false)
    }
  }

  const addQuestion = async () => {
    if (!newQ.text.trim()) return
    setSaving(true)
    try {
      const res = await adminFetch('/questions', {
        method: 'POST',
        body: JSON.stringify({
          themeId: theme.id,
          text: newQ.text.trim(),
          hint: newQ.hint.trim() || undefined,
          order: questions.length,
        }),
      })
      const q = await res.json() as QuestionDto
      setQuestions((qs) => [...qs, q])
      setNewQ({ text: '', hint: '' })
    } finally {
      setSaving(false)
    }
  }

  const deleteQuestion = async (id: string) => {
    setDeletingId(id)
    try {
      await adminFetch(`/questions/${id}`, { method: 'DELETE' })
      setQuestions((qs) => qs.filter((q) => q.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addQuestion()
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      {/* Back */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft size={10} />
        Thèmes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Thème
          </p>
          <h1 className="font-sans font-extrabold text-3xl tracking-tight">{theme.name}</h1>
          <code className="text-xs text-muted-foreground mt-1 block">/session/{theme.slug}</code>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={theme.active ? 'active' : 'inactive'}>
            {theme.active ? 'Actif' : 'Inactif'}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/session/${theme.slug}`} target="_blank">
              <ExternalLink size={11} />
              Tester
            </Link>
          </Button>
        </div>
      </div>

      {/* Questions list */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Questions</CardTitle>
              <CardDescription className="mt-1">
                {questions.length === 0
                  ? 'Aucune question — ajoutez-en ci-dessous.'
                  : `${questions.length} question${questions.length > 1 ? 's' : ''} dans ce thème`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {questions.map((q, i) => (
            <div key={q.id ?? i}>
              <div className="flex items-start gap-3 px-6 py-4 group hover:bg-surface-raised transition-colors">
                <div className="shrink-0 w-6 h-6 flex items-center justify-center mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground/50 group-hover:hidden">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <GripVertical size={12} className="text-muted-foreground/30 hidden group-hover:block cursor-grab" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">{q.text}</p>
                  {q.hint && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Relance : {q.hint}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteQuestion(q.id)}
                  disabled={deletingId === q.id}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive disabled:opacity-40"
                >
                  {deletingId === q.id
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Trash2 size={13} />
                  }
                </button>
              </div>
              <Separator />
            </div>
          ))}

          {/* Add question form */}
          <div className="flex flex-col gap-3 px-6 py-4">
            <Textarea
              placeholder="ex. En une phrase, qu'est-ce que vous faites ?"
              value={newQ.text}
              onChange={(e) => setNewQ((n) => ({ ...n, text: e.target.value }))}
              onKeyDown={handleKeyDown}
              rows={2}
            />
            <div className="flex items-center gap-3">
              <Input
                placeholder="Relance (optionnel)"
                value={newQ.hint}
                onChange={(e) => setNewQ((n) => ({ ...n, hint: e.target.value }))}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button
                onClick={addQuestion}
                disabled={saving || !newQ.text.trim()}
                size="sm"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {saving ? 'Ajout...' : 'Ajouter'}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/50 font-mono">⌘ + Entrée pour ajouter rapidement</p>
          </div>
        </CardContent>
      </Card>

      {/* Introduction */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Introduction vocale</CardTitle>
          <CardDescription>Texte lu à voix haute par l&apos;IA au démarrage de la session, avant les questions.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="introduction">
              Texte d&apos;introduction <span className="text-muted-foreground/50 normal-case tracking-normal">(optionnel)</span>
            </Label>
            <Textarea
              id="introduction"
              placeholder="Ex : Bonjour, nous allons vous poser quelques questions sur votre expérience avec notre produit. Prenez le temps de répondre naturellement."
              value={introduction}
              onChange={(e) => setIntroduction(e.target.value)}
              rows={4}
            />
            <p className="text-[11px] text-muted-foreground/60">Ce texte sera affiché et énoncé par la voix IA avant que l&apos;utilisateur démarre l&apos;enregistrement.</p>
          </div>
          <Button onClick={saveIntroduction} disabled={savingIntro} size="sm" className="self-start">
            {savingIntro && <Loader2 size={12} className="animate-spin mr-1" />}
            {introSaved ? 'Sauvegardé ✓' : 'Sauvegarder'}
          </Button>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Personnalisez l&apos;apparence de la session pour vos utilisateurs.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="brandName">Nom affiché <span className="text-muted-foreground/50 normal-case tracking-normal">(optionnel)</span></Label>
              <Input
                id="brandName"
                placeholder={theme.name}
                value={brand.brandName}
                onChange={(e) => setBrand((b) => ({ ...b, brandName: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="brandColor">Couleur accent</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="brandColor"
                  value={brand.brandColor}
                  onChange={(e) => setBrand((b) => ({ ...b, brandColor: e.target.value }))}
                  className="w-9 h-9 border border-input bg-transparent cursor-pointer p-0.5"
                />
                <Input
                  value={brand.brandColor}
                  onChange={(e) => setBrand((b) => ({ ...b, brandColor: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="logoUrl">URL du logo <span className="text-muted-foreground/50 normal-case tracking-normal">(optionnel)</span></Label>
            <Input
              id="logoUrl"
              placeholder="https://example.com/logo.png"
              value={brand.logoUrl}
              onChange={(e) => setBrand((b) => ({ ...b, logoUrl: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={saveBrand} disabled={savingBrand} size="sm" variant="secondary">
              {savingBrand ? <Loader2 size={12} className="animate-spin" /> : null}
              {brandSaved ? 'Sauvegardé ✓' : savingBrand ? 'Sauvegarde...' : 'Sauvegarder le branding'}
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
