import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { MemoryVisibility } from './MemoryVisibility'

export const dynamic = 'force-dynamic'

export default async function MemoryPage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')
  return <MemoryVisibility />
}
