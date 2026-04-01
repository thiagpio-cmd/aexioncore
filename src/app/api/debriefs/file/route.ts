/**
 * POST /api/debriefs/file — Upload a text/transcript file, extract text, create debrief
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, badRequest } from "@/lib/errors";
import { actorFromSession, canPerform } from "@/lib/authorization";
import { processDebrief } from "@/lib/intelligence/debrief-service";
import { prisma } from "@/lib/db";
import { auditCreate } from "@/server/audit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_EXTENSIONS = [".txt", ".vtt", ".srt", ".doc", ".docx", ".pdf"];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "opportunity", "edit")) {
      return sendError(forbidden("No permission to create debriefs"));
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const opportunityId = formData.get("opportunityId") as string | null;

    if (!file || !(file instanceof File)) {
      return sendError(badRequest("Field 'file' is required"));
    }

    if (!opportunityId || typeof opportunityId !== "string") {
      return sendError(badRequest("Field 'opportunityId' is required"));
    }

    // Validate extension
    const fileName = file.name.toLowerCase();
    const ext = "." + fileName.split(".").pop();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return sendError(
        badRequest(
          `Unsupported file type: ${ext}. Accepted formats: ${ALLOWED_EXTENSIONS.join(", ")}`
        )
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return sendError(
        badRequest(`File too large. Maximum: ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
      );
    }

    // Verify opportunity
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true, organizationId: true, ownerId: true },
    });

    if (!opportunity) {
      return sendError(badRequest("Opportunity not found"));
    }

    if (opportunity.organizationId !== session.user.organizationId) {
      return sendError(forbidden("Access denied to this opportunity"));
    }

    if (
      !canPerform(actor, "opportunity", "edit", {
        ownerId: opportunity.ownerId,
        organizationId: opportunity.organizationId,
      })
    ) {
      return sendError(forbidden("No permission for this opportunity"));
    }

    // Extract text from file
    let extractedText: string;

    if (ext === ".txt") {
      extractedText = await file.text();
    } else if (ext === ".vtt") {
      extractedText = stripVTT(await file.text());
    } else if (ext === ".srt") {
      extractedText = stripSRT(await file.text());
    } else {
      // .doc, .docx, .pdf — not natively supported without libraries
      // For now, try reading as text; in production, use a document parsing library
      try {
        extractedText = await file.text();
      } catch {
        return sendError(
          badRequest(
            `Could not read file ${ext}. For now, please use .txt, .vtt, or .srt.`
          )
        );
      }
    }

    if (!extractedText || extractedText.trim().length < 10) {
      return sendError(
        badRequest("File does not contain enough text (minimum 10 characters)")
      );
    }

    // Process debrief
    const result = await processDebrief({
      text: extractedText.trim(),
      opportunityId,
      userId: session.user.id,
      orgId: session.user.organizationId,
    });

    // Update with file-specific fields
    await prisma.debrief.update({
      where: { id: result.debrief.id },
      data: {
        inputType: "file",
        fileUrl: `file://${file.name}`,
      },
    });

    auditCreate(
      session.user.organizationId,
      session.user.id,
      "Debrief",
      result.debrief.id,
      {
        opportunityId,
        inputType: "file",
        fileName: file.name,
        proposalCount: result.proposals.length,
      }
    );

    return sendSuccess(result, 201);
  } catch (error: any) {
    console.error("POST /api/debriefs/file error:", error);
    if (
      error.message?.includes("not found") ||
      error.message?.includes("denied")
    ) {
      return sendError(badRequest(error.message));
    }
    return sendUnhandledError();
  }
}

// ─── Subtitle/caption parsers ─────────────────────────────────────────────

/**
 * Strip VTT (WebVTT) timestamps and metadata, keep only dialogue text.
 */
function stripVTT(content: string): string {
  const lines = content.split("\n");
  const textLines: string[] = [];
  let inCue = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip WEBVTT header
    if (trimmed.startsWith("WEBVTT")) continue;
    // Skip NOTE blocks
    if (trimmed.startsWith("NOTE")) continue;
    // Skip empty lines (reset cue state)
    if (trimmed === "") {
      inCue = false;
      continue;
    }
    // Skip timestamp lines (e.g., "00:00:01.000 --> 00:00:04.000")
    if (/^\d{2}:\d{2}[:.]\d{2,3}\s*-->/.test(trimmed)) {
      inCue = true;
      continue;
    }
    // Skip cue identifiers (numeric lines before timestamps)
    if (/^\d+$/.test(trimmed)) continue;

    // This is dialogue text
    if (inCue || textLines.length > 0) {
      // Strip HTML-like tags (e.g., <v Name>)
      const clean = trimmed.replace(/<[^>]+>/g, "").trim();
      if (clean) textLines.push(clean);
    }
  }

  return textLines.join(" ");
}

/**
 * Strip SRT timestamps and sequence numbers, keep only dialogue text.
 */
function stripSRT(content: string): string {
  const lines = content.split("\n");
  const textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === "") continue;
    // Skip sequence numbers
    if (/^\d+$/.test(trimmed)) continue;
    // Skip timestamp lines
    if (/^\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(trimmed)) continue;

    // Strip HTML tags
    const clean = trimmed.replace(/<[^>]+>/g, "").trim();
    if (clean) textLines.push(clean);
  }

  return textLines.join(" ");
}
