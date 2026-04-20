import { spawnSync } from 'child_process'

const FFMPEG_CANDIDATES = [
  process.env.FFMPEG_PATH,
  '/opt/homebrew/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/usr/bin/ffmpeg',
  'ffmpeg',
].filter(Boolean) as string[]

let cachedFfmpeg: string | null | undefined

export function findFfmpeg(): string | null {
  if (cachedFfmpeg !== undefined) return cachedFfmpeg
  for (const candidate of FFMPEG_CANDIDATES) {
    try {
      const result = spawnSync(candidate, ['-version'], { timeout: 3000 })
      if (result.status === 0) {
        cachedFfmpeg = candidate
        return candidate
      }
    } catch {}
  }
  cachedFfmpeg = null
  return null
}

// Remux (no re-encode) to put moov atom at the start of an MP4. Fast — seconds
// for hundreds of MB. Required for browsers (and Remotion's Chromium) to seek
// without downloading the whole file. Returns true on success.
export function remuxToFaststart(inputPath: string, outputPath: string, timeoutMs = 60_000): boolean {
  const ffmpeg = findFfmpeg()
  if (!ffmpeg) return false
  const result = spawnSync(ffmpeg, [
    '-y',
    '-i', inputPath,
    '-c', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ], { timeout: timeoutMs })
  if (result.status !== 0) {
    console.error('[ffmpeg] faststart remux failed:', result.stderr?.toString?.() ?? result.error)
    return false
  }
  return true
}
