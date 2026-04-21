import { generateObject as baseGenerateObject } from 'ai'

// Certains LLM (Gemini notamment) produisent du JSON avec des escapes non-standard
// comme `\'` ou `\"` à l'intérieur des chaînes. Les parseurs laxistes laissent
// passer ces caractères au lieu d'erreurer, si bien que les backslashes se
// retrouvent affichés tels quels dans l'UI.
export function normalizeLLMStrings<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(/\\'/g, "'").replace(/\\"/g, '"') as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeLLMStrings(item)) as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = normalizeLLMStrings(v)
    }
    return out as T
  }
  return value
}

// Drop-in remplaçant de `generateObject` qui nettoie automatiquement les
// apostrophes/guillemets échappés dans l'objet retourné.
export const generateObject: typeof baseGenerateObject = (async (options: Parameters<typeof baseGenerateObject>[0]) => {
  const result = await baseGenerateObject(options)
  return { ...result, object: normalizeLLMStrings(result.object) }
}) as typeof baseGenerateObject
