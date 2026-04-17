'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ShieldCheck } from 'lucide-react'

interface Props {
  token: string
  email: string
}

export function RegisterSuperadminForm({ token, email }: Props) {
  const [form, setForm] = useState({ firstName: '', lastName: '', organizationName: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas'); return }
    if (form.password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register-superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: form.password,
          firstName: form.firstName || undefined,
          lastName: form.lastName || undefined,
          organizationName: form.organizationName || undefined,
        }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        setError(await res.text())
      }
    } catch {
      setError('Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center px-6">
        <div className="w-full max-w-sm animate-fade-in text-center">
          <div className="flex items-center justify-center gap-1.5 mb-12 group cursor-pointer">
            <div className="relative w-6 h-6 flex items-center justify-center">
              <span className="block w-3 h-3 bg-primary animate-logo-morph shadow-[0_0_10px_rgba(var(--primary),0.2)]" />
            </div>
            <span className="font-sans font-black text-lg tracking-tighter text-foreground uppercase">LAVIDZ</span>
          </div>
          <div className="border border-border p-8">
            <div className="w-10 h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={18} className="text-emerald-400" />
            </div>
            <p className="text-xs text-muted-foreground mb-3">Compte créé</p>
            <h2 className="font-sans font-extrabold text-xl tracking-tight mb-3">Bienvenue dans l&apos;équipe !</h2>
            <p className="text-xs text-muted-foreground mb-6">Votre compte superadmin a été créé avec succès.</p>
            <Link
              href="/auth/login"
              className="inline-block text-xs bg-primary text-white px-6 py-3 hover:bg-primary/90 transition-colors"
            >
              Se connecter →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background grid-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex items-center gap-1.5 mb-12 group cursor-pointer">
          <div className="relative w-6 h-6 flex items-center justify-center">
            <span className="block w-3 h-3 bg-primary animate-logo-morph shadow-[0_0_10px_rgba(var(--primary),0.2)]" />
          </div>
          <span className="font-sans font-black text-lg tracking-tighter text-foreground uppercase">Lavidz</span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={14} className="text-primary" />
          <span className="text-xs text-primary">Invitation Superadmin</span>
        </div>
        <h1 className="font-sans font-extrabold text-2xl tracking-tight mb-1">Créer votre compte</h1>
        <p className="text-xs text-muted-foreground mb-8">
          Vous êtes invité(e) à rejoindre l&apos;équipe Lavidz en tant que superadmin.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Email</Label>
            <Input value={email} disabled className="opacity-60 cursor-not-allowed" />
            <p className="text-xs text-muted-foreground">L&apos;email est fixé par l&apos;invitation et ne peut pas être modifié.</p>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-2">
              <Label htmlFor="firstName">Prénom (optionnel)</Label>
              <Input id="firstName" value={form.firstName} onChange={set('firstName')} placeholder="Marie" />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <Label htmlFor="lastName">Nom (optionnel)</Label>
              <Input id="lastName" value={form.lastName} onChange={set('lastName')} placeholder="Dupont" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="organizationName">Organisation (optionnel)</Label>
            <Input
              id="organizationName"
              value={form.organizationName}
              onChange={set('organizationName')}
              placeholder="Ex : Acme Corp"
            />
            <p className="text-xs text-muted-foreground">
              Si renseigné, une organisation sera créée ou retrouvée par ce nom et associée à votre compte.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" value={form.password} onChange={set('password')} required minLength={8} placeholder="8 caractères minimum" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">Confirmer le mot de passe</Label>
            <Input id="confirm" type="password" value={form.confirm} onChange={set('confirm')} required />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading && <Loader2 size={12} className="animate-spin" />}
            {loading ? 'Création...' : 'Créer mon compte superadmin'}
          </Button>
        </form>
      </div>
    </div>
  )
}
