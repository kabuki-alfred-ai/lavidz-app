import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common'
import { UsersService } from './users.service'
import { AdminGuard } from '../../guards/admin.guard'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('superadmins')
  @UseGuards(AdminGuard)
  listSuperadmins(): Promise<unknown[]> {
    return this.usersService.listSuperadmins()
  }

  @Get()
  @UseGuards(AdminGuard)
  listUsers(@Query('withoutOrg') withoutOrg?: string): Promise<unknown[]> {
    return this.usersService.listUsers(withoutOrg === 'true')
  }

  @Patch(':id/organization')
  @UseGuards(AdminGuard)
  updateUserOrganization(
    @Param('id') id: string,
    @Body() body: { organizationId: string | null },
  ): Promise<unknown> {
    return this.usersService.updateUserOrganization(id, body.organizationId)
  }

  @Get('invitations')
  @UseGuards(AdminGuard)
  listInvitations(): Promise<unknown[]> {
    return this.usersService.listInvitations()
  }

  @Post('invitations')
  @UseGuards(AdminGuard)
  createInvitation(
    @Body() body: { email: string; invitedById?: string },
    @Req() req: Request,
  ): Promise<unknown> {
    const origin = (req.headers as unknown as Record<string, string>)['x-forwarded-origin']
      ?? (req.headers as unknown as Record<string, string>)['origin']
      ?? 'http://localhost:3000'
    return this.usersService.createInvitation(body.email, body.invitedById ?? null, origin)
  }

  @Get('invitations/verify/:token')
  verifyToken(@Param('token') token: string): Promise<unknown> {
    return this.usersService.verifyToken(token)
  }

  @Post('invitations/:token/accept')
  acceptInvitation(
    @Param('token') token: string,
    @Body() body: { password: string; firstName?: string; lastName?: string; organizationName?: string },
  ): Promise<unknown> {
    return this.usersService.acceptInvitation(
      token,
      body.password,
      body.firstName,
      body.lastName,
      body.organizationName,
    )
  }

  @Post('org-invitations')
  @UseGuards(AdminGuard)
  createOrgInvitation(
    @Body() body: { email: string; organizationId: string; role: 'ADMIN' | 'USER'; invitedById?: string },
    @Req() req: Request,
  ): Promise<unknown> {
    const origin = (req.headers as unknown as Record<string, string>)['x-forwarded-origin']
      ?? (req.headers as unknown as Record<string, string>)['origin']
      ?? 'http://localhost:3000'
    return this.usersService.createOrgInvitation(
      body.email,
      body.organizationId,
      body.role,
      body.invitedById ?? null,
      origin,
    )
  }

  @Get('org-invitations/verify/:token')
  verifyOrgToken(@Param('token') token: string): Promise<unknown> {
    return this.usersService.verifyOrgToken(token)
  }

  @Get('org-invitations/by-org/:orgId')
  @UseGuards(AdminGuard)
  listOrgInvitations(@Param('orgId') orgId: string): Promise<unknown[]> {
    return this.usersService.listOrgInvitations(orgId)
  }

  @Post('org-invitations/:token/accept')
  acceptOrgInvitation(
    @Param('token') token: string,
    @Body() body: { password: string; firstName?: string; lastName?: string },
  ): Promise<unknown> {
    return this.usersService.acceptOrgInvitation(token, body.password, body.firstName, body.lastName)
  }
}
