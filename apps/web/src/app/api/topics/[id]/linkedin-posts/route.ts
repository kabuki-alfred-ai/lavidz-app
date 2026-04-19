export const runtime = 'nodejs'
export const maxDuration = 45

import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'

const LinkedInPostsSchema = z.object({
  posts: z.array(
    z.object({
      variant: z.enum(['SHORT', 'LONG', 'STORY']).describe('Type de post : SHORT (1-3 lignes, punchy), LONG (6-15 lignes, valeur), STORY (storytelling avec un hook + anecdote + insight)'),
      content: z.string().describe('Texte complet du post LinkedIn, prêt à publier, avec sauts de ligne (\\n), émojis si pertinent, et hashtags à la fin'),
    }),
  ).length(3).describe('3 variantes différentes : 1 SHORT, 1 LONG, 1 STORY'),
})

// ---- GET: list existing posts for this topic ----
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user?.organizationId) return new Response('Unauthorized', { status: 401 })
    const { id } = await params

    const topic = await prisma.topic.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { id: true },
    })
    if (!topic) return new Response('Topic introuvable', { status: 404 })

    const posts = await prisma.generatedPost.findMany({
      where: { topicId: id, organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    })
    return Response.json(posts)
  } catch (err) {
    console.error('[linkedin-posts GET topic]', err)
    return new Response(String(err), { status: 500 })
  }
}

// ---- POST: generate 3 new post variants and persist them ----
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user?.organizationId) return new Response('Unauthorized', { status: 401 })
    const { id } = await params

    const topic = await prisma.topic.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { id: true, name: true, brief: true, pillar: true, status: true },
    })
    if (!topic) return new Response('Topic introuvable', { status: 404 })
    if (topic.status !== 'READY') {
      return new Response(
        topic.status === 'ARCHIVED'
          ? 'Sujet archivé — génération impossible.'
          : 'Ce sujet n\'est pas encore prêt. Marque-le comme « Prêt » pour générer des posts.',
        { status: 409 },
      )
    }

    const prompt = `Tu es un expert LinkedIn pour entrepreneurs/creators. Tu écris des posts qui génèrent de l'engagement et du thought leadership.

TON SUJET :
Nom : ${topic.name}
${topic.pillar ? `Pilier éditorial : ${topic.pillar}\n` : ''}${topic.brief ? `Brief :\n${topic.brief}` : 'Pas de brief détaillé — utilise uniquement le nom du sujet.'}

Génère EXACTEMENT 3 variantes de post LinkedIn, prêts à publier :

1. **SHORT** (1-3 lignes) : une punchline qui stoppe le scroll. Direct, opinion forte, provocateur si besoin.
2. **LONG** (6-15 lignes) : un post de valeur qui développe 2-3 points clés, avec ouverture punchy, corps structuré (listes/bullets si adapté), et une question/CTA en fin.
3. **STORY** (storytelling) : un post narratif qui commence par un hook émotionnel ("Il y a 6 mois j'ai…") et développe une histoire avec un insight/leçon à la fin.

RÈGLES ABSOLUES :
- Français naturel, ton humain (pas de "bonjour à tous" générique)
- Première ligne = HOOK qui arrête le scroll (fait aveu, chiffre choc, contradiction, question)
- Sauts de ligne (\\n) pour aérer — LinkedIn c'est 3 lignes avant "voir plus", soigne-les
- Émojis avec parcimonie (max 3 par post, stratégiques, jamais décoratifs)
- 2-4 hashtags à la fin, pertinents (#leadership, #b2b, #entrepreneuriat etc.)
- Évite le corporate-speak ("synergies", "leverage", "alignement stratégique")
- Ne mens pas, ne cite pas de chiffres inventés
- Chaque variante doit avoir un ANGLE différent`

    const model = google(process.env.AI_MODEL ?? 'gemini-3.1-flash-lite-preview')
    const { object } = await generateObject({
      model,
      schema: LinkedInPostsSchema,
      prompt,
    })

    // Persist all 3 variants
    const created = await prisma.$transaction(
      object.posts.map((p) =>
        prisma.generatedPost.create({
          data: {
            organizationId: user.organizationId!,
            platform: 'LINKEDIN',
            variant: p.variant,
            content: p.content,
            status: 'DRAFT',
            topicId: id,
          },
        }),
      ),
    )

    return Response.json(created)
  } catch (err: any) {
    console.error('[linkedin-posts POST topic]', err)
    return new Response(`Gemini erreur : ${err?.message ?? 'inconnue'}`, { status: 500 })
  }
}

// ---- DELETE: remove all posts for this topic (or a specific postId via ?postId=…) ----
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user?.organizationId) return new Response('Unauthorized', { status: 401 })
    const { id } = await params
    const url = new URL(req.url)
    const postId = url.searchParams.get('postId')

    if (postId) {
      await prisma.generatedPost.deleteMany({
        where: { id: postId, topicId: id, organizationId: user.organizationId },
      })
    } else {
      await prisma.generatedPost.deleteMany({
        where: { topicId: id, organizationId: user.organizationId },
      })
    }
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[linkedin-posts DELETE topic]', err)
    return new Response(String(err), { status: 500 })
  }
}
