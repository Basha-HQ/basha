import NextAuth, { type NextAuthConfig } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { queryOne } from '@/lib/db';

interface DbUser {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  plan_type: string;
  onboarding_completed: boolean;
  google_calendar_connected: boolean;
}

export const authConfig: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await queryOne<DbUser>(
          'SELECT * FROM users WHERE email = $1',
          [credentials.email]
        );

        if (!user || !user.password_hash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        );
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // For Google sign-in, upsert user in our DB
      if (account?.provider === 'google' && user.email) {
        // Critical: ensure user exists in DB — block sign-in if this fails
        try {
          const existing = await queryOne<DbUser>(
            'SELECT id FROM users WHERE email = $1',
            [user.email]
          );
          if (!existing) {
            await queryOne(
              'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
              [user.email, user.name]
            );
          }
        } catch (err) {
          console.error('[Auth] signIn DB error (user upsert):', err);
          return false;
        }

        // Non-critical: store Google OAuth tokens for Calendar access
        if (account.access_token) {
          try {
            const expiry = account.expires_at
              ? new Date(account.expires_at * 1000).toISOString()
              : new Date(Date.now() + 3600 * 1000).toISOString();
            await queryOne(
              `UPDATE users SET
                 google_access_token = $1,
                 google_refresh_token = COALESCE($2, google_refresh_token),
                 google_token_expiry = $3,
                 google_calendar_connected = true
               WHERE email = $4`,
              [account.access_token, account.refresh_token ?? null, expiry, user.email]
            );
          } catch (err) {
            console.error('[Auth] signIn DB error (calendar token store):', err);
            // do not return false — user can still sign in without Calendar
          }
        }
      }
      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user || trigger === 'update') {
        const dbUser = await queryOne<DbUser>(
          'SELECT id, plan_type, onboarding_completed, google_calendar_connected FROM users WHERE email = $1',
          [user?.email ?? token.email]
        );
        if (dbUser) {
          token.userId = dbUser.id;
          token.planType = dbUser.plan_type;
          token.onboardingCompleted = dbUser.onboarding_completed;
          token.googleCalendarConnected = dbUser.google_calendar_connected;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.planType = token.planType as string;
        session.user.onboardingCompleted = token.onboardingCompleted as boolean;
        session.user.googleCalendarConnected = token.googleCalendarConnected as boolean;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: { strategy: 'jwt' },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
