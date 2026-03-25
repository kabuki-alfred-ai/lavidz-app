import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

const SFX_DIR = process.env.SOUND_EFFECTS_DIR
  ?? path.join(process.cwd(), '..', '..', 'sound-effects')

function cleanName(filename: string): string {
  // Remove extension
  const base = filename.replace(/\.[^.]+$/, '')
  // Remove trailing timestamp (-13 digits)
  return base.replace(/-\d{13}$/, '').replace(/_/g, ' ')
}

export async function GET() {
  if (!fs.existsSync(SFX_DIR)) return Response.json([])

  const files = fs.readdirSync(SFX_DIR)
    .filter(f => /\.(wav|mp3|ogg|m4a)$/i.test(f))
    .map(filename => ({
      filename,
      name: cleanName(filename),
    }))

  return Response.json(files)
}
