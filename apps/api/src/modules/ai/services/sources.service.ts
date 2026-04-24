import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { generateObject } from '../providers/ai-sdk'
import { z } from 'zod'
import { prisma, Prisma } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'

const CuratedSourcesSchema = z.object({
  sources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        summary: z.string().describe('Résumé factuel en 2-3 phrases'),
        relevance: z
          .enum(['FACT', 'DATA', 'COUNTERPOINT', 'CONTEXT'])
          .describe(
            "FACT = source qui confirme un fait | DATA = chiffres, étude | COUNTERPOINT = angle opposé à contester | CONTEXT = mise en contexte historique / sectorielle",
          ),
        /**
         * `kind` = nature éditoriale de la source, orthogonale à `relevance`.
         * ANCRAGE = source externe vérifiable avec lien (article, étude, site)
         * RÉFÉRENCE = livre, auteur, cadre intellectuel (souvent sans URL propre)
         * VÉCU = anecdote/donnée personnelle de l'entrepreneur (pas d'URL externe)
         * Optionnel : dérivé côté UI si absent.
         */
        kind: z.enum(['ANCRAGE', 'REFERENCE', 'VECU']).optional(),
        /**
         * `selected` = source ancrée par l'entrepreneur (elle va dans la
         * mémoire IA et sert de référence à Kabou). Les sources trouvées par
         * Tavily/Kabou arrivent en `selected: false` (candidates), celles
         * ajoutées manuellement arrivent en `selected: true`. Toggle via le
         * pin dans l'UI. `undefined` traité comme `true` pour compat.
         */
        selected: z.boolean().optional(),
        keyTakeaway: z
          .string()
          .describe("Le point à retenir en 1 phrase — ce que l'entrepreneur peut citer à l'oral"),
      }),
    )
    .min(0)
    .max(12),
})

export type CuratedSource = z.infer<typeof CuratedSourcesSchema>['sources'][number]

type StoredSources = {
  sources: CuratedSource[]
  query: string
  fetchedAt: string
}

/**
 * SourcesService — curates 2-5 credible sources to anchor a Sujet, especially
 * valuable for HOT_TAKE / fact-heavy formats where opinion without substance
 * sounds hollow. Uses Tavily for retrieval and an LLM pass to classify relevance
 * and extract key takeaways. Falls back gracefully without Tavily (empty result).
 */
@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name)

  async fetchForTopic(organizationId: string, topicId: string): Promise<StoredSources> {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: { id: true, name: true, brief: true, pillar: true },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')

    const query = this.buildQuery(topic.name, topic.brief, topic.pillar)
    const tavilyKey = process.env.TAVILY_API_KEY ?? ''
    if (!tavilyKey) {
      const empty: StoredSources = { sources: [], query, fetchedAt: new Date().toISOString() }
      await this.persist(topic.id, empty)
      return empty
    }

    let rawResults: Array<{ title: string; url: string; content: string }> = []
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${tavilyKey}`,
        },
        body: JSON.stringify({
          query,
          search_depth: 'advanced',
          max_results: 8,
          include_answer: false,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as {
          results?: Array<{ title: string; url: string; content: string }>
        }
        rawResults = (data.results ?? []).map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        }))
      }
    } catch (err) {
      this.logger.warn(`Tavily error while sourcing topic ${topic.id}: ${String(err)}`)
    }

    if (rawResults.length === 0) {
      const empty: StoredSources = { sources: [], query, fetchedAt: new Date().toISOString() }
      await this.persist(topic.id, empty)
      return empty
    }

    const prompt = `Tu es Kabou, et tu aides un entrepreneur à ancrer un sujet sur des sources crédibles avant d'enregistrer. Le sujet :

Nom : ${topic.name}
${topic.pillar ? `Domaine : ${topic.pillar}` : ''}
${topic.brief ? `Angle travaillé :\n${topic.brief}` : ''}

Voici des résultats bruts de recherche web — garde 3 à 5 sources MAXIMUM, celles qui apportent un vrai appui factuel, un chiffre, un contre-argument ou un contexte sectoriel. Ignore les articles promotionnels.

Pour chaque source retenue :
- "relevance" :
  - FACT : confirme un fait clé dont l'entrepreneur pourrait parler
  - DATA : donne un chiffre, une étude, une statistique
  - COUNTERPOINT : défend un angle opposé (utile pour les HOT_TAKE)
  - CONTEXT : met en contexte historique ou sectoriel
- "keyTakeaway" : une phrase à citer à l'oral, en français naturel (pas de copier-coller anglais)
- "summary" : 2-3 phrases factuelles

Règles : tutoiement interdit ici (résumé factuel). Vocabulaire : Sujet, Domaine.

Résultats bruts :
${rawResults.slice(0, 8).map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content.slice(0, 500)}`).join('\n\n')}`

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: CuratedSourcesSchema,
      prompt,
    })

    // Nouvelles sources = candidates par défaut, l'user les sélectionne après.
    const stored: StoredSources = {
      sources: object.sources.map((s) => ({ ...s, selected: false })),
      query,
      fetchedAt: new Date().toISOString(),
    }
    await this.persist(topic.id, stored)
    return stored
  }

  async get(organizationId: string, topicId: string): Promise<StoredSources | null> {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: { sources: true },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')
    if (!topic.sources || typeof topic.sources !== 'object') return null
    return topic.sources as unknown as StoredSources
  }

  /**
   * Ajoute manuellement une source fournie par l'user (title/url obligatoires,
   * summary/keyTakeaway/relevance optionnels avec fallbacks doux). Append à la
   * liste existante — déduplique par URL si déjà présente.
   */
  async addManualSource(
    organizationId: string,
    topicId: string,
    input: {
      title: string
      url: string
      summary?: string
      keyTakeaway?: string
      relevance?: CuratedSource['relevance']
      kind?: CuratedSource['kind']
    },
  ): Promise<StoredSources> {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: { id: true, sources: true },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')
    const title = input.title?.trim()
    const url = input.url?.trim()
    if (!title || !url) {
      throw new Error('title et url requis')
    }
    const existing = this.readSources(topic.sources)
    const filtered = existing.sources.filter((s) => s.url.trim() !== url)
    const newSource: CuratedSource = {
      title,
      url,
      summary: input.summary?.trim() || 'Source ajoutée manuellement.',
      keyTakeaway: input.keyTakeaway?.trim() || title,
      relevance: input.relevance ?? 'CONTEXT',
      kind: input.kind,
      // Ajout manuel = l'entrepreneur choisit activement → sélectionnée d'emblée.
      selected: true,
    }
    const next: StoredSources = {
      sources: [...filtered, newSource],
      query: existing.query || 'manual',
      fetchedAt: new Date().toISOString(),
    }
    await this.persist(topic.id, next)
    return next
  }

  /**
   * Relance une recherche Tavily avec une query custom fournie par l'user
   * (ex: "chiffres échec projets IA PME 2026"). Les sources trouvées sont
   * curatées par LLM et APPEND à l'existant — déduplique par URL.
   * Fallback silencieux si Tavily absent ou aucun résultat.
   */
  async searchWithQuery(
    organizationId: string,
    topicId: string,
    customQuery: string,
  ): Promise<StoredSources> {
    const q = customQuery?.trim()
    if (!q) throw new Error('query requise')

    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: { id: true, name: true, brief: true, pillar: true, sources: true },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')

    const existing = this.readSources(topic.sources)
    const tavilyKey = process.env.TAVILY_API_KEY ?? ''
    if (!tavilyKey) return existing

    let rawResults: Array<{ title: string; url: string; content: string }> = []
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${tavilyKey}` },
        body: JSON.stringify({ query: q, search_depth: 'advanced', max_results: 8 }),
      })
      if (res.ok) {
        const data = (await res.json()) as {
          results?: Array<{ title: string; url: string; content: string }>
        }
        rawResults = (data.results ?? []).map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        }))
      }
    } catch (err) {
      this.logger.warn(`Tavily error (custom query) topic ${topic.id}: ${String(err)}`)
    }

    if (rawResults.length === 0) return existing

    const prompt = `Tu es Kabou. L'entrepreneur cherche des sources sur une sous-question précise de son sujet. Le sujet :

Nom : ${topic.name}
${topic.pillar ? `Domaine : ${topic.pillar}` : ''}
${topic.brief ? `Angle :\n${topic.brief}` : ''}

### Requête spécifique de l'entrepreneur
${q}

Voici les résultats bruts — garde 2 à 5 sources MAXIMUM qui répondent précisément à cette requête. Ignore le promotionnel. Pour chaque :
- "relevance" : FACT / DATA / COUNTERPOINT / CONTEXT (cf. rôle habituel)
- "keyTakeaway" : 1 phrase citable à l'oral en français naturel
- "summary" : 2-3 phrases factuelles

Résultats bruts :
${rawResults.slice(0, 8).map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content.slice(0, 500)}`).join('\n\n')}`

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: CuratedSourcesSchema,
      prompt,
    })

    // Append en dédupliquant par URL ; les nouvelles entrent en candidates.
    const existingUrls = new Set(existing.sources.map((s) => s.url.trim()))
    const additions = object.sources
      .filter((s) => !existingUrls.has(s.url.trim()))
      .map((s) => ({ ...s, selected: false }))
    const next: StoredSources = {
      sources: [...existing.sources, ...additions],
      query: q,
      fetchedAt: new Date().toISOString(),
    }
    await this.persist(topic.id, next)
    return next
  }

  /**
   * Bascule l'état `selected` d'une source identifiée par URL. Pas de flag
   * fourni → toggle ; flag explicite → force la valeur. Une source sans champ
   * `selected` est traitée comme déjà sélectionnée (compat existants).
   */
  async toggleSelected(
    organizationId: string,
    topicId: string,
    url: string,
    force?: boolean,
  ): Promise<StoredSources> {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: { id: true, sources: true },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')
    const existing = this.readSources(topic.sources)
    const next: StoredSources = {
      ...existing,
      sources: existing.sources.map((s) => {
        if (s.url.trim() !== url.trim()) return s
        const current = s.selected === false ? false : true
        const nextSelected = typeof force === 'boolean' ? force : !current
        return { ...s, selected: nextSelected }
      }),
    }
    await this.persist(topic.id, next)
    return next
  }

  async removeSource(
    organizationId: string,
    topicId: string,
    url: string,
  ): Promise<StoredSources> {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: { id: true, sources: true },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')
    const existing = this.readSources(topic.sources)
    const next: StoredSources = {
      ...existing,
      sources: existing.sources.filter((s) => s.url.trim() !== url.trim()),
    }
    await this.persist(topic.id, next)
    return next
  }

  private readSources(raw: Prisma.JsonValue): StoredSources {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { sources: [], query: '', fetchedAt: new Date().toISOString() }
    }
    const v = raw as unknown as Partial<StoredSources>
    return {
      sources: Array.isArray(v.sources) ? v.sources : [],
      query: typeof v.query === 'string' ? v.query : '',
      fetchedAt: typeof v.fetchedAt === 'string' ? v.fetchedAt : new Date().toISOString(),
    }
  }

  private async persist(topicId: string, value: StoredSources): Promise<void> {
    await prisma.topic.update({
      where: { id: topicId },
      data: { sources: value as unknown as Prisma.InputJsonValue },
    })
  }

  private buildQuery(name: string, brief: string | null, pillar: string | null): string {
    const parts = [name]
    if (pillar) parts.push(pillar)
    if (brief) {
      const cleaned = brief.replace(/\s+/g, ' ').trim().slice(0, 200)
      if (cleaned.length > 0) parts.push(cleaned)
    }
    return parts.join(' — ').slice(0, 400)
  }
}
