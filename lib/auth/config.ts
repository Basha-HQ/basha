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
}

export const authConfig: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        const dbUser = await queryOne<DbUser>(
          'SELECT id, plan_type FROM users WHERE email = $1',
          [token.email]
        );
        if (dbUser) {
          token.userId = dbUser.id;
          token.planType = dbUser.plan_type;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.planType = token.planType as string;
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
