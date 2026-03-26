import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common'
import { UsersService } from './users.service'
import { AdminGuard } from '../../guards/admin.guard'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('superadmins')
  @UseGuards(AdminGuard)
  listSuperadmins(): Promise<any[]> {
    return this.usersService.listSuperadmins()
  }

  @Get('invitations')
  @UseGuards(AdminGuard)
  listInvitations(): Promise<any[]> {
    return this.usersService.listInvitations()
  }

  @Post('invitations')
  @UseGuards(AdminGuard)
  createInvitation(
    @Body() body: { email: string; invitedById?: string },
    @Req() req: Request,
  ): Promise<any> {
    const origin = (req.headers as any)['x-forwarded-origin']
      ?? (req.headers as any)['origin']
      ?? 'http://localhost:3000'
    return this.usersService.createInvitation(body.email, body.invitedById ?? null, origin)
  }

  @Get('invitations/verify/:token')
  verifyToken(@Param('token') token: string): Promise<any> {
    return this.usersService.verifyToken(token)
  }

  @Post('invitations/:token/accept')
  acceptInvitation(
    @Param('token') token: string,
    @Body() body: { password: string; firstName?: string; lastName?: string },
  ): Promise<any> {
    return this.usersService.acceptInvitation(token, body.password, body.firstName, body.lastName)
  }
}
