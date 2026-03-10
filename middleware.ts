import NextAuth from 'next-auth';
import { authEdgeConfig } from '@/lib/auth/edge-config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authEdgeConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isLoggedIn = !!req.auth;
  const onboardingCompleted = (req.auth?.user as Record<string, unknown>)
    ?.onboardingCompleted as boolean | undefined;

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/meetings') ||
    pathname.startsWith('/new-meeting') ||
    pathname.startsWith('/onboarding');

  // Unauthenticated → login
  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Logged-in on auth pages → onboarding or dashboard
  if (isLoggedIn && (pathname === '/login' || pathname === '/signup')) {
    if (onboardingCompleted === false) {
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Already onboarded, trying to re-visit /onboarding → dashboard
  if (isLoggedIn && pathname.startsWith('/onboarding') && onboardingCompleted === true) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Logged-in, not yet onboarded, trying to reach app pages → onboarding
  if (
    isLoggedIn &&
    onboardingCompleted === false &&
    (pathname.startsWith('/dashboard') ||
      pathname.startsWith('/meetings') ||
      pathname.startsWith('/new-meeting'))
  ) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|uploads).*)'],
};
