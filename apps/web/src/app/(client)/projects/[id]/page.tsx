import { ProjectDetail } from './ProjectDetail'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ProjectDetail projectId={id} />
}
