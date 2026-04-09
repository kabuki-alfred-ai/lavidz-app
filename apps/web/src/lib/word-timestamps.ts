export type WordTimestamp = { word: string; start: number; end: number }

/**
 * Merges elided tokens split at an apostrophe by ASR models.
 * e.g. ["j'", "étais"] → ["j'étais"]
 * Also handles leading-apostrophe tokens: ["c'", "est"] → ["c'est"]
 */
export function mergeElidedWords(words: WordTimestamp[]): WordTimestamp[] {
  const result: WordTimestamp[] = []
  let i = 0
  while (i < words.length) {
    const w = words[i]
    if (w.word.endsWith("'") && i + 1 < words.length) {
      result.push({ word: w.word + words[i + 1].word, start: w.start, end: words[i + 1].end })
      i += 2
    } else {
      result.push(w)
      i++
    }
  }
  return result
}
