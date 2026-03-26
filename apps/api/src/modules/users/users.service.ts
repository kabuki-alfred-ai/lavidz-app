import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { prisma } from '@lavidz/database'
import { Resend } from 'resend'
import * as crypto from 'crypto'
import * as bcrypt from 'bcryptjs'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

@Injectable()
export class UsersService {
  private readonly resend: Resend | null

  constructor() {
    this.resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  }

  async listSuperadmins(): Promise<unknown[]> {
    return prisma.user.findMany({
      where: { role: 'SUPERADMIN' },
      select: { id: true, email: true, firstName: true, lastName: true, organizationId: true, organization: { select: { name: true, slug: true } }, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  async listUsers(withoutOrg?: boolean): Promise<unknown[]> {
    const where = withoutOrg ? { organizationId: null } : {}
    return prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        organization: { select: { name: true, slug: true } },
        createdAt: true,
      },
    })
  }

  async updateUserOrganization(userId: string, organizationId: string | null): Promise<unknown> {
    const existing = await prisma.user.findUnique({ where: { id: userId } })
    if (!existing) throw new NotFoundException('Utilisateur introuvable')

    if (organizationId !== null) {
      const org = await prisma.organization.findUnique({ where: { id: organizationId } })
      if (!org) throw new NotFoundException('Organisation introuvable')
    }

    return prisma.user.update({
      where: { id: userId },
      data: { organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        organization: { select: { name: true, slug: true } },
        createdAt: true,
      },
    })
  }

  async listInvitations(): Promise<unknown[]> {
    return prisma.adminInvitation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        invitedBy: { select: { email: true, firstName: true, lastName: true } },
      },
    })
  }

  async createInvitation(email: string, invitedById: string | null, baseUrl: string): Promise<unknown> {
    const normalized = email.toLowerCase().trim()

    const existingUser = await prisma.user.findUnique({ where: { email: normalized } })
    if (existingUser) throw new ConflictException('Un compte existe déjà avec cet email')

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invitation = await prisma.adminInvitation.upsert({
      where: { email: normalized },
      create: { email: normalized, token, status: 'PENDING', invitedById, expiresAt },
      update: { token, status: 'PENDING', invitedById, expiresAt },
    })

    const registerUrl = `${baseUrl}/auth/register-superadmin?token=${invitation.token}`
    await this.sendInvitationEmail(normalized, registerUrl)

    return invitation
  }

  async verifyToken(token: string): Promise<unknown> {
    const invitation = await prisma.adminInvitation.findUnique({ where: { token } })
    if (!invitation) throw new NotFoundException('Invitation introuvable')
    if (invitation.status === 'ACCEPTED') throw new BadRequestException('Cette invitation a déjà été utilisée')
    if (invitation.expiresAt < new Date()) {
      await prisma.adminInvitation.update({ where: { token }, data: { status: 'EXPIRED' } })
      throw new BadRequestException('Cette invitation a expiré')
    }
    return { email: invitation.email, token: invitation.token }
  }

  async acceptInvitation(
    token: string,
    password: string,
    firstName?: string,
    lastName?: string,
    organizationName?: string,
  ): Promise<unknown> {
    const invitation = await prisma.adminInvitation.findUnique({ where: { token } })
    if (!invitation) throw new NotFoundException('Invitation introuvable')
    if (invitation.status === 'ACCEPTED') throw new BadRequestException('Invitation déjà utilisée')
    if (invitation.expiresAt < new Date()) throw new BadRequestException('Invitation expirée')

    const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } })
    if (existingUser) throw new ConflictException('Un compte existe déjà avec cet email')

    if (password.length < 8) throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères')

    const passwordHash = await bcrypt.hash(password, 12)

    let organizationId: string | null = null

    if (organizationName && organizationName.trim()) {
      const trimmedName = organizationName.trim()
      const slug = slugify(trimmedName)

      const existingOrg = await prisma.organization.findFirst({
        where: { name: { equals: trimmedName, mode: 'insensitive' } },
      })

      if (existingOrg) {
        organizationId = existingOrg.id
      } else {
        // ensure slug uniqueness
        const baseSlug = slug
        let finalSlug = baseSlug
        let counter = 1
        while (await prisma.organization.findUnique({ where: { slug: finalSlug } })) {
          finalSlug = `${baseSlug}-${counter}`
          counter++
        }

        const org = await prisma.organization.create({
          data: { name: trimmedName, slug: finalSlug, status: 'ACTIVE' },
        })
        organizationId = org.id
      }
    }

    const user = await prisma.user.create({
      data: {
        email: invitation.email,
        passwordHash,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        role: 'SUPERADMIN',
        organizationId,
      },
    })

    await prisma.adminInvitation.update({
      where: { token },
      data: { status: 'ACCEPTED' },
    })

    return { ok: true, userId: user.id }
  }

  private async sendInvitationEmail(to: string, registerUrl: string): Promise<void> {
    if (!this.resend) return

    const logoHtml = `
      <div style="display: inline-flex; align-items: center; gap: 10px;">
        <div style="position: relative; width: 14px; height: 14px; flex-shrink: 0;">
          <span style="display: block; width: 12px; height: 12px; background: hsl(14, 100%, 55%);"></span>
          <span style="display: block; position: absolute; top: -2px; right: -2px; width: 6px; height: 6px; background: rgba(255, 107, 46, 0.4);"></span>
        </div>
        <span style="font-family: sans-serif; font-weight: 900; font-size: 15px; letter-spacing: 0.1em; color: #fff;">LAVIDZ</span>
      </div>
    `

    await this.resend.emails.send({
      from: process.env.EMAIL_FROM ?? process.env.RESEND_FROM ?? 'Lavidz <noreply@lavidz.fr>',
      to,
      subject: 'Invitation Superadmin — Lavidz',
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #0a0a0a; color: #fff;">
          <div style="margin-bottom: 32px;">${logoHtml}</div>

          <h1 style="font-size: 22px; font-weight: 900; margin: 0 0 12px; letter-spacing: -0.02em;">Vous êtes invité(e) comme Superadmin</h1>
          <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0 0 32px; line-height: 1.6;">
            Cliquez sur le bouton ci-dessous pour créer votre compte superadmin Lavidz. Ce lien est valable 7 jours et ne peut être utilisé qu'une seule fois.
          </p>

          <a href="${registerUrl}" style="display: inline-block; background: hsl(14, 100%, 55%); color: #fff; font-weight: 700; font-size: 14px; padding: 14px 28px; text-decoration: none; letter-spacing: 0.02em;">
            Créer mon compte →
          </a>

          <p style="color: rgba(255,255,255,0.2); font-size: 11px; margin: 32px 0 0; font-family: monospace;">
            Si vous n'attendiez pas cet email, ignorez-le.<br/>
            Lien : ${registerUrl}
          </p>
        </div>
      `,
    })
  }
}
