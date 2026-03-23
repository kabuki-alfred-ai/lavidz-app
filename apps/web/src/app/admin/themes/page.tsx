import { apiClient } from '@/lib/api'
import type { ThemeDto } from '@lavidz/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, ExternalLink } from 'lucide-react'

export default async function AdminThemesPage() {
  let themes: ThemeDto[] = []
  try {
    themes = await apiClient<ThemeDto[]>('/themes/admin/all')
  } catch {
    themes = []
  }

  return (
    <div className="max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Bibliothèque
          </p>
          <h1 className="font-sans font-extrabold text-3xl text-foreground tracking-tight">
            Thèmes
          </h1>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/themes/new">
            <Plus size={12} />
            Nouveau thème
          </Link>
        </Button>
      </div>

      {/* Table */}
      {themes.length === 0 ? (
        <div className="border border-border border-dashed p-16 text-center">
          <p className="font-sans font-bold text-lg text-foreground mb-2">Aucun thème</p>
          <p className="text-xs text-muted-foreground mb-6">
            Créez votre premier thème pour commencer à enregistrer des vidéos.
          </p>
          <Button asChild size="sm">
            <Link href="/admin/themes/new">
              <Plus size={12} />
              Créer un thème
            </Link>
          </Button>
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_180px_100px_120px_64px] border-b border-border bg-surface">
            {['Nom', 'Slug', 'Questions', 'Statut', ''].map((h) => (
              <div key={h} className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {themes.map((theme, i) => (
            <div
              key={theme.id}
              className={`grid grid-cols-[1fr_180px_100px_120px_64px] items-center border-b border-border last:border-0 hover:bg-surface-raised transition-colors group ${
                i % 2 === 0 ? '' : 'bg-surface/50'
              }`}
            >
              <div className="px-4 py-3.5">
                <p className="font-sans font-semibold text-sm text-foreground">{theme.name}</p>
                {theme.description && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[280px]">
                    {theme.description}
                  </p>
                )}
              </div>

              <div className="px-4 py-3.5">
                <code className="text-[11px] text-muted-foreground">{theme.slug}</code>
              </div>

              <div className="px-4 py-3.5">
                <span className="text-xs font-mono text-foreground">
                  {theme.questions.length}
                  <span className="text-muted-foreground"> q.</span>
                </span>
              </div>

              <div className="px-4 py-3.5">
                <Badge variant={theme.active ? 'active' : 'inactive'}>
                  {theme.active ? 'Actif' : 'Inactif'}
                </Badge>
              </div>

              <div className="px-4 py-3.5 flex items-center gap-2">
                <Link
                  href={`/admin/themes/${theme.id}`}
                  className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                >
                  Edit
                </Link>
                <Link
                  href={`/session/${theme.slug}`}
                  target="_blank"
                  className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                >
                  <ExternalLink size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
