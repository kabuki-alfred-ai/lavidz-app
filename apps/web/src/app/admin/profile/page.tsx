import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { redirect } from 'next/navigation'
import { ProfileForm } from './ProfileForm'

export default async function ProfilePage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    redirect('/admin/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.userId }
  })

  if (!user) {
    redirect('/admin/login')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter">Mon Profil</h1>
        <p className="text-muted-foreground mt-2">Gérez vos informations personnelles et vos paramètres de sécurité.</p>
      </div>

      <ProfileForm
        initialEmail={user.email}
        initialFirstName={user.firstName ?? ''}
        initialLastName={user.lastName ?? ''}
        hasAvatar={!!user.avatarKey}
      />
    </div>
  )
}
