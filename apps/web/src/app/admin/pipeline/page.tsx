import { getSessionUser } from '@/lib/auth'
import { PipelineClient } from './PipelineClient'
import { OrgSwitcher } from '@/app/admin/OrgSwitcher'

export default async function PipelinePage() {
  const user = await getSessionUser()
  const isSuperadmin = user?.role === 'SUPERADMIN'

  if (isSuperadmin && !user?.activeOrgId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Pipeline de contenu</h1>
        <div className="border border-dashed border-border/30 p-12 text-center rounded-lg bg-surface/10">
          <p className="text-sm text-muted-foreground mb-4">
            Sélectionne une organisation pour voir son pipeline.
          </p>
          <OrgSwitcher activeOrgId={null} />
        </div>
      </div>
    )
  }

  return <PipelineClient />
}
