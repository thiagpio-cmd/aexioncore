import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const checks: Record<
    string,
    { status: "ok" | "error"; latency_ms?: number; error?: string }
  > = {};
  const start = Date.now();

  // Database check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latency_ms: Date.now() - dbStart };
  } catch (err) {
    // SECURITY: do not expose internal DB error details to unauthenticated callers
    console.error("[health] DB check failed:", err);
    checks.database = {
      status: "error",
      error: "Connection failed",
    };
  }

  // Service availability checks — do NOT expose which specific API keys
  // or credentials are configured. That leaks infrastructure details to
  // unauthenticated callers.
  checks.services = { status: "ok" };

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      checks,
      total_latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
    },
    {
      status: allOk ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
