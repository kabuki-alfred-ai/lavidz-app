import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import type { SessionPayload } from '@/lib/auth'

const COOKIE_NAME = 'lavidz_session'

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? ''
  return new TextEncoder().encode(secret)
}

async function getUser(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes — no auth needed
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/s/') ||
    pathname.startsWith('/session/') ||
    pathname.startsWith('/process/') ||
    pathname.startsWith('/video/') ||
    pathname.startsWith('/api/auth/')
  ) {
    return NextResponse.next()
  }

  // /admin/* requires authentication
  if (pathname.startsWith('/admin')) {
    const user = await getUser(request)

    if (!user) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Superadmin-only paths
    const superadminPaths = ['/admin/organizations', '/admin/users']
    if (superadminPaths.some(p => pathname.startsWith(p)) && user.role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }

    // USER role: only allowed on /admin/ai-profile (and its API calls)
    if (user.role === 'USER' && !pathname.startsWith('/admin/ai-profile') && !pathname.startsWith('/api/admin/ai/')) {
      return NextResponse.redirect(new URL('/admin/ai-profile', request.url))
    }

    // Must be ADMIN, USER or SUPERADMIN (USER restricted above to ai-profile only)
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && user.role !== 'USER') {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    const res = NextResponse.next()
    res.headers.set('x-user-id', user.userId)
    res.headers.set('x-user-role', user.role)
    res.headers.set('x-user-email', user.email)
    if (user.organizationId) res.headers.set('x-org-id', user.organizationId)
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
