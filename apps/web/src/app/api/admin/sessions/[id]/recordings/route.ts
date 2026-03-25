export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    // Fetch session with recordings from NestJS API
    const sessionRes = await fetch(`${API}/api/sessions/${id}`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
    })
    if (!sessionRes.ok) return new Response(await sessionRes.text(), { status: sessionRes.status })
    const session = await sessionRes.json()

    const recordings: { id: string; questionText: string; questionOrder: number; signedUrl: string }[] = []

    for (const recording of session.recordings ?? []) {
      if (!recording.rawVideoKey) continue

      const urlRes = await fetch(
        `${API}/api/sessions/${id}/recordings/${recording.id}/url`,
        { headers: { 'x-admin-secret': ADMIN_SECRET } },
      )
      if (!urlRes.ok) continue
      const signedUrl = await urlRes.text()

      const question = session.theme?.questions?.find((q: any) => q.id === recording.questionId)
      recordings.push({
        id: recording.id,
        questionText: question?.text ?? `Question ${recordings.length + 1}`,
        questionOrder: question?.order ?? recordings.length,
        signedUrl: signedUrl.replace(/^"|"$/g, ''), // strip surrounding quotes if JSON string
      })
    }

    recordings.sort((a, b) => a.questionOrder - b.questionOrder)

    return Response.json(recordings)
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
