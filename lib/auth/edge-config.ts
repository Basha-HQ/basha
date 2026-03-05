import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-compatible auth config — no Node.js modules (no pg, no bcrypt).
 * Used ONLY in middleware for JWT session checking.
 * Full config with DB + bcrypt lives in lib/auth/config.ts (Node.js only).
 */
export const authEdgeConfig = {
  providers: [],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' as const },
} satisfies NextAuthConfig;
