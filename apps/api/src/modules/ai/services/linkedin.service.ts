import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { prisma } from '@lavidz/database'
import { MemoryService } from './memory.service'
import { ProfileService } from './profile.service'

const RAPIDAPI_HOST = 'fresh-linkedin-scraper-api.p.rapidapi.com'
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}/api/v1`

export type LinkedinPreview = {
  name: string
  headline: string
  photoUrl: string | null
  company: string | null
  username: string | null
}

@Injectable()
export class LinkedinService {
  private readonly logger = new Logger(LinkedinService.name)

  constructor(
    private readonly memoryService: MemoryService,
    private readonly profileService: ProfileService,
  ) {}

  private get apiKey(): string {
    const key = process.env.RAPIDAPI_KEY
    if (!key) throw new BadRequestException('RAPIDAPI_KEY non configurée')
    return key
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': this.apiKey,
    }
  }

  private async rapidGet(path: string): Promise<unknown> {
    const url = `${RAPIDAPI_BASE}${path}`
    this.logger.log(`RapidAPI GET ${url}`)
    const res = await fetch(url, { headers: this.headers() })
    if (!res.ok) {
      const txt = await res.text()
      this.logger.warn(`RapidAPI ${path} → ${res.status}: ${txt}`)
      return null
    }
    const raw = await res.json() as { success: boolean; data: unknown }
    this.logger.log(`RapidAPI ${path} → OK, response: ${JSON.stringify(raw).slice(0, 600)}`)
    if (!raw.success) {
      this.logger.warn(`RapidAPI ${path} → success=false`)
      return null
    }
    return raw.data
  }

  extractUsername(url: string): string | null {
    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/)
    return match?.[1] ?? null
  }

  async getPreview(url: string): Promise<LinkedinPreview> {
    const username = this.extractUsername(url)
    if (!username) throw new BadRequestException('URL LinkedIn invalide')
    const data = await this.rapidGet(`/user/profile?username=${encodeURIComponent(username)}`) as Record<string, unknown> | null
    if (!data) throw new BadRequestException('Impossible de récupérer le profil LinkedIn')
    return this.buildPreview(data)
  }

  private buildPreview(data: Record<string, unknown>): LinkedinPreview {
    const name = String(data.full_name ?? [data.first_name, data.last_name].filter(Boolean).join(' ') ?? '')
    const headline = String(data.headline ?? '')
    const photos = data.profile_picture as Array<{ url: string }> | undefined
    const photoUrl = photos?.[0]?.url ?? null
    const username = String(data.public_identifier ?? '') || null
    const location = data.location as Record<string, unknown> | undefined
    const city = String(location?.city ?? '') || null

    return { name, headline, photoUrl, company: city, username }
  }

  async ingestLinkedinData(organizationId: string, linkedinUrl: string): Promise<{ saved: number }> {
    const profile = await this.profileService.getOrCreate(organizationId)
    this.logger.log(`Ingestion LinkedIn pour org ${organizationId}: ${linkedinUrl}`)

    const chunks: Array<{ content: string; tags: string[] }> = []

    // 1. Profile
    const username = this.extractUsername(linkedinUrl)
    if (!username) throw new BadRequestException('URL LinkedIn invalide')

    const profileData = await this.rapidGet(`/user/profile?username=${encodeURIComponent(username)}`) as Record<string, unknown> | null
    if (!profileData) throw new BadRequestException('Profil LinkedIn introuvable ou inaccessible')

    const name = String(profileData.full_name ?? [profileData.first_name, profileData.last_name].filter(Boolean).join(' ') ?? username)
    const headline = String(profileData.headline ?? '')
    const userUrn = String(profileData.urn ?? '')
    const location = profileData.location as Record<string, unknown> | undefined
    const city = String(location?.city ?? '') || null
    const photos = profileData.profile_picture as Array<{ url: string }> | undefined
    const photoUrl = photos?.[0]?.url ?? null

    const profileLines: string[] = [`Profil LinkedIn de ${name}`]
    if (headline) profileLines.push(`Titre : ${headline}`)
    if (city) profileLines.push(`Localisation : ${city}`)

    const about = String(profileData.about ?? profileData.summary ?? '')
    if (about) profileLines.push(`À propos : ${about}`)

    chunks.push({
      content: profileLines.filter(Boolean).join('\n'),
      tags: ['linkedin', 'fact'],
    })

    // 2. Posts (using user URN)
    if (userUrn) {
      const postsData = await this.rapidGet(`/user/publications?urn=${encodeURIComponent(userUrn)}&page=1`)
      const posts = Array.isArray(postsData) ? postsData as Array<Record<string, unknown>> : []

      const recentPosts = posts.slice(0, 10)
      for (const post of recentPosts) {
        const text = String(post.text ?? '')
        if (text.length < 30) continue

        const activity = post.activity as Record<string, unknown> | undefined
        const likes = activity?.num_likes ? ` (${activity.num_likes} likes)` : ''

        chunks.push({
          content: `Post LinkedIn de ${name}${likes} :\n${text}`,
          tags: ['linkedin', 'post'],
        })
      }

      // 3. Comments/reactions (shows topics the user engages with)
      try {
        const commentsData = await this.rapidGet(`/user/comments?urn=${encodeURIComponent(userUrn)}&page=1`)
        const comments = Array.isArray(commentsData) ? commentsData as Array<Record<string, unknown>> : []
        const commentTexts = comments
          .slice(0, 8)
          .map((c) => String(c.text ?? c.comment ?? ''))
          .filter((t) => t.length > 20)

        if (commentTexts.length > 0) {
          chunks.push({
            content: `Commentaires récents de ${name} sur LinkedIn :\n${commentTexts.join('\n---\n')}`,
            tags: ['linkedin', 'comment'],
          })
        }
      } catch {
        // ignore
      }
    }

    // 4. Company (extract slug from profileData if available)
    const companySlug = this.extractCompanySlug(profileData)
    if (companySlug) {
      const companyData = await this.rapidGet(`/company/profile?company=${encodeURIComponent(companySlug)}`) as Record<string, unknown> | null
      if (companyData) {
        const companyLines: string[] = [
          `Entreprise : ${String(companyData.name ?? companySlug)}`,
        ]
        const desc = String(companyData.description ?? companyData.about ?? '')
        if (desc) companyLines.push(`Description : ${desc.slice(0, 400)}`)
        const industry = String(companyData.industry ?? companyData.industries ?? '')
        if (industry) companyLines.push(`Secteur : ${industry}`)
        const size = String(companyData.employee_count ?? companyData.staff_count ?? '')
        if (size) companyLines.push(`Taille : ${size} employés`)

        chunks.push({
          content: companyLines.filter(Boolean).join('\n'),
          tags: ['linkedin', 'company'],
        })
      }
    }

    // 5. Save
    this.logger.log(`Chunks à sauvegarder (${chunks.length}) :`)
    chunks.forEach((c, i) => this.logger.log(`  [${i}] tags=${c.tags.join(',')} content="${c.content.slice(0, 200)}"`))

    if (chunks.length > 0) {
      await this.memoryService.saveManyDocs({ profileId: profile.id, items: chunks })
    }

    await prisma.entrepreneurProfile.update({
      where: { id: profile.id },
      data: { linkedinUrl, linkedinIngestedAt: new Date() },
    })

    this.logger.log(`LinkedIn ingestion terminée : ${chunks.length} chunks sauvegardés`)
    return { saved: chunks.length }
  }

  private extractCompanySlug(profileData: Record<string, unknown>): string | null {
    // Try to extract company slug from nested structures
    const experience = profileData.experience as Array<Record<string, unknown>> | undefined
    if (experience?.length) {
      const current = experience.find((e) => !e.end_date) ?? experience[0]
      const companyUrl = String((current?.company as Record<string, unknown>)?.url ?? current?.company_url ?? '')
      const match = companyUrl.match(/linkedin\.com\/company\/([^/?#]+)/)
      if (match?.[1]) return match[1]
    }
    return null
  }
}
