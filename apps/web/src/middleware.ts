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

// Public routes — no auth needed
const PUBLIC_PREFIXES = ['/auth', '/s/', '/session/', '/process/', '/video/', '/api/auth/', '/api/sessions/', '/api/feedbacks']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Client routes (USER panel) — /home, /chat, /calendar, /videos, /profile
  const clientRoutes = ['/home', '/chat', '/calendar', '/videos', '/brand-kit', '/profile']
  const isClientRoute = clientRoutes.some(r => pathname === r || pathname.startsWith(r + '/'))

  if (isClientRoute) {
    const user = await getUser(request)
    if (!user) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const res = NextResponse.next()
    res.headers.set('x-user-id', user.userId)
    res.headers.set('x-user-role', user.role)
    res.headers.set('x-user-email', user.email)
    const effectiveOrgId = user.role === 'SUPERADMIN' && user.activeOrgId
      ? user.activeOrgId
      : user.organizationId
    if (effectiveOrgId) res.headers.set('x-org-id', effectiveOrgId)
    return res
  }

  // Admin routes
  if (pathname.startsWith('/admin')) {
    const user = await getUser(request)

    if (!user) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // USER role: redirect to client panel
    if (user.role === 'USER') {
      return NextResponse.redirect(new URL('/home', request.url))
    }

    // ADMIN role: redirect from admin root and superadmin-only pages to /chat
    if (user.role === 'ADMIN') {
      const superadminPaths = ['/admin/organizations', '/admin/users', '/admin/team']
      if (pathname === '/admin' || superadminPaths.some(p => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/home', request.url))
      }
    }

    // Superadmin-only paths (fallback)
    const superadminPaths = ['/admin/organizations', '/admin/users']
    if (superadminPaths.some(p => pathname.startsWith(p)) && user.role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/home', request.url))
    }

    const res = NextResponse.next()
    res.headers.set('x-user-id', user.userId)
    res.headers.set('x-user-role', user.role)
    res.headers.set('x-user-email', user.email)
    const effectiveOrgId = user.role === 'SUPERADMIN' && user.activeOrgId
      ? user.activeOrgId
      : user.organizationId
    if (effectiveOrgId) res.headers.set('x-org-id', effectiveOrgId)
    if (user.role === 'SUPERADMIN' && user.activeOrgId) {
      res.headers.set('x-active-org-id', user.activeOrgId)
    }
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/admin/recordings).*)'],
}
