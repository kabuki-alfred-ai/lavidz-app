import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
