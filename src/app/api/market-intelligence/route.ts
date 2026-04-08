import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest, serverError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Source {
  title: string;
  url: string;
  snippet: string;
}

interface SnapshotSection {
  topic: string;
  summary: string;
  sources: Source[];
}

interface MarketSnapshot {
  date: string;
  sections: SnapshotSection[];
  generatedAt: string;
  searchCount: number;
}

// ─── Tavily Queries ─────────────────────────────────────────────────────────

const QUERIES = [
  {
    query: "commercial real estate market trends cap rates 2026",
    topic: "Market Trends & Cap Rates",
  },
  {
    query: "CRE investment sales deal volume US 2026",
    topic: "Investment Sales & Deal Volume",
  },
  {
    query: "commercial real estate financing rates CMBS 2026",
    topic: "Financing & Interest Rates",
  },
  {
    query: "Sun Belt real estate market Austin Miami Dallas Phoenix 2026",
    topic: "Sun Belt Markets",
  },
  {
    query: "commercial real estate distressed assets opportunities 2026",
    topic: "Distressed Assets & Opportunities",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function ensureTable(): Promise<void> {
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
}

async function fetchTavilySearch(
  apiKey: string,
  query: string
): Promise<{ answer: string; results: any[] }> {
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

  if (!res.ok) {
    console.warn(`[market-intelligence] Tavily search failed for: "${query}" — ${res.status}`);
    return { answer: "", results: [] };
  }

  const data = await res.json();
  return {
    answer: data.answer || "",
    results: data.results || [],
  };
}

// ─── GET — Return today's cached snapshot ───────────────────────────────────

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const organizationId = (session.user as any).organizationId;
    if (!organizationId) {
      return sendError(badRequest("No organization linked to this account"));
    }

    await ensureTable();

    const date = todayDate();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "data", "createdAt" FROM "market_snapshots"
       WHERE "date" = $1 AND "organizationId" = $2
       ORDER BY "createdAt" DESC LIMIT 1`,
      date,
      organizationId
    );

    if (rows.length === 0) {
      return sendSuccess({ snapshot: null, stale: true });
    }

    const snapshot: MarketSnapshot = JSON.parse(rows[0].data);
    return sendSuccess({ snapshot, stale: false });
  } catch (error: any) {
    console.error("GET /api/market-intelligence error:", error);
    return sendUnhandledError();
  }
}

// ─── POST — Generate fresh snapshot via Tavily ──────────────────────────────

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const organizationId = (session.user as any).organizationId;
    if (!organizationId) {
      return sendError(badRequest("No organization linked to this account"));
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return sendError(serverError("Tavily API key is not configured"));
    }

    await ensureTable();

    // Run all 5 Tavily searches in parallel
    const results = await Promise.all(
      QUERIES.map(async ({ query, topic }) => {
        const { answer, results: tavilyResults } = await fetchTavilySearch(apiKey, query);

        const sources: Source[] = tavilyResults.slice(0, 5).map((r: any) => ({
          title: r.title || "Untitled",
          url: r.url || "",
          snippet: r.content?.slice(0, 300) || "",
        }));

        return {
          topic,
          summary: answer,
          sources,
        } satisfies SnapshotSection;
      })
    );

    const date = todayDate();
    const snapshot: MarketSnapshot = {
      date,
      sections: results,
      generatedAt: new Date().toISOString(),
      searchCount: QUERIES.length,
    };

    const snapshotJson = JSON.stringify(snapshot);

    // Delete existing snapshot for today (overwrite), then insert new
    await prisma.$executeRawUnsafe(
      `DELETE FROM "market_snapshots" WHERE "date" = $1 AND "organizationId" = $2`,
      date,
      organizationId
    );

    await prisma.$executeRawUnsafe(
      `INSERT INTO "market_snapshots" ("id", "date", "data", "organizationId")
       VALUES (gen_random_uuid()::text, $1, $2, $3)`,
      date,
      snapshotJson,
      organizationId
    );

    return sendSuccess({ snapshot, stale: false }, 201);
  } catch (error: any) {
    console.error("POST /api/market-intelligence error:", error);
    return sendUnhandledError();
  }
}
