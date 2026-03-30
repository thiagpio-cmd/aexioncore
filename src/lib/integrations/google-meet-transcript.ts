/**
 * Google Meet Transcript Service
 *
 * Google Meet saves transcripts as Google Docs in Drive.
 * This service:
 * - Polls Drive for new transcript files (fallback approach)
 * - Exports Doc content as plain text
 * - Extracts meeting title and participants
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DOCS_EXPORT_URL = "https://www.googleapis.com/drive/v3/files";

export interface MeetTranscript {
  title: string;
  transcript: string;
  participants: { name: string; email?: string }[];
  externalId: string; // Drive file ID
  createdTime: string;
}

/**
 * Check Google Drive for new Meet transcript files since a given date.
 */
export async function checkForTranscripts(
  accessToken: string,
  since: Date
): Promise<MeetTranscript[]> {
  const results: MeetTranscript[] = [];

  try {
    const sinceISO = since.toISOString();
    // Meet transcripts are Google Docs with "Transcript" in the name
    const query = encodeURIComponent(
      `name contains 'Transcript' and mimeType = 'application/vnd.google-apps.document' and modifiedTime > '${sinceISO}'`
    );

    const res = await fetch(
      `${DRIVE_API}/files?q=${query}&fields=files(id,name,createdTime,modifiedTime)&orderBy=modifiedTime desc&pageSize=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      console.error("[GoogleMeet] Drive API error:", res.status);
      return results;
    }

    const data = await res.json();
    const files = data.files || [];

    for (const file of files) {
      // Export the Google Doc as plain text
      const exportRes = await fetch(
        `${DOCS_EXPORT_URL}/${file.id}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!exportRes.ok) continue;

      const transcript = await exportRes.text();
      if (!transcript || transcript.length < 50) continue; // Skip empty/stub files

      // Extract title from filename (format: "Transcript - Meeting Title")
      const title = file.name
        ?.replace(/^Transcript\s*[-–—]\s*/i, "")
        ?.replace(/\s*\(\d{4}[-/]\d{2}[-/]\d{2}\)$/, "")
        ?.trim() || "Google Meet";

      // Try to extract participants from transcript content
      const participants = extractParticipantsFromText(transcript);

      results.push({
        title,
        transcript,
        participants,
        externalId: file.id,
        createdTime: file.createdTime || file.modifiedTime,
      });
    }
  } catch (e) {
    console.error("[GoogleMeet] checkForTranscripts error:", (e as Error).message);
  }

  return results;
}

/**
 * Extract speaker names from transcript text.
 * Google Meet transcripts typically have "Speaker Name: text" format.
 */
function extractParticipantsFromText(
  text: string
): { name: string; email?: string }[] {
  const speakers = new Set<string>();
  const lines = text.split("\n");

  for (const line of lines) {
    // Match "Name:" at start of line
    const match = line.match(/^([A-Z][a-zA-Z\s.'-]{1,40}):\s/);
    if (match) {
      const name = match[1].trim();
      // Filter out common false positives
      if (
        name.length > 1 &&
        !["Note", "Notes", "Transcript", "Summary", "Action", "Date", "Time"].includes(name)
      ) {
        speakers.add(name);
      }
    }
  }

  return Array.from(speakers).map((name) => ({ name }));
}
