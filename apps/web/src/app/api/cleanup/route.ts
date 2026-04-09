import { purgeStaleTmpFiles } from '@/lib/tmp-cleanup'

export const runtime = 'nodejs'

const PREFIXES = [
  'silence-cut-', 'sc-input-',
  'filler-cut-',
  'norm-',
  'dn-', 'denoise-',
  'render-', 'tts-render-',
  'sfx-',
  'cleanvoice-',
  'tr-in-', 'tr-out-',
]

// Called by a cron (e.g. every 30min) to purge stale /tmp files across all routes.
// Protected by ADMIN_SECRET to avoid abuse.
export async function GET(req: Request) {
  const secret = req.headers.get('x-admin-secret') ?? new URL(req.url).searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  for (const prefix of PREFIXES) purgeStaleTmpFiles(prefix)

  return Response.json({ ok: true, cleaned: PREFIXES })
}
