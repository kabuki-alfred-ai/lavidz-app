/**
 * Shared helper — formatte `Topic.sources` (JSON) en bloc texte lisible
 * consommable par les prompts LLM (session-hook, reshape-recording-script,
 * et plus tard narrative-arc si besoin).
 *
 * Retourne `null` si pas de sources utilisables. Tronque chaque takeaway à
 * 200 chars pour ne pas saturer le contexte ; slice à 5 sources max (les 5
 * premières de la liste, qui sont les plus pertinentes selon la curation
 * Tavily initiale).
 */

type RawSource = {
  title?: string
  url?: string
  summary?: string
  relevance?: string
  keyTakeaway?: string
}

export function formatTopicSourcesForPrompt(
  raw: unknown,
  maxSources = 5,
): string | null {
  if (!raw || typeof raw !== 'object') return null
  const container = raw as { sources?: unknown }
  if (!Array.isArray(container.sources)) return null
  const sources = (container.sources as RawSource[]).filter((s) => s && typeof s === 'object')
  if (sources.length === 0) return null

  const lines = sources.slice(0, maxSources).map((s, i) => {
    const title = typeof s.title === 'string' && s.title.trim() ? s.title.trim() : 'Source'
    const relevance =
      typeof s.relevance === 'string' && s.relevance.trim() ? ` [${s.relevance.trim()}]` : ''
    const takeaway =
      (typeof s.keyTakeaway === 'string' && s.keyTakeaway.trim()
        ? s.keyTakeaway
        : typeof s.summary === 'string'
          ? s.summary
          : '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 220)
    return `${i + 1}. ${title}${relevance} — ${takeaway}`
  })

  return lines.join('\n')
}
