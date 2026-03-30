/**
 * Microsoft Teams Transcript Service
 *
 * Uses Microsoft Graph API to:
 * - Subscribe to call record notifications
 * - Fetch meeting transcripts (WebVTT format)
 * - Convert VTT to clean text
 */

import { prisma } from "@/lib/db";
import { getBaseUrl } from "@/lib/utils/base-url";

const GRAPH_API = "https://graph.microsoft.com/v1.0";

/**
 * Create a Graph subscription for callRecords (meeting ended events).
 */
export async function subscribeToCallRecords(
  accessToken: string,
  integrationId: string
): Promise<{ subscriptionId: string; expirationDateTime: string } | null> {
  try {
    const webhookUrl = `${getBaseUrl()}/api/webhooks/teams-transcript`;
    const expiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

    const res = await fetch(`${GRAPH_API}/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        changeType: "created",
        notificationUrl: webhookUrl,
        resource: "/communications/callRecords",
        expirationDateTime: expiration.toISOString(),
        clientState: integrationId,
      }),
    });

    if (!res.ok) {
      console.error("[Teams] Failed to create subscription:", await res.text());
      return null;
    }

    const data = await res.json();
    return {
      subscriptionId: data.id,
      expirationDateTime: data.expirationDateTime,
    };
  } catch (e) {
    console.error("[Teams] subscribeToCallRecords error:", (e as Error).message);
    return null;
  }
}

/**
 * Renew an existing Graph subscription.
 */
export async function renewSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<boolean> {
  try {
    const expiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const res = await fetch(`${GRAPH_API}/subscriptions/${subscriptionId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expirationDateTime: expiration.toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch transcript content for a Teams meeting.
 * Returns clean text (VTT timestamps stripped).
 */
export async function getTranscript(
  accessToken: string,
  meetingId: string
): Promise<{
  title: string;
  transcript: string;
  participants: { name: string; email?: string }[];
  duration: number | null;
} | null> {
  try {
    // Get online meeting details
    const meetingRes = await fetch(
      `${GRAPH_API}/me/onlineMeetings/${meetingId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let title = "Teams Meeting";
    if (meetingRes.ok) {
      const meetingData = await meetingRes.json();
      title = meetingData.subject || title;
    }

    // List transcripts
    const transcriptsRes = await fetch(
      `${GRAPH_API}/me/onlineMeetings/${meetingId}/transcripts`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!transcriptsRes.ok) return null;

    const transcriptsData = await transcriptsRes.json();
    const transcriptEntries = transcriptsData.value || [];
    if (transcriptEntries.length === 0) return null;

    // Get the first transcript content (WebVTT)
    const transcriptId = transcriptEntries[0].id;
    const contentRes = await fetch(
      `${GRAPH_API}/me/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!contentRes.ok) return null;

    const vttContent = await contentRes.text();
    const transcript = convertVttToText(vttContent);

    // Extract participants from VTT speakers
    const speakerSet = new Set<string>();
    const speakerRegex = /<v\s+([^>]+)>/g;
    let match;
    while ((match = speakerRegex.exec(vttContent)) !== null) {
      speakerSet.add(match[1]);
    }

    const participants = Array.from(speakerSet).map((name) => ({ name }));

    return { title, transcript, participants, duration: null };
  } catch (e) {
    console.error("[Teams] getTranscript error:", (e as Error).message);
    return null;
  }
}

/**
 * Convert WebVTT format to clean text.
 */
export function convertVttToText(vtt: string): string {
  return vtt
    .replace(/WEBVTT\n\n/g, "")
    .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\n/g, "")
    .replace(/<v\s+([^>]+)>/g, "$1: ") // Convert <v Speaker> to "Speaker: "
    .replace(/<\/v>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
