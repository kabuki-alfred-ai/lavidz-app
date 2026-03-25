'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const [form, setForm] = useState({ orgName: '', email: '', password: '', confirm: '', firstName: '', lastName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas'); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName: form.orgName, email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName }),
    })

    if (res.ok) {
      setDone(true)
    } else {
      setError(await res.text())
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center px-6">
        <div className="w-full max-w-sm animate-fade-in text-center">
          <div className="flex items-center justify-center gap-2 mb-12">
            <span className="w-2 h-2 bg-primary rounded-none" />
            <span className="font-sans font-extrabold text-base tracking-tight text-foreground">LAVIDZ</span>
          </div>
          <div className="border border-border p-8">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Demande envoyée</p>
            <h2 className="font-sans font-extrabold text-xl tracking-tight mb-3">Votre organisation est en cours de validation</h2>
            <p className="text-xs text-muted-foreground mb-6">
              L&apos;équipe Lavidz examinera votre demande et activera votre compte. Vous pourrez ensuite vous connecter.
            </p>
            <Link href="/auth/login" className="text-xs font-mono text-muted-foreground underline underline-offset-2">
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background grid-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex items-center gap-2 mb-12">
          <span className="w-2 h-2 bg-primary" />
          <span className="font-sans font-extrabold text-sm tracking-widest uppercase text-muted-foreground">Lavidz</span>
        </div>

        <h1 className="font-sans font-extrabold text-2xl tracking-tight mb-1">Créer une organisation</h1>
        <p className="text-xs text-muted-foreground mb-8">Votre demande sera validée par l&apos;équipe Lavidz.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="orgName">Nom de l&apos;organisation</Label>
            <Input id="orgName" value={form.orgName} onChange={set('orgName')} required placeholder="Acme Corp" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-2">
              <Label htmlFor="firstName">Votre prénom (optionnel)</Label>
              <Input id="firstName" value={form.firstName} onChange={set('firstName')} placeholder="Marie" />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <Label htmlFor="lastName">Votre nom (optionnel)</Label>
              <Input id="lastName" value={form.lastName} onChange={set('lastName')} placeholder="Dupont" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={set('email')} required placeholder="vous@acme.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" value={form.password} onChange={set('password')} required minLength={8} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">Confirmer le mot de passe</Label>
            <Input id="confirm" type="password" value={form.confirm} onChange={set('confirm')} required />
          </div>

          {error && <p className="text-xs text-destructive font-mono">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading && <Loader2 size={12} className="animate-spin" />}
            {loading ? 'Envoi...' : 'Créer mon organisation'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Déjà un compte ?{' '}
          <Link href="/auth/login" className="text-foreground underline underline-offset-2">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
