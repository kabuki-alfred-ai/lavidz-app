import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { ThesisView } from './ThesisView'

export const dynamic = 'force-dynamic'

export default async function ThesisPage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')
  return <ThesisView />
}
