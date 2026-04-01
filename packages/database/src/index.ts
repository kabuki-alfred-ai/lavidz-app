import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function buildDatasourceUrl() {
  const url = process.env.DATABASE_URL ?? ''
  if (!url || url.includes('connection_limit=')) return url
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=25&pool_timeout=20`
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: { db: { url: buildDatasourceUrl() } },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

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
  InvitationStatus,
  EntrepreneurProfile,
  ConversationMemory,
  OwnerType,
  SoundAsset,
  SoundTag,
} from '@prisma/client'
