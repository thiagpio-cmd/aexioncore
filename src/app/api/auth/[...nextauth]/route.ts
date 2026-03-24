import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

// Apply rate limiting inside the authorize callback
const rateLimitedAuthOptions = {
  ...authOptions,
  callbacks: {
    ...authOptions.callbacks,
    async signIn({ user }: any) {
      // Rate limit is checked in the authorize function itself
      return !!user;
    },
  },
  providers: authOptions.providers.map((provider: any) => {
    if (provider.id === "credentials") {
      const originalAuthorize = provider.options?.authorize;
      return {
        ...provider,
        options: {
          ...provider.options,
          authorize: async (credentials: any, req: any) => {
            // Extract IP from headers for rate limiting
            const ip = req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
              || req?.headers?.["x-real-ip"]
              || "unknown";

            const { success } = rateLimit(`auth:${ip}`, 10, 60000);
            if (!success) {
              throw new Error("Too many login attempts. Please try again later.");
            }

            return originalAuthorize?.(credentials, req) ?? null;
          },
        },
      };
    }
    return provider;
  }),
};

const handler = NextAuth(rateLimitedAuthOptions as any);

export { handler as GET, handler as POST };
