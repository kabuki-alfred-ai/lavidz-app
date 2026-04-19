import { TopicDetail } from './TopicDetail'
import { getSessionUser } from '@/lib/auth'

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  const authorName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email.split('@')[0]
    : 'Vous'
  return <TopicDetail topicId={id} authorName={authorName} />
}
