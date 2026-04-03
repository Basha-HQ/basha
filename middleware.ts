import NextAuth from 'next-auth';
import { authEdgeConfig } from '@/lib/auth/edge-config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authEdgeConfig);

function addSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return response;
}

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
    return addSecurityHeaders(NextResponse.redirect(new URL('/login', req.url)));
  }

  // Logged-in on auth pages → onboarding or dashboard
  if (isLoggedIn && (pathname === '/login' || pathname === '/signup')) {
    if (onboardingCompleted === false) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/onboarding', req.url)));
    }
    return addSecurityHeaders(NextResponse.redirect(new URL('/dashboard', req.url)));
  }

  // Already onboarded, trying to re-visit /onboarding → dashboard
  if (isLoggedIn && pathname.startsWith('/onboarding') && onboardingCompleted === true) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/dashboard', req.url)));
  }

  // Logged-in, not yet onboarded, trying to reach app pages → onboarding
  if (
    isLoggedIn &&
    onboardingCompleted === false &&
    (pathname.startsWith('/dashboard') ||
      pathname.startsWith('/meetings') ||
      pathname.startsWith('/new-meeting'))
  ) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/onboarding', req.url)));
  }

  return addSecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|uploads).*)'],
};
