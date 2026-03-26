import { google } from '@ai-sdk/google'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import type { LanguageModel, EmbeddingModel } from 'ai'

export const AI_LANGUAGE_MODELS: Record<string, LanguageModel> = {
  'gemini-flash':  google('gemini-2.0-flash'),
  'gemini-pro':    google('gemini-2.5-pro'),
  'claude-sonnet': anthropic('claude-sonnet-4-6'),
  'claude-haiku':  anthropic('claude-haiku-4-5-20251001'),
  'claude-opus':   anthropic('claude-opus-4-6'),
  'gpt-4o':        openai('gpt-4o'),
  'gpt-4o-mini':   openai('gpt-4o-mini'),
}

export const EMBED_MODEL_ID = 'gemini-embedding-2-preview'
export const EMBED_DIMENSIONS = 768

export const AI_EMBED_MODELS: Record<string, EmbeddingModel> = {
  'embed-gemini': google.textEmbeddingModel(EMBED_MODEL_ID),
  'embed-openai': openai.embedding('text-embedding-3-small'), // kept as fallback
}

export const AI_MODELS: Record<string, LanguageModel | EmbeddingModel> = {
  ...AI_LANGUAGE_MODELS,
  ...AI_EMBED_MODELS,
}

export function getDefaultModel(): LanguageModel {
  const key = process.env.AI_MODEL ?? 'gemini-flash'
  if (AI_LANGUAGE_MODELS[key]) return AI_LANGUAGE_MODELS[key]
  return google(key)
}

export function getEmbedModel(): EmbeddingModel {
  return AI_EMBED_MODELS['embed-gemini']
}
