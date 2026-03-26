import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
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
