'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function NewThemePage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', slug: '', description: '', introduction: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    setForm((f) => ({ ...f, name, slug }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/themes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '',
        },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? 'Erreur lors de la création')
      }
      const theme = await res.json()
      router.push(`/admin/themes/${theme.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl animate-fade-in">
      {/* Back */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft size={10} />
        Thèmes
      </Link>

      <div className="mb-8">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Nouveau</p>
        <h1 className="font-sans font-extrabold text-3xl tracking-tight">Créer un thème</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations du thème</CardTitle>
          <CardDescription>
            Le thème définit la catégorie de votre boîte à questions — ex. "Présentation entreprise".
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nom du thème *</Label>
              <Input
                id="name"
                placeholder="ex. Présentation entreprise"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="slug">
                Slug <span className="text-muted-foreground/50 normal-case tracking-normal">(auto-généré)</span>
              </Label>
              <div className="flex items-center border border-input focus-within:border-primary transition-colors">
                <span className="px-3 py-2 text-xs text-muted-foreground/60 border-r border-input bg-surface font-mono select-none">
                  /session/
                </span>
                <Input
                  id="slug"
                  className="border-0 focus-visible:border-0"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description <span className="text-muted-foreground/50 normal-case tracking-normal">(optionnel)</span></Label>
              <Textarea
                id="description"
                placeholder="Brève description affichée à l'utilisateur avant de commencer."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="introduction">
                Introduction <span className="text-muted-foreground/50 normal-case tracking-normal">(optionnel)</span>
              </Label>
              <Textarea
                id="introduction"
                placeholder="Texte lu à voix haute par l'IA au lancement de la session, avant les questions. Ex : « Bonjour, nous allons vous poser quelques questions sur… »"
                value={form.introduction}
                onChange={(e) => setForm((f) => ({ ...f, introduction: e.target.value }))}
                rows={4}
              />
              <p className="text-[11px] text-muted-foreground/60">Ce texte sera énoncé par la voix IA au démarrage de la session.</p>
            </div>

            {error && (
              <p className="text-xs text-destructive font-mono">{error}</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={loading || !form.name.trim()}>
                {loading && <Loader2 size={12} className="animate-spin" />}
                {loading ? 'Création...' : 'Créer le thème'}
              </Button>
              <Button type="button" variant="ghost" asChild>
                <Link href="/admin">Annuler</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
