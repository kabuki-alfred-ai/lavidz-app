export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const orgId = (user.role === 'SUPERADMIN' && user.activeOrgId)
      ? user.activeOrgId
      : user.organizationId
    if (!orgId) return new Response('No organization', { status: 400 })

    const { topicId, format, title, questions, teleprompterScript, recordingScript } = await req.json()
    if (!format || !title) return new Response('Missing format or title', { status: 400 })

    const slug = `${title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Date.now()}`

    const questionData = format === 'TELEPROMPTER'
      ? [{ text: title, hint: "Suis le script affiché à l'écran", order: 0 }]
      : (questions ?? [{ text: title, hint: null }]).map(
          (q: { text: string; hint?: string | null }, i: number) => ({
            text: q.text,
            hint: q.hint ?? null,
            order: i,
          }),
        )

    const theme = await prisma.theme.create({
      data: {
        name: title,
        slug,
        organizationId: orgId,
        questions: { create: questionData },
      },
    })

    const session = await prisma.session.create({
      data: {
        themeId: theme.id,
        contentFormat: format as any,
        targetPlatforms: ['linkedin'],
        teleprompterScript: format === 'TELEPROMPTER' ? (teleprompterScript ?? null) : null,
        recordingScript: recordingScript ?? null,
        topicId: topicId ?? null,
      },
    })

    const baseUrl = process.env.WEB_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    return Response.json({
      id: session.id,
      shareLink: `${baseUrl}/s/${session.id}`,
      format,
      questionsCount: questionData.length,
    })
  } catch (err: any) {
    console.error('[POST /api/sessions]', err)
    return new Response(err.message ?? 'Internal error', { status: 500 })
  }
}
