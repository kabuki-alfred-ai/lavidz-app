import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as readline from 'readline'

const prisma = new PrismaClient()

// ─── Prompt helpers ────────────────────────────────────────────────────────

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()) })
  })
}

function askPassword(question: string): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(question)
    const stdin = process.stdin
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let password = ''
    const handler = (char: string) => {
      if (char === '\r' || char === '\n') {
        stdin.removeListener('data', handler)
        stdin.setRawMode(false)
        stdin.pause()
        process.stdout.write('\n')
        resolve(password)
      } else if (char === '\u0003') {
        process.stdout.write('\n')
        process.exit(0)
      } else if (char === '\u007F') {
        if (password.length > 0) { password = password.slice(0, -1); process.stdout.write('\b \b') }
      } else {
        password += char
        process.stdout.write('*')
      }
    }
    stdin.on('data', handler)
  })
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n  ╔════════════════════════════════╗')
  console.log('  ║  Créer un Superadmin Lavidz    ║')
  console.log('  ╚════════════════════════════════╝\n')

  const email = await ask('  Email          : ')
  if (!email || !email.includes('@')) {
    console.error('\n  ✗ Email invalide.\n')
    process.exit(1)
  }

  const name = await ask('  Nom (optionnel) : ')

  const password = await askPassword('  Mot de passe    : ')
  if (password.length < 8) {
    console.error('\n  ✗ Le mot de passe doit contenir au moins 8 caractères.\n')
    process.exit(1)
  }

  const confirm = await askPassword('  Confirmation    : ')
  if (password !== confirm) {
    console.error('\n  ✗ Les mots de passe ne correspondent pas.\n')
    process.exit(1)
  }

  console.log()

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.role === 'SUPERADMIN') {
      console.error(`  ✗ Un superadmin existe déjà avec cet email.\n`)
    } else {
      console.error(`  ✗ Un compte existe déjà avec cet email (rôle : ${existing.role}).\n`)
    }
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, passwordHash, name: name || null, role: 'SUPERADMIN', organizationId: null },
  })

  console.log(`  ✓ Superadmin créé : ${user.email}\n`)
}

main()
  .catch(err => { console.error('\n  ✗ Erreur :', err.message, '\n'); process.exit(1) })
  .finally(() => prisma.$disconnect())
