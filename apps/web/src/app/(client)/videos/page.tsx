import { getSessionUser } from '@/lib/auth'
import { ClientVideos } from './ClientVideos'

export default async function VideosPage() {
  const user = await getSessionUser()
  const authorName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email.split('@')[0]
    : 'Vous'
  return <ClientVideos authorName={authorName} />
}
