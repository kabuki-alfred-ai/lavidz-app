import fs from 'fs'
import path from 'path'

const TMP_TTL_MS = 2 * 60 * 60 * 1000 // 2 heures

/**
 * Supprime les anciens fichiers /tmp dont le nom commence par `prefix`.
 * À appeler au début d'un POST pour nettoyer les fichiers générés précédemment.
 */
export function purgeStaleTmpFiles(prefix: string, ttlMs = TMP_TTL_MS) {
  try {
    const now = Date.now()
    for (const file of fs.readdirSync('/tmp')) {
      if (!file.startsWith(prefix)) continue
      const filePath = path.join('/tmp', file)
      try {
        if (now - fs.statSync(filePath).mtimeMs > ttlMs) fs.unlinkSync(filePath)
      } catch {}
    }
  } catch {}
}

/**
 * Vérifie si un fichier /tmp est trop vieux. S'il l'est, le supprime et retourne true.
 */
export function isTmpFileExpired(filePath: string, ttlMs = TMP_TTL_MS): boolean {
  try {
    if (Date.now() - fs.statSync(filePath).mtimeMs > ttlMs) {
      try { fs.unlinkSync(filePath) } catch {}
      return true
    }
  } catch {}
  return false
}
