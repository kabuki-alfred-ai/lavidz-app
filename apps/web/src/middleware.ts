import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/admin')) return NextResponse.next()

  const cookie = request.cookies.get('admin_auth')?.value
  if (cookie === process.env.ADMIN_SECRET) return NextResponse.next()

  // Allow login page itself
  if (pathname === '/admin/login') return NextResponse.next()

  const loginUrl = new URL('/admin/login', request.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*'],
}
