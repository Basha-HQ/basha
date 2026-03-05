import NextAuth from 'next-auth';
import { authEdgeConfig } from '@/lib/auth/edge-config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authEdgeConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isLoggedIn = !!req.auth;
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/meetings') ||
    pathname.startsWith('/new-meeting');

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isLoggedIn && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|uploads).*)'],
};
