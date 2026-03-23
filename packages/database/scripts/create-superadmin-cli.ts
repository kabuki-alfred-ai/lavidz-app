import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 ? process.argv[idx + 1] : undefined
}

async function main() {
  const email = arg('--email')
  const password = arg('--password')
  const name = arg('--name')

  if (!email || !email.includes('@')) {
    console.error('Usage: ts-node scripts/create-superadmin-cli.ts --email <email> --password <password> [--name <name>]')
    console.error('Error: --email is required and must be valid.')
    process.exit(1)
  }
  if (!password || password.length < 8) {
    console.error('Error: --password is required and must be at least 8 characters.')
    process.exit(1)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.error(`Error: A user already exists with this email (role: ${existing.role}).`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, passwordHash, name: name ?? null, role: 'SUPERADMIN', organizationId: null },
  })

  console.log(`Superadmin created: ${user.email}`)
}

main()
  .catch(err => { console.error('Error:', err.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
