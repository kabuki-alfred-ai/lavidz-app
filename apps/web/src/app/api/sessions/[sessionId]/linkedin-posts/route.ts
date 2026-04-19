export const runtime = 'nodejs'
export const maxDuration = 45

import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'

const SessionLinkedInPostsSchema = z.object({
  posts: z.array(
    z.object({
      variant: z.enum(['SHORT', 'LONG', 'STORY']),
      content: z.string().describe('Post LinkedIn prêt à publier, avec sauts de ligne, émojis pertinents, hashtags en fin'),
    }),
  ).length(3),
})

// ---- GET ----
export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user?.organizationId) return new Response('Unauthorized', { status: 401 })
    const { sessionId: id } = await params

    // Verify org access via the session's theme
    const session = await prisma.session.findFirst({
      where: {
        id,
        theme: { organizationId: user.organizationId },
      },
      select: { id: true },
    })
    if (!session) return new Response('Session introuvable', { status: 404 })

    const posts = await prisma.generatedPost.findMany({
      where: { sessionId: id, organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    })
    return Response.json(posts)
  } catch (err) {
    console.error('[linkedin-posts GET session]', err)
    return new Response(String(err), { status: 500 })
  }
}

// ---- POST: generate from the recorded transcript ----
export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user?.organizationId) return new Response('Unauthorized', { status: 401 })
    const { sessionId: id } = await params

    const session = await prisma.session.findFirst({
      where: {
        id,
        theme: { organizationId: user.organizationId },
      },
      include: {
        theme: { select: { name: true } },
        topicEntity: { select: { name: true, brief: true, pillar: true } },
        recordings: {
          orderBy: { createdAt: 'asc' },
          select: { transcript: true, question: { select: { text: true } } },
        },
      },
    })
    if (!session) return new Response('Session introuvable', { status: 404 })

    // Aggregate full transcript from recordings
    const aggregated = session.recordings
      .map((r) => r.transcript)
      .filter((t): t is string => !!t && t.length > 0)
      .join('\n\n')

    if (aggregated.length < 60) {
      return new Response('Transcription insuffisante pour générer des posts', { status: 400 })
    }

    const topicName = session.topicEntity?.name ?? session.theme?.name ?? 'Vidéo'
    const topicBrief = session.topicEntity?.brief ?? null

    const prompt = `Tu es un expert LinkedIn. Je viens d'enregistrer une vidéo courte. Tu dois transformer ce contenu en posts LinkedIn qui donnent envie de REGARDER la vidéo OU qui se suffisent à eux-mêmes.

CONTEXTE :
Sujet : ${topicName}
${session.topicEntity?.pillar ? `Pilier : ${session.topicEntity.pillar}\n` : ''}${topicBrief ? `Brief du sujet :\n${topicBrief}\n\n` : ''}

TRANSCRIPTION DE MA VIDÉO :
${aggregated.slice(0, 6000)}

Génère EXACTEMENT 3 variantes :

1. **SHORT** (1-3 lignes) : cite une PHRASE FORTE de ma transcription (quote entre guillemets ok) + teaser "vidéo 👇"
2. **LONG** (6-15 lignes) : reprends les 2-3 idées principales de la vidéo, développe-les en texte + CTA "voir la vidéo complète"
3. **STORY** (storytelling) : raconte l'insight principal comme une histoire (anecdote implicite), termine sur une leçon qui matche le contenu

RÈGLES ABSOLUES :
- Français naturel, ton humain, conserve le VOCABULAIRE que j'ai utilisé dans la transcription
- Première ligne = HOOK (max 1 ligne, arrête le scroll)
- Si la vidéo contient une phrase puissante (quote-worthy), REPREND-LA MOT POUR MOT entre guillemets au moins une fois
- Ne déforme pas mon propos, ne rajoute pas d'affirmations non présentes
- Sauts de ligne (\\n), émojis parcimonieux (max 3), 2-4 hashtags à la fin`

    const model = google(process.env.AI_MODEL ?? 'gemini-3.1-flash-lite-preview')
    const { object } = await generateObject({
      model,
      schema: SessionLinkedInPostsSchema,
      prompt,
    })

    const created = await prisma.$transaction(
      object.posts.map((p) =>
        prisma.generatedPost.create({
          data: {
            organizationId: user.organizationId!,
            platform: 'LINKEDIN',
            variant: p.variant,
            content: p.content,
            status: 'DRAFT',
            sessionId: id,
          },
        }),
      ),
    )

    return Response.json(created)
  } catch (err: any) {
    console.error('[linkedin-posts POST session]', err)
    return new Response(`Gemini erreur : ${err?.message ?? 'inconnue'}`, { status: 500 })
  }
}

// ---- DELETE ----
export async function DELETE(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user?.organizationId) return new Response('Unauthorized', { status: 401 })
    const { sessionId: id } = await params
    const url = new URL(req.url)
    const postId = url.searchParams.get('postId')

    if (postId) {
      await prisma.generatedPost.deleteMany({
        where: { id: postId, sessionId: id, organizationId: user.organizationId },
      })
    } else {
      await prisma.generatedPost.deleteMany({
        where: { sessionId: id, organizationId: user.organizationId },
      })
    }
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[linkedin-posts DELETE session]', err)
    return new Response(String(err), { status: 500 })
  }
}
