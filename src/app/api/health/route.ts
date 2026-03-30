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
    checks.database = {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown",
    };
  }

  // AI availability
  checks.ai_native = { status: "ok" };
  checks.ai_openai = {
    status: process.env.OPENAI_API_KEY ? "ok" : "error",
    error: process.env.OPENAI_API_KEY ? undefined : "API key not configured",
  };

  // Integration config
  checks.integrations_google = {
    status: process.env.GOOGLE_CLIENT_ID ? "ok" : "error",
  };
  checks.integrations_microsoft = {
    status: process.env.MICROSOFT_CLIENT_ID ? "ok" : "error",
  };
  checks.integrations_slack = {
    status: process.env.SLACK_CLIENT_ID ? "ok" : "error",
  };

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
