/**
 * POST /api/debriefs/audio — Upload audio, transcribe via Whisper, create debrief
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

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB (Whisper limit)

export async function POST(request: NextRequest) {
  try {
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return sendError(
        new (await import("@/lib/errors")).ApiError(
          503,
          "SERVICE_UNAVAILABLE",
          "Servico de transcricao indisponivel. Configure OPENAI_API_KEY no ambiente."
        )
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "opportunity", "edit")) {
      return sendError(forbidden("Sem permissao para criar debriefs"));
    }

    // Parse multipart form data
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const opportunityId = formData.get("opportunityId") as string | null;

    if (!audioFile || !(audioFile instanceof File)) {
      return sendError(badRequest("Campo 'audio' e obrigatorio"));
    }

    if (!opportunityId || typeof opportunityId !== "string") {
      return sendError(badRequest("Campo 'opportunityId' e obrigatorio"));
    }

    // Validate file size
    if (audioFile.size > MAX_AUDIO_SIZE) {
      return sendError(
        badRequest(`Arquivo de audio muito grande. Maximo: ${MAX_AUDIO_SIZE / (1024 * 1024)}MB`)
      );
    }

    // Verify opportunity exists and belongs to this org
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true, organizationId: true, ownerId: true },
    });

    if (!opportunity) {
      return sendError(badRequest("Oportunidade nao encontrada"));
    }

    if (opportunity.organizationId !== session.user.organizationId) {
      return sendError(forbidden("Acesso negado a esta oportunidade"));
    }

    if (
      !canPerform(actor, "opportunity", "edit", {
        ownerId: opportunity.ownerId,
        organizationId: opportunity.organizationId,
      })
    ) {
      return sendError(forbidden("Sem permissao para esta oportunidade"));
    }

    // Transcribe audio via OpenAI Whisper (using fetch, no SDK needed)
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, audioFile.name || "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "pt");
    whisperForm.append("response_format", "text");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const errBody = await whisperRes.text().catch(() => "unknown");
      console.error("[Whisper] transcription failed:", whisperRes.status, errBody);
      return sendError(
        badRequest("Erro na transcricao do audio. Tente novamente.")
      );
    }

    const transcribedText = await whisperRes.text();

    if (!transcribedText || transcribedText.trim().length < 5) {
      return sendError(
        badRequest("Nao foi possivel transcrever o audio. Tente gravar novamente com mais clareza.")
      );
    }

    // Process debrief using existing service
    const result = await processDebrief({
      text: transcribedText.trim(),
      opportunityId,
      userId: session.user.id,
      orgId: session.user.organizationId,
    });

    // Update the debrief record with audio-specific fields
    await prisma.debrief.update({
      where: { id: result.debrief.id },
      data: {
        inputType: "audio",
        fileUrl: `audio://${result.debrief.id}`, // placeholder — actual file storage TBD
      },
    });

    auditCreate(
      session.user.organizationId,
      session.user.id,
      "Debrief",
      result.debrief.id,
      {
        opportunityId,
        inputType: "audio",
        proposalCount: result.proposals.length,
        transcriptionLength: transcribedText.length,
      }
    );

    return sendSuccess(result, 201);
  } catch (error: any) {
    console.error("POST /api/debriefs/audio error:", error);
    if (
      error.message?.includes("nao encontrada") ||
      error.message?.includes("negado")
    ) {
      return sendError(badRequest(error.message));
    }
    return sendUnhandledError();
  }
}
