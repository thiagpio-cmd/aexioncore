import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { badRequest, notFound } from "@/lib/errors";
import { resolveTranscriptEntities } from "@/lib/transcription/entity-resolver";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcriptId } = body;

    if (!transcriptId) {
      return sendError(badRequest("transcriptId is required"));
    }

    const transcript = await prisma.meetingTranscript.findUnique({
      where: { id: transcriptId },
    });

    if (!transcript) {
      return sendError(notFound("MeetingTranscript"));
    }

    if (transcript.processedAt) {
      return sendSuccess({ skipped: true, reason: "Already processed" });
    }

    try {
      const prompt = `Analyze this meeting transcript and return a JSON object with:
- summary: 3-5 sentence executive summary of what was discussed and decided
- actionItems: array of { text: string, assignee: string (if identifiable), priority: "high"|"medium"|"low" }
- sentiment: "positive"|"neutral"|"negative"|"mixed" based on the overall tone
- keyTopics: array of 3-7 topic strings discussed
- nextSteps: array of strings with concrete next steps mentioned
- objections: array of strings with any objections or concerns raised
- buyingSignals: array of strings with positive buying indicators

Respond ONLY with valid JSON, no markdown or explanation.

Transcript:
${transcript.rawTranscript.substring(0, 15000)}`;

      let aiResult: any = null;
      let provider = "deterministic";

      // Try OpenAI
      if (process.env.OPENAI_API_KEY) {
        try {
          const res = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3,
                response_format: { type: "json_object" },
              }),
            }
          );

          if (res.ok) {
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) {
              aiResult = JSON.parse(content);
              provider = "openai";
            }
          }
        } catch (e) {
          console.error(
            "[Transcription:AI] OpenAI failed:",
            (e as Error).message
          );
        }
      }

      // Try Gemini fallback
      if (!aiResult && process.env.GEMINI_API_KEY) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.3,
                  responseMimeType: "application/json",
                },
              }),
            }
          );

          if (res.ok) {
            const data = await res.json();
            const text =
              data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              aiResult = JSON.parse(text);
              provider = "gemini";
            }
          }
        } catch (e) {
          console.error(
            "[Transcription:AI] Gemini failed:",
            (e as Error).message
          );
        }
      }

      // Deterministic fallback
      if (!aiResult) {
        const words = transcript.rawTranscript.split(/\s+/);
        const lower = transcript.rawTranscript.toLowerCase();

        const positiveWords = [
          "great", "excellent", "agree", "love", "perfect", "excited",
        ];
        const negativeWords = [
          "concern", "issue", "problem", "worry", "expensive", "difficult",
        ];

        const posCount = positiveWords.filter((w) => lower.includes(w)).length;
        const negCount = negativeWords.filter((w) => lower.includes(w)).length;

        let sentiment = "neutral";
        if (posCount > negCount + 2) sentiment = "positive";
        else if (negCount > posCount + 2) sentiment = "negative";
        else if (posCount > 0 && negCount > 0) sentiment = "mixed";

        aiResult = {
          summary: `Meeting transcript with ${words.length} words. Detected ${posCount} positive and ${negCount} negative indicators.`,
          actionItems: [],
          sentiment,
          keyTopics: ["meeting discussion"],
          nextSteps: [],
          objections: [],
          buyingSignals: [],
        };
        provider = "deterministic";
      }

      // Entity resolution
      const participants = transcript.participants
        ? JSON.parse(transcript.participants)
        : [];
      const entities = await resolveTranscriptEntities(
        participants,
        transcript.organizationId,
        transcript.meetingId
      );

      // Save results + entity links
      await prisma.meetingTranscript.update({
        where: { id: transcriptId },
        data: {
          summary: aiResult.summary || null,
          actionItems: aiResult.actionItems
            ? JSON.stringify(aiResult.actionItems)
            : null,
          sentiment: aiResult.sentiment || null,
          keyTopics: aiResult.keyTopics
            ? JSON.stringify(aiResult.keyTopics)
            : null,
          nextSteps: aiResult.nextSteps
            ? JSON.stringify(aiResult.nextSteps)
            : null,
          objections: aiResult.objections
            ? JSON.stringify(aiResult.objections)
            : null,
          buyingSignals: aiResult.buyingSignals
            ? JSON.stringify(aiResult.buyingSignals)
            : null,
          contactId: entities.contactId,
          leadId: entities.leadId,
          opportunityId: entities.opportunityId,
          accountId: entities.accountId,
          processedAt: new Date(),
          processingError: null,
        },
      });

      // Create Insight if linked to an Opportunity
      if (entities.opportunityId && aiResult.summary) {
        await prisma.insight.create({
          data: {
            organizationId: transcript.organizationId,
            category: "meeting_intelligence",
            title: `Meeting: ${transcript.title || "Transcript Analysis"}`,
            description: aiResult.summary,
            confidence: provider === "deterministic" ? 60 : 85,
            opportunityId: entities.opportunityId,
            leadId: entities.leadId,
          },
        });
      }

      // Create Activity record
      await prisma.activity.create({
        data: {
          type: "meeting_transcript",
          channel: "meeting",
          subject: transcript.title || "Meeting Transcript Processed",
          body: aiResult.summary || "Transcript processed",
          organizationId: transcript.organizationId,
          leadId: entities.leadId || undefined,
          opportunityId: entities.opportunityId || undefined,
        },
      });

      return sendSuccess({ id: transcriptId, provider, processed: true });
    } catch (processError) {
      await prisma.meetingTranscript.update({
        where: { id: transcriptId },
        data: {
          processingError:
            processError instanceof Error
              ? processError.message
              : "Processing failed",
        },
      });
      console.error(
        `[Transcription:Process] Failed for ${transcriptId}:`,
        processError
      );
      return sendSuccess({
        id: transcriptId,
        processed: false,
        error: "Processing failed",
      });
    }
  } catch (error) {
    console.error("[Transcription:Process] Error:", error);
    return sendUnhandledError();
  }
}
