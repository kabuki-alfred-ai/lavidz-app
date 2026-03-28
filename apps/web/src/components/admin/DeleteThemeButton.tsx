'use client'

import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'

interface Props {
  themeId: string
  themeName: string
}

export function DeleteThemeButton({ themeId, themeName }: Props) {
  const router = useRouter()

  const handleDelete = async () => {
    const res = await fetch(`/api/admin/themes/${themeId}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          title="Supprimer"
          className="p-1.5 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all border border-transparent hover:border-destructive/20"
        >
          <Trash2 size={14} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce thème ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le thème <strong>{themeName}</strong> sera traité selon ses dépendances :{' '}
            <span className="block mt-2 space-y-1">
              <span className="block">• <strong>Sans sessions associées</strong> — suppression définitive avec toutes ses questions.</span>
              <span className="block">• <strong>Avec sessions associées</strong> — archivage (thème désactivé, invisible aux utilisateurs, sessions conservées).</span>
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>
            Supprimer / Archiver
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
