import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { NarrativeArcView } from './NarrativeArcView'

export const dynamic = 'force-dynamic'

export default async function NarrativeArcPage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')
  return <NarrativeArcView />
}
