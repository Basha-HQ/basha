import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-compatible auth config — no Node.js modules (no pg, no bcrypt).
 * Used ONLY in middleware for JWT session checking.
 * Full config with DB + bcrypt lives in lib/auth/config.ts (Node.js only).
 *
 * The session callback here mirrors the one in config.ts but without DB calls —
 * it maps custom JWT claims to session.user so middleware can read them.
 */
export const authEdgeConfig = {
  providers: [],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' as const },
  callbacks: {
    session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.planType = token.planType as string;
        session.user.onboardingCompleted = token.onboardingCompleted as boolean;
        session.user.googleCalendarConnected = token.googleCalendarConnected as boolean;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
