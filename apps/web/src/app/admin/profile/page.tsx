import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { redirect } from 'next/navigation'
import { ProfileTabs } from './ProfileTabs'

export default async function ProfilePage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect('/admin/login')

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.userId }
  })
  if (!user) redirect('/admin/login')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Mon Profil</h1>
        <p className="text-sm text-muted-foreground mt-1">Gere ton compte et ton activite</p>
      </div>

      <ProfileTabs
        initialEmail={user.email}
        initialFirstName={user.firstName ?? ''}
        initialLastName={user.lastName ?? ''}
        hasAvatar={!!user.avatarKey}
      />
    </div>
  )
}
