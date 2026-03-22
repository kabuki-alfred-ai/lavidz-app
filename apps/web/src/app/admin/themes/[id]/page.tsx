import { apiClient } from '@/lib/api'
import type { ThemeDto } from '@lavidz/types'
import { ThemeEditor } from '@/components/admin/ThemeEditor'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ThemePage({ params }: Props) {
  const { id } = await params
  const theme = await apiClient<ThemeDto>(`/themes/${id}`)

  return <ThemeEditor theme={theme} />
}
