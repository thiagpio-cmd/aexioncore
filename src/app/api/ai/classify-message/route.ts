import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { geminiProvider } from "@/lib/ai/providers/gemini-provider";
import { openaiTaskProvider } from "@/lib/ai/providers/openai-tasks";
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from "@/lib/rate-limiter";

/**
 * POST /api/ai/classify-message
 *
 * Classifies a message for CRM relevance using OpenAI/Gemini (if available)
 * or deterministic keyword analysis as fallback.
 *
 * Body: { subject: string, body: string, sender: string, channel: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // Rate limiting
    const rateKey = `ai:${(session.user as any).id || getClientIp(request)}`;
    const rateCheck = checkRateLimit(rateKey, RATE_LIMITS.ai);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck);

    const { subject, body, sender, channel } = await request.json();

    if (!body) return sendError(badRequest("body is required"));

    const messageData = { subject: subject || "", body: body || "", sender: sender || "" };

    // Try OpenAI first
    if (openaiTaskProvider.isConfigured()) {
      try {
        const classification = await openaiTaskProvider.classifyMessage(messageData);
        const suggestedReply = await openaiTaskProvider.generateContextualReply(
          channel, classification.category, classification.sentiment, subject
        );
        return sendSuccess({ classification, suggestedReply, provider: "openai" });
      } catch (err) {
        console.warn("OpenAI classification failed:", err);
      }
    }

    // Try Gemini second
    if (geminiProvider.isConfigured()) {
      try {
        const classification = await geminiProvider.classifyMessage(messageData);
        const suggestedReply = await generateContextualReply(channel, classification.category, classification.sentiment, subject);
        return sendSuccess({ classification, suggestedReply, provider: "gemini" });
      } catch (err) {
        console.warn("Gemini classification failed:", err);
      }
    }

    // Deterministic fallback
    const classification = classifyDeterministic(body, subject);
    const suggestedReply = generateDeterministicReply(channel, classification.category);

    return sendSuccess({
      classification,
      suggestedReply,
      provider: "deterministic",
    });
  } catch (error: any) {
    console.error("POST /api/ai/classify-message error:", error);
    // Graceful — never break the inbox
    return sendSuccess({
      classification: { category: "UNKNOWN", relevance: "MEDIUM", sentiment: "NEUTRAL", confidence: 0.3 },
      suggestedReply: "Thank you for your message. I'll review and get back to you shortly.",
      provider: "fallback",
    });
  }
}

function classifyDeterministic(body: string, subject?: string): {
  category: string;
  relevance: string;
  sentiment: string;
  confidence: number;
} {
  const text = `${subject || ""} ${body}`.toLowerCase();

  const patterns: Array<{ category: string; keywords: string[]; relevance: string }> = [
    { category: "DEAL_RELATED", keywords: ["proposal", "pricing", "contract", "deal", "quote", "budget", "negotiation", "offer", "close", "decision"], relevance: "HIGH" },
    { category: "MEETING_REQUEST", keywords: ["schedule", "meeting", "call", "demo", "calendar", "available", "slot", "book", "discuss"], relevance: "HIGH" },
    { category: "FOLLOW_UP", keywords: ["following up", "follow up", "checking in", "touching base", "circling back", "as discussed", "recap"], relevance: "MEDIUM" },
    { category: "SUPPORT", keywords: ["help", "issue", "problem", "bug", "error", "not working", "broken", "fix"], relevance: "MEDIUM" },
    { category: "INQUIRY", keywords: ["interested", "learn more", "information", "question", "wondering", "curious"], relevance: "HIGH" },
    { category: "MARKETING", keywords: ["newsletter", "unsubscribe", "promotion", "offer", "discount", "webinar"], relevance: "LOW" },
  ];

  let bestMatch = { category: "UNKNOWN", relevance: "MEDIUM", score: 0 };

  for (const pattern of patterns) {
    const matches = pattern.keywords.filter((k) => text.includes(k)).length;
    if (matches > bestMatch.score) {
      bestMatch = { category: pattern.category, relevance: pattern.relevance, score: matches };
    }
  }

  // Simple sentiment
  const positiveWords = ["great", "excellent", "thanks", "appreciate", "love", "happy", "interested", "excited", "agree", "yes"];
  const negativeWords = ["disappointed", "frustrated", "issue", "problem", "cancel", "unhappy", "terrible", "angry"];
  const posCount = positiveWords.filter((w) => text.includes(w)).length;
  const negCount = negativeWords.filter((w) => text.includes(w)).length;
  const sentiment = posCount > negCount ? "POSITIVE" : negCount > posCount ? "NEGATIVE" : "NEUTRAL";

  return {
    category: bestMatch.category,
    relevance: bestMatch.relevance,
    sentiment,
    confidence: Math.min(0.85, 0.4 + bestMatch.score * 0.15),
  };
}

function generateDeterministicReply(channel: string, category: string): string {
  const replies: Record<string, Record<string, string>> = {
    EMAIL: {
      DEAL_RELATED: "Thank you for your interest. I'd love to discuss the specifics of our proposal. Would you be available for a quick call this week?",
      MEETING_REQUEST: "I'd be happy to schedule a meeting. Let me check my calendar and send you a few time options that work.",
      FOLLOW_UP: "Thanks for following up. I've reviewed the details and have some updates to share. Let me know a good time to connect.",
      SUPPORT: "I understand your concern and want to help resolve this quickly. Let me look into this and get back to you with a solution.",
      INQUIRY: "Thank you for reaching out! I'd be happy to provide more information. What specific aspects are you most interested in?",
      MARKETING: "Thanks for your interest. I'll make sure you receive our latest updates.",
      UNKNOWN: "Thank you for your email. I've reviewed the details and would like to schedule a call to discuss further. When works best for you this week?",
    },
    WHATSAPP: {
      DEAL_RELATED: "Thanks! Let me pull together the details on this. I'll send you everything shortly.",
      MEETING_REQUEST: "Sure, let me check availability. I'll send a calendar invite shortly.",
      FOLLOW_UP: "Thanks for checking in! Here's a quick update on where we stand.",
      SUPPORT: "Got it, let me look into this right away and get back to you.",
      INQUIRY: "Great question! Let me get you that info. Quick call or should I send details here?",
      MARKETING: "Thanks for the message! I'll share the details shortly.",
      UNKNOWN: "Thanks for the message! I'll check on this and get back to you shortly.",
    },
    CALL: {
      DEFAULT: "Following up on our call — I'll send over the materials we discussed. Let me know if you have any questions.",
    },
    INTERNAL: {
      DEFAULT: "Thanks for the update. I'll review and take action on this right away.",
    },
  };

  const channelReplies = replies[channel] || replies.EMAIL;
  return channelReplies[category] || channelReplies.DEFAULT || channelReplies.UNKNOWN || "Thank you for your message. I'll review and get back to you shortly.";
}

async function generateContextualReply(
  channel: string,
  category: string,
  sentiment: string,
  subject?: string
): Promise<string> {
  // If Gemini is available, try to generate a contextual reply
  if (geminiProvider.isConfigured()) {
    try {
      const result = await geminiProvider.generateText(
        `Generate a brief, professional reply for a ${channel} message.
Category: ${category}
Sentiment: ${sentiment}
Subject: ${subject || "No subject"}

Requirements:
- Keep it under 2 sentences
- Be professional but warm
- Include a clear next action
- Match the tone of the channel (formal for email, casual for WhatsApp)`,
        {
          maxTokens: 128,
          temperature: 0.4,
          systemInstruction: "You are a senior sales professional writing quick responses. Be concise and action-oriented.",
        }
      );
      return result.text;
    } catch {
      // Fall through to deterministic
    }
  }
  return generateDeterministicReply(channel, category);
}
