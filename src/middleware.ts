import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const response = NextResponse.next();

    // Add security headers
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // CORS headers for API routes (permissive — auth is handled per-route via getServerSession)
    if (req.nextUrl.pathname.startsWith("/api/")) {
      const origin = req.headers.get("origin");
      if (origin) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        response.headers.set("Access-Control-Allow-Credentials", "true");
      }
    }

    return response;
  },
  {
    callbacks: {
      authorized({ token, req }) {
        // API routes handle their own auth via getServerSession
        if (req.nextUrl.pathname.startsWith("/api/")) return true;
        // Admin routes handle their own auth
        if (req.nextUrl.pathname.startsWith("/admin/")) return true;
        // Require token for dashboard routes
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/((?!login|register|forgot-password|_next|favicon\\.ico|images|fonts).*)",
  ],
};
