import { notFound } from 'next/navigation'
import { RegisterOrgForm } from './RegisterOrgForm'

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function RegisterOrgPage({ searchParams }: PageProps) {
  const { token } = await searchParams

  if (!token) return notFound()

  const API = process.env.API_URL ?? 'http://localhost:3001'

  const res = await fetch(`${API}/api/users/org-invitations/verify/${token}`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    const message = await res.text()
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="flex items-center justify-center gap-1.5 mb-12 group cursor-pointer">
            <div className="relative w-6 h-6 flex items-center justify-center">
              <span className="block w-3 h-3 bg-primary animate-logo-morph shadow-[0_0_10px_rgba(var(--primary),0.2)]" />
            </div>
            <span className="font-sans font-black text-lg tracking-tighter text-foreground uppercase">LAVIDZ</span>
          </div>
          <div className="border border-border p-8">
            <p className="text-xs font-mono uppercase tracking-widest text-destructive mb-3">Lien invalide</p>
            <h2 className="font-sans font-extrabold text-xl tracking-tight mb-3">Invitation introuvable</h2>
            <p className="text-xs text-muted-foreground mb-6">{message}</p>
          </div>
        </div>
      </div>
    )
  }

  const { email, organizationName, role } = await res.json()

  return (
    <RegisterOrgForm
      token={token}
      email={email}
      organizationName={organizationName}
      role={role}
    />
  )
}
