import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Brain, Waypoints } from 'lucide-react'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Landing /mon-univers — agrège les trois espaces introspectifs du produit :
 * la mémoire (ce que Kabou sait), la thèse (la conviction forte), l'arche
 * narrative (la trajectoire 3 mois).
 */
export default async function MonUniversPage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')

  const firstName = user.firstName ?? user.email.split('@')[0]

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
          <Brain className="h-3.5 w-3.5" /> Mon univers
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Bonjour {firstName}, on se regarde ?
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Trois angles pour prendre du recul sur ce que Kabou perçoit de toi : ta mémoire partagée,
          la thèse qui oriente tes contenus, et ton arche narrative sur 3 mois glissants.
        </p>
      </header>

      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-3">
        <Card
          href="/mon-univers/memoire"
          icon={Brain}
          title="Ma mémoire"
          subtitle="Ce que Kabou a retenu"
          description="Activité, domaines, style, sources, souvenirs. Tout visible, tout modifiable."
        />
        <Card
          href="/mon-univers/these"
          icon={Waypoints}
          title="Ma thèse"
          subtitle="La conviction qui guide"
          description="Une phrase qui capte ta position. Elle oriente chaque proposition de Kabou."
          tone="primary"
        />
        <Card
          href="/mon-univers/arche"
          icon={Waypoints}
          title="Mon arche"
          subtitle="3 mois glissants"
          description="Ta trajectoire éditoriale : ce qui revient, ce qui s'affirme, ce qui manque."
        />
      </div>
    </div>
  )
}

type IconComp = typeof Brain

function Card({
  href,
  icon: Icon,
  title,
  subtitle,
  description,
  tone = 'default',
}: {
  href: string
  icon: IconComp
  title: string
  subtitle: string
  description: string
  tone?: 'default' | 'primary'
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-2xl border p-5 transition-all active:scale-[0.98] min-h-[120px] sm:min-h-0 ${
        tone === 'primary'
          ? 'border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10'
          : 'border-border/50 bg-surface hover:border-border hover:bg-surface-raised/60'
      }`}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-background border border-border/50">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{subtitle}</p>
      <p className="mb-4 flex-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-transform group-hover:translate-x-0.5">
        Ouvrir <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  )
}
