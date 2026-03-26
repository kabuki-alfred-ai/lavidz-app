import { apiClient } from '@/lib/api'
import type { ThemeDto } from '@lavidz/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Sparkles, Layers, Pencil } from 'lucide-react'
import { TestThemeButton } from '@/components/admin/TestThemeButton'

export default async function AdminThemesPage() {
  let themes: ThemeDto[] = []
  try {
    themes = await apiClient<ThemeDto[]>('/themes/admin/all')
  } catch {
    themes = []
  }

  return (
    <div className="max-w-6xl space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-[1px] bg-primary/40" />
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60">
              Bibliothèque
            </p>
          </div>
          <h1 className="font-inter font-black text-4xl text-foreground tracking-tighter">
            Thèmes
          </h1>
          <p className="text-[11px] font-mono text-muted-foreground/80 mt-2 uppercase tracking-widest leading-relaxed">
            Configuration des parcours d'enregistrement
          </p>
        </div>
        
        <Button asChild size="sm" className="h-10 px-6 rounded-none font-mono text-[10px] uppercase tracking-[0.2em] group transition-all">
          <Link href="/admin/themes/new">
            <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" />
            Nouveau thème
          </Link>
        </Button>
      </div>

      {/* Table */}
      {themes.length === 0 ? (
        <div className="border border-border/40 border-dashed p-20 text-center rounded-sm bg-surface/10">
          <Sparkles size={32} className="mx-auto text-muted-foreground/20 mb-4" />
          <p className="font-inter font-bold text-lg text-foreground mb-2">Aucun thème actif</p>
          <p className="text-[10px] font-mono text-muted-foreground/60 mb-8 uppercase tracking-widest">
            Créez votre premier parcours pour commencer
          </p>
          <Button asChild variant="outline" size="sm" className="rounded-none">
            <Link href="/admin/themes/new">
              <Plus size={12} className="mr-2" />
              Initialiser
            </Link>
          </Button>
        </div>
      ) : (
        <div className="border border-border/60 bg-surface/30 rounded-sm overflow-hidden backdrop-blur-sm shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_180px_100px_120px_100px] border-b border-border/40 bg-surface/50 px-6 py-4">
            {['Nom du parcours', 'Slug', 'Questions', 'Statut', 'Actions'].map((h) => (
              <div key={h} className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/80">
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/40">
            {themes.map((theme) => (
              <div
                key={theme.id}
                className="grid grid-cols-[1fr_180px_100px_120px_100px] items-center px-6 py-5 hover:bg-primary/[0.02] transition-colors group"
              >
                <div className="pr-4">
                  <p className="font-inter font-bold text-[14px] text-foreground group-hover:text-primary transition-colors">{theme.name}</p>
                  {theme.description && (
                    <p className="text-[10px] font-mono text-muted-foreground/60 mt-1 truncate max-w-[320px] uppercase tracking-tighter">
                      {theme.description}
                    </p>
                  )}
                </div>

                <div>
                  <code className="text-[10px] font-mono text-muted-foreground/80">{theme.slug}</code>
                </div>

                <div className="flex items-center gap-2">
                  <Layers size={12} className="text-muted-foreground/20" />
                  <span className="text-[11px] font-mono text-foreground font-bold">
                    {theme.questions.length}
                    <span className="text-muted-foreground/60 font-normal ml-1">q.</span>
                  </span>
                </div>

                <div>
                  <Badge variant={theme.active ? 'active' : 'inactive'}>
                    {theme.active ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>

                <div className="flex items-center gap-4">
                  <Link
                    href={`/admin/themes/${theme.id}`}
                    className="p-1.5 rounded-sm hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all border border-transparent hover:border-primary/20"
                    title="Modifier"
                  >
                    <Pencil size={14} />
                  </Link>
                  <TestThemeButton themeId={theme.id} title="Tester ce thème" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
