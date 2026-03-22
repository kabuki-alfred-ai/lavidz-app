import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const secret = (request.headers as unknown as Record<string, string>)['x-admin-secret']

    if (secret !== process.env.ADMIN_SECRET) {
      throw new UnauthorizedException('Invalid admin secret')
    }

    return true
  }
}
