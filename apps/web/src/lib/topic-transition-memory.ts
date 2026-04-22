import type { CreativeState } from './creative-state'

/**
 * Mémoire locale (localStorage) des transitions d'état Topic déjà "témoignées"
 * par le splash `StateTransitionSplash`. Permet de :
 *
 * - ne PAS rejouer le splash au reload d'un topic qui est déjà dans cet état ;
 * - rejouer le splash si l'user redescend (ex: MATURE → DRAFT) puis remonte
 *   (via `clearTransition`) — respecte le sentiment de "je recommence" ;
 * - SSR-safe : tous les accès sont guardés `typeof window`.
 *
 * Key pattern : `lavidz:topic-transition:${topicId}:${state}`.
 */

const PREFIX = 'lavidz:topic-transition'

function keyFor(topicId: string, state: CreativeState): string {
  return `${PREFIX}:${topicId}:${state}`
}

export function hasSeenTransition(topicId: string, state: CreativeState): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(keyFor(topicId, state)) !== null
  } catch {
    return true // localStorage désactivé → on ne joue pas le splash (safe default)
  }
}

export function markTransitionSeen(topicId: string, state: CreativeState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(keyFor(topicId, state), new Date().toISOString())
  } catch {
    /* silent */
  }
}

export function clearTransition(topicId: string, state: CreativeState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(keyFor(topicId, state))
  } catch {
    /* silent */
  }
}

/**
 * Ordre canonique des 4 états — utilisé pour détecter les transitions
 * "descendantes" (ex: MATURE → EXPLORING) qui doivent clear les splashes
 * des états supérieurs pour qu'ils puissent rejouer au retour.
 */
const STATE_ORDER: CreativeState[] = ['SEED', 'EXPLORING', 'MATURE', 'ARCHIVED']

export function isUpwardTransition(from: CreativeState, to: CreativeState): boolean {
  // ARCHIVED est un état terminal, pas une progression — on le traite comme
  // latéral. Un retour depuis ARCHIVED vers DRAFT = upward.
  if (from === 'ARCHIVED' && to !== 'ARCHIVED') return true
  if (to === 'ARCHIVED') return from !== 'ARCHIVED'
  return STATE_ORDER.indexOf(to) > STATE_ORDER.indexOf(from)
}
