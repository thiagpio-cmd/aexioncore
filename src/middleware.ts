import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

// ─── CORS Configuration ────────────────────────────────────────────────────

function getAllowedOrigin(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

function handleCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin");
  const allowedOrigin = getAllowedOrigin();

  // Parse the allowed origin to get just the origin part (protocol + host + port)
  let parsedAllowed: string;
  try {
    const url = new URL(allowedOrigin);
    parsedAllowed = url.origin;
  } catch {
    parsedAllowed = allowedOrigin;
  }

  // Set CORS headers if origin matches
  if (origin === parsedAllowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

// ─── API Route CORS Middleware ──────────────────────────────────────────────

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function handleApiCors(request: NextRequest): NextResponse | null {
  if (!isApiRoute(request.nextUrl.pathname)) return null;

  const origin = request.headers.get("origin");

  // Handle preflight OPTIONS requests
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    return handleCors(request, response);
  }

  // For non-preflight requests with an origin header, validate origin
  if (origin) {
    const allowedOrigin = getAllowedOrigin();
    let parsedAllowed: string;
    try {
      const url = new URL(allowedOrigin);
      parsedAllowed = url.origin;
    } catch {
      parsedAllowed = allowedOrigin;
    }

    if (origin !== parsedAllowed) {
      // Block cross-origin API requests from unknown origins
      // Exception: webhook and callback routes that receive external requests
      const pathname = request.nextUrl.pathname;
      const isExternalRoute =
        pathname.startsWith("/api/webhooks/") ||
        pathname.startsWith("/api/integrations/callback/") ||
        pathname.includes("/callback") ||
        pathname.startsWith("/api/admin/");

      if (!isExternalRoute) {
        return NextResponse.json(
          { success: false, error: { code: "CORS_ERROR", message: "Cross-origin request blocked" } },
          { status: 403 }
        );
      }
    }
  }

  return null; // Continue to next middleware
}

// ─── Main Middleware ────────────────────────────────────────────────────────

export default withAuth(
  function middleware(req) {
    // Handle CORS for API routes
    const corsResponse = handleApiCors(req);
    if (corsResponse) return corsResponse;

    // Allow authenticated users through
    const response = NextResponse.next();

    // Add CORS headers to API responses
    if (isApiRoute(req.nextUrl.pathname)) {
      return handleCors(req, response);
    }

    return response;
  },
  {
    callbacks: {
      authorized({ token, req }) {
        // API routes and CORS preflight requests bypass NextAuth check
        // (API routes handle their own auth via getServerSession)
        if (isApiRoute(req.nextUrl.pathname)) return true;
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
// NOTE: API routes are included in the matcher now for CORS handling,
// but they bypass the NextAuth check in the authorized callback above.
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login, /register, /forgot-password (auth pages)
     * - /_next (Next.js internals)
     * - /favicon.ico, /images, /fonts (static assets)
     */
    "/((?!login|register|forgot-password|_next|favicon\\.ico|images|fonts).*)",
  ],
};
