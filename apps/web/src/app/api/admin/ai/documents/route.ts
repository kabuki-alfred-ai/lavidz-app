export const runtime = 'nodejs'

import { getFreshUser } from '@/lib/get-fresh-user'
const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function POST(req: Request) {
  const user = await getFreshUser()
  if (!user || user.role !== 'SUPERADMIN') {
    return new Response('Unauthorized', { status: 401 })
  }
  if (!user.organizationId) {
    return new Response('Organization manquante', { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return new Response('Fichier manquant', { status: 400 })

  const filename = file.name
  const mimeType = file.type
  const buffer = Buffer.from(await file.arrayBuffer())

  let content = ''
  try {
    if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse')
      const parsed = await pdfParse(buffer)
      content = parsed.text
    } else {
      // text/plain, .md, .txt, etc.
      content = buffer.toString('utf-8')
    }
  } catch {
    return new Response('Impossible de lire le fichier', { status: 422 })
  }

  if (!content.trim()) {
    return new Response('Document vide', { status: 422 })
  }

  const res = await fetch(`${API}/api/ai/ingest-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': ADMIN_SECRET,
      'x-organization-id': user.organizationId,
    },
    body: JSON.stringify({ content, filename }),
  })

  if (!res.ok) return new Response(await res.text(), { status: res.status })
  return Response.json(await res.json())
}
