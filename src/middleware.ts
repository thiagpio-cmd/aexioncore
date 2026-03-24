import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Allow authenticated users through
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token }) {
        // Return true if the user has a valid token
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

// Protect all dashboard routes, but exclude auth pages, API, and static assets
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login, /register, /forgot-password (auth pages)
     * - /api (API routes - they handle their own auth)
     * - /_next (Next.js internals)
     * - /favicon.ico, /images, /fonts (static assets)
     */
    "/((?!login|register|forgot-password|api|_next|favicon\\.ico|images|fonts).*)",
  ],
};
