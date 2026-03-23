'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (res.ok) {
      const from = searchParams.get('from') ?? '/admin'
      router.push(from)
      router.refresh()
    } else {
      setError(await res.text())
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm animate-fade-in">
      <div className="flex items-center gap-2 mb-12">
        <span className="w-2 h-2 bg-primary" />
        <span className="font-sans font-extrabold text-sm tracking-widest uppercase text-muted-foreground">
          Lavidz
        </span>
      </div>

      <h1 className="font-sans font-extrabold text-2xl tracking-tight mb-1">Connexion</h1>
      <p className="text-xs text-muted-foreground mb-8">Entrez vos identifiants pour continuer.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            required
            placeholder="vous@entreprise.com"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-xs text-destructive font-mono">{error}</p>}

        <Button type="submit" disabled={loading || !email || !password}>
          {loading && <Loader2 size={12} className="animate-spin" />}
          {loading ? 'Connexion...' : 'Se connecter'}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground mt-6 text-center">
        Pas encore de compte ?{' '}
        <Link href="/auth/register" className="text-foreground underline underline-offset-2">
          Créer une organisation
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background grid-bg flex items-center justify-center px-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
