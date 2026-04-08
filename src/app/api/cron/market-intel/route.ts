import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/cron/market-intel — Auto-refresh market intelligence snapshots
 * Called by Vercel Cron 3x/day (10:00, 15:00, 21:00 UTC)
 * Generates fresh Tavily snapshots for all active organizations.
 */

const QUERIES = [
  { query: "commercial real estate market trends cap rates 2026", topic: "Market Trends & Cap Rates" },
  { query: "CRE investment sales deal volume US 2026", topic: "Investment Sales & Deal Volume" },
  { query: "commercial real estate financing rates CMBS 2026", topic: "Financing & Interest Rates" },
  { query: "Sun Belt real estate market Austin Miami Dallas Phoenix 2026", topic: "Sun Belt Markets" },
  { query: "commercial real estate distressed assets opportunities 2026", topic: "Distressed Assets & Opportunities" },
];

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchTavily(apiKey: string, query: string) {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        search_depth: "basic",
        include_answer: true,
      }),
    });
    if (!res.ok) return { answer: "", results: [] };
    const data = await res.json();
    return { answer: data.answer || "", results: data.results || [] };
  } catch {
    return { answer: "", results: [] };
  }
}

export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TAVILY_API_KEY not set" }, { status: 500 });
  }

  // Ensure table exists
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "market_snapshots" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
      "date" TEXT NOT NULL,
      "data" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "market_snapshots_pkey" PRIMARY KEY ("id")
    )
  `);

  // Get all active organizations
  const orgs: { id: string }[] = await prisma.$queryRawUnsafe(
    `SELECT "id" FROM "organizations" LIMIT 50`
  );

  if (orgs.length === 0) {
    return NextResponse.json({ message: "No organizations found", updated: 0 });
  }

  // Run 5 Tavily searches once (shared across all orgs)
  const sections = await Promise.all(
    QUERIES.map(async ({ query, topic }) => {
      const { answer, results } = await fetchTavily(apiKey, query);
      return {
        topic,
        summary: answer,
        sources: results.slice(0, 5).map((r: any) => ({
          title: r.title || "Untitled",
          url: r.url || "",
          snippet: r.content?.slice(0, 300) || "",
        })),
      };
    })
  );

  const date = todayDate();
  const snapshot = {
    date,
    sections,
    generatedAt: new Date().toISOString(),
    searchCount: QUERIES.length,
  };
  const snapshotJson = JSON.stringify(snapshot);

  // Store snapshot for each organization
  let updated = 0;
  for (const org of orgs) {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "market_snapshots" WHERE "date" = $1 AND "organizationId" = $2`,
        date,
        org.id
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO "market_snapshots" ("id", "date", "data", "organizationId")
         VALUES (gen_random_uuid()::text, $1, $2, $3)`,
        date,
        snapshotJson,
        org.id
      );
      updated++;
    } catch (err) {
      console.error(`[cron/market-intel] Failed for org ${org.id}:`, err);
    }
  }

  console.log(`[cron/market-intel] Updated ${updated}/${orgs.length} orgs for ${date}`);
  return NextResponse.json({ message: "Market intel refreshed", date, updated, total: orgs.length });
}
