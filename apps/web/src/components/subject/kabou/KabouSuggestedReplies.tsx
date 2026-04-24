'use client'

import type { CreativeState } from '@/lib/creative-state'
import type { NarrativeAnchor } from '@/lib/narrative-anchor'

interface KabouSuggestedRepliesProps {
  brief: string | null
  narrativeAnchor: NarrativeAnchor | null
  creativeState: CreativeState
  hasPendingSession: boolean
  onPick: (text: string) => void
}

type Suggestion = { id: string; label: string; prompt: string }

/**
 * Chips de démarrage contextuelles — inspirées de la maquette Bright Lovelace,
 * version locale. Plutôt que de streamer de vraies suggestions depuis le LLM
 * (ce qui demande une tool ou un second appel), on pose 1–3 amorces qui font
 * sens au stade actuel du sujet. Si on n'a rien de pertinent à proposer, on
 * ne rend rien — pas de chips pour meubler.
 *
 * La liste réagit à l'état du sujet (SEED → angle, EXPLORING → piliers,
 * MATURE → hook/métaphores, etc.). Remplaçable en Lot 4 par un flux streamé.
 */
export function KabouSuggestedReplies({
  brief,
  narrativeAnchor,
  creativeState,
  hasPendingSession,
  onPick,
}: KabouSuggestedRepliesProps) {
  const suggestions = computeSuggestions({
    brief,
    narrativeAnchor,
    creativeState,
    hasPendingSession,
  })
  if (suggestions.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 pl-9">
      {suggestions.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s.prompt)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] rounded-full border border-border text-muted-foreground bg-surface-raised/50 hover:bg-surface-raised hover:text-foreground transition"
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

function computeSuggestions({
  brief,
  narrativeAnchor,
  creativeState,
  hasPendingSession,
}: {
  brief: string | null
  narrativeAnchor: NarrativeAnchor | null
  creativeState: CreativeState
  hasPendingSession: boolean
}): Suggestion[] {
  const briefSolid = (brief?.trim().length ?? 0) > 40
  const pillarsCount =
    narrativeAnchor?.bullets.filter((b) => b.trim().length > 0).length ?? 0

  if (creativeState === 'ARCHIVED') {
    return [
      {
        id: 'resurrect',
        label: 'Ce sujet mérite un retour ?',
        prompt: "Ce sujet est archivé. Dis-moi si tu vois un angle frais qui pourrait le remettre en vie aujourd'hui.",
      },
    ]
  }

  if (hasPendingSession) {
    return [
      {
        id: 'tighten-hook',
        label: 'Aide-moi à resserrer le hook',
        prompt: "Mon script est prêt — aide-moi à resserrer le hook pour qu'il claque en 8 secondes.",
      },
      {
        id: 'stress-test',
        label: "Stress-test mon angle avant que j'enregistre",
        prompt: "Stress-test mon angle en 3 contre-arguments avant que j'enregistre.",
      },
    ]
  }

  if (!briefSolid) {
    return [
      {
        id: 'find-angle',
        label: "Aide-moi à trouver l'angle",
        prompt: "J'ai posé ce sujet mais je n'ai pas encore d'angle clair. Aide-moi à en faire émerger un en me posant 3 questions qui tuent.",
      },
      {
        id: 'who-for',
        label: "Pour qui je parle ?",
        prompt: "Aide-moi à préciser à qui s'adresse ce sujet — décris l'archétype qui doit se sentir attaqué/vu.",
      },
    ]
  }

  if (briefSolid && pillarsCount < 3) {
    return [
      {
        id: 'extract-pillars',
        label: 'Extrais mes piliers',
        prompt: 'Mon angle est posé. Extrais 3 à 4 piliers narratifs qui doivent survivre à tous les formats.',
      },
      {
        id: 'counter-arg',
        label: 'Challenge mon angle',
        prompt: 'Challenge mon angle avec le contre-argument le plus dur que tu puisses trouver.',
      },
    ]
  }

  if (creativeState === 'MATURE') {
    return [
      {
        id: 'metaphors',
        label: 'Propose-moi 3 métaphores',
        prompt: 'Propose-moi 3 métaphores concrètes qui parlent à l\'estomac pour le hook.',
      },
      {
        id: 'first-format',
        label: 'Quel format tourner en premier ?',
        prompt: "Vu mon angle et mes piliers, quel format tu recommandes de tourner en premier et pourquoi ?",
      },
    ]
  }

  return [
    {
      id: 'sharpen',
      label: "Muscle l'angle",
      prompt: "Pose-moi 2 questions précises qui vont muscler l'angle sans le dénaturer.",
    },
  ]
}
