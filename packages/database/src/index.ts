import { PrismaClient } from '@prisma/client'

const g = globalThis as unknown as { _prismaInstance?: PrismaClient }

function buildDatasourceUrl() {
  const url = process.env.DATABASE_URL ?? ''
  if (!url || url.includes('connection_limit=')) return url
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=25&pool_timeout=20`
}

function getInstance(): PrismaClient {
  if (!g._prismaInstance) {
    g._prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      datasources: { db: { url: buildDatasourceUrl() } },
    })
  }
  return g._prismaInstance
}

// Lazy proxy: PrismaClient is only instantiated on first use,
// ensuring DATABASE_URL is read after env vars are loaded
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    return (getInstance() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export { Prisma } from '@prisma/client'
export type {
  Theme,
  Question,
  Session,
  Recording,
  SessionStatus,
  RecordingStatus,
  User,
  Organization,
  UserRole,
  OrgStatus,
  AdminInvitation,
  OrgInvitation,
  InvitationStatus,
  EntrepreneurProfile,
  ConversationMemory,
  OwnerType,
  SoundAsset,
  SoundTag,
  Project,
  ProjectClip,
  ProjectStatus,
} from '@prisma/client'
