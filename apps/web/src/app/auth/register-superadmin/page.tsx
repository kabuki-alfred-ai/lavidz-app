import { RegisterSuperadminForm } from './RegisterSuperadminForm'

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function RegisterSuperadminPage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center border border-border p-8">
          <p className="text-xs text-muted-foreground mb-3">Lien invalide</p>
          <p className="text-sm text-muted-foreground">Ce lien d&apos;invitation est manquant ou invalide.</p>
        </div>
      </div>
    )
  }

  // Verify token server-side
  let invitationEmail: string | null = null
  let tokenError: string | null = null

  try {
    const API = process.env.API_URL ?? 'http://localhost:3001'
    const res = await fetch(`${API}/api/users/invitations/verify/${token}`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      invitationEmail = data.email
    } else {
      tokenError = await res.text()
    }
  } catch {
    tokenError = 'Erreur de connexion au serveur.'
  }

  if (tokenError || !invitationEmail) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center px-6">
        <div className="w-full max-w-sm border border-border p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="w-2 h-2 bg-primary" />
            <span className="font-sans font-extrabold text-sm tracking-widest uppercase text-muted-foreground">Lavidz</span>
          </div>
          <p className="text-xs text-destructive mb-3">Invitation invalide</p>
          <p className="text-sm text-muted-foreground">{tokenError ?? 'Ce lien est expiré ou a déjà été utilisé.'}</p>
        </div>
      </div>
    )
  }

  return <RegisterSuperadminForm token={token} email={invitationEmail} />
}
