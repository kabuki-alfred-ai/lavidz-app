import Link from 'next/link'
import { Palette, Brain, User, ChevronRight } from 'lucide-react'
import { ThesisIndicatorDot } from '@/components/nav/ThesisIndicatorDot'

const SECTIONS = [
  {
    href: '/brand-kit',
    label: 'Brand Kit',
    description: 'Couleurs, polices et éléments visuels de ta marque',
    icon: Palette,
    showThesisDot: false,
  },
  {
    href: '/mon-univers',
    label: 'Mon Univers',
    description: 'Ta thèse, tes piliers de contenu et ton positionnement',
    icon: Brain,
    showThesisDot: true,
  },
  {
    href: '/profile',
    label: 'Profil',
    description: 'Tes informations personnelles et préférences',
    icon: User,
    showThesisDot: false,
  },
]

export default function MoiPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-6">
      <h1 className="text-xl font-bold text-foreground mb-1">Moi</h1>
      <p className="text-sm text-muted-foreground mb-6">Mon identité créative</p>

      <div className="flex flex-col gap-2">
        {SECTIONS.map(({ href, label, description, icon: Icon, showThesisDot }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 px-4 py-4 rounded-xl bg-surface hover:bg-surface-raised transition-colors"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-background shrink-0">
              <Icon size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{label}</span>
                {showThesisDot && <ThesisIndicatorDot />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
