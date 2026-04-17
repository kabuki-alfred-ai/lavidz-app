export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const orgId = (user.role === 'SUPERADMIN' && user.activeOrgId)
      ? user.activeOrgId
      : user.organizationId
    if (!orgId) return new Response('No organization', { status: 400 })

    const { topic, format = 'QUESTION_BOX', platform = 'linkedin' } = await req.json()
    if (!topic) return new Response('Missing topic', { status: 400 })

    // 1. Generate questions via the backend AI
    const genRes = await fetch(`${API}/api/ai/generate-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET,
        'x-organization-id': orgId,
      },
      body: JSON.stringify({
        organizationId: orgId,
        goal: topic,
        format,
        platform,
      }),
    })

    let questions: { text: string; hint?: string }[] = []
    let teleprompterScript: string | null = null

    if (genRes.ok) {
      const genData = await genRes.json()
      if (genData.questions && Array.isArray(genData.questions)) {
        questions = genData.questions
      }
      if (format === 'TELEPROMPTER' && genData.teleprompterScript) {
        teleprompterScript = genData.teleprompterScript
      }
    }

    // Fallback if generation failed — use topic as single question
    if (questions.length === 0) {
      questions = [{ text: topic, hint: 'Parle naturellement de ce sujet' }]
    }

    // 2. Create slug
    const slug = `${topic
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Date.now()}`

    // 3. Create theme with questions
    const questionData = questions.map((q, i) => ({
      text: q.text,
      hint: q.hint ?? null,
      order: i,
    }))

    const theme = await prisma.theme.create({
      data: {
        name: topic,
        slug,
        organizationId: orgId,
        questions: { create: questionData },
      },
    })

    // 4. Create session
    const session = await prisma.session.create({
      data: {
        themeId: theme.id,
        contentFormat: format as any,
        targetPlatforms: [platform],
        teleprompterScript,
      },
    })

    const baseUrl = process.env.WEB_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const shareLink = `${baseUrl}/s/${session.id}`

    return Response.json({
      sessionId: session.id,
      shareLink,
      title: topic,
      format,
      questionsCount: questionData.length,
    })
  } catch (err: any) {
    console.error('Quick session error:', err)
    return new Response(err.message ?? 'Internal error', { status: 500 })
  }
}
