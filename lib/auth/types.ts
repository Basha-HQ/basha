import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      planType: string;
      onboardingCompleted: boolean;
      googleCalendarConnected: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    planType?: string;
    onboardingCompleted?: boolean;
    googleCalendarConnected?: boolean;
  }
}
