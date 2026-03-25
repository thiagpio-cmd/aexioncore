"use client";

import { useState } from "react";
import { Modal, FormField, inputStyles, selectStyles } from "@/components/shared/modal";
import { apiPost } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";

interface EmailComposerProps {
  open: boolean;
  onClose: () => void;
  leadId?: string;
  opportunityId?: string;
  contactEmail?: string;
  contactName?: string;
  defaultPurpose?: string;
}

const PURPOSE_OPTIONS = [
  { value: "follow_up", label: "Follow Up" },
  { value: "introduction", label: "Introduction" },
  { value: "proposal", label: "Proposal" },
  { value: "meeting_request", label: "Meeting Request" },
  { value: "objection_handling", label: "Objection Handling" },
  { value: "check_in", label: "Check-in" },
  { value: "thank_you", label: "Thank You" },
];

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "urgent", label: "Urgent" },
  { value: "consultative", label: "Consultative" },
];

export function EmailComposer({
  open,
  onClose,
  leadId,
  opportunityId,
  contactEmail: initialEmail,
  contactName: initialName,
  defaultPurpose = "follow_up",
}: EmailComposerProps) {
  const { toastSuccess, toastError } = useToast();

  const [contactEmail, setContactEmail] = useState(initialEmail || "");
  const [contactName, setContactName] = useState(initialName || "");
  const [purpose, setPurpose] = useState(defaultPurpose);
  const [tone, setTone] = useState("professional");
  const [additionalContext, setAdditionalContext] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generatedSubject, setGeneratedSubject] = useState("");
  const [generatedBody, setGeneratedBody] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync props when modal opens
  const handleClose = () => {
    setGeneratedSubject("");
    setGeneratedBody("");
    setHasGenerated(false);
    setProvider(null);
    setAdditionalContext("");
    setCopied(false);
    onClose();
  };

  const handleGenerate = async () => {
    if (!contactName.trim()) {
      toastError("Contact name is required");
      return;
    }

    setGenerating(true);
    setCopied(false);

    const { data, error } = await apiPost("/api/ai/generate-email", {
      leadId,
      opportunityId,
      contactEmail: contactEmail.trim(),
      contactName: contactName.trim(),
      purpose,
      tone,
      additionalContext: additionalContext.trim() || undefined,
      language: "en",
    });

    setGenerating(false);

    if (error) {
      toastError(error);
      return;
    }

    if (data) {
      setGeneratedSubject((data as any).subject || "");
      setGeneratedBody((data as any).body || "");
      setProvider((data as any).provider || null);
      setHasGenerated(true);
    }
  };

  const handleCopy = async () => {
    const fullEmail = `Subject: ${generatedSubject}\n\n${generatedBody}`;
    try {
      await navigator.clipboard.writeText(fullEmail);
      setCopied(true);
      toastSuccess("Email copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toastError("Failed to copy to clipboard");
    }
  };

  const handleSendViaInbox = async () => {
    if (!generatedSubject.trim() || !generatedBody.trim()) return;
    setSending(true);

    const { error } = await apiPost("/api/activities", {
      type: "MESSAGE",
      channel: "EMAIL",
      subject: generatedSubject,
      body: generatedBody,
      leadId: leadId || undefined,
      opportunityId: opportunityId || undefined,
    });

    setSending(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess("Email sent via Inbox");
    handleClose();
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} title="AI Email Composer" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Provider badge */}
        {provider && (
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {provider === "openai" ? "GPT-4o" : provider === "deterministic" ? "Smart Templates" : "Fallback"}
            </span>
          </div>
        )}

        {/* Input fields */}
        <FormField label="To">
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="sarah.chen@techcorp.com"
            className={inputStyles}
          />
        </FormField>

        <FormField label="Contact Name" required>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Sarah Chen"
            className={inputStyles}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Purpose">
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className={selectStyles}
            >
              {PURPOSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Tone">
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className={selectStyles}
            >
              {TONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Additional Context">
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Add any specific points to mention, recent events, or custom instructions..."
            rows={2}
            className={`${inputStyles} resize-none`}
          />
        </FormField>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating || !contactName.trim()}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              {hasGenerated ? "Regenerate Email" : "Generate Email"}
            </>
          )}
        </button>

        {/* Generated email output */}
        {hasGenerated && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Generated Email</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <FormField label="Subject">
              <input
                type="text"
                value={generatedSubject}
                onChange={(e) => setGeneratedSubject(e.target.value)}
                placeholder="Email subject..."
                className={inputStyles}
              />
            </FormField>

            <FormField label="Body">
              <textarea
                value={generatedBody}
                onChange={(e) => setGeneratedBody(e.target.value)}
                rows={10}
                className={`${inputStyles} resize-none font-mono text-xs leading-relaxed`}
              />
            </FormField>

            {/* Action buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-background transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 4v6h-6" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Regenerate
                </button>
                <button
                  onClick={handleCopy}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-background transition-colors flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              <button
                onClick={handleSendViaInbox}
                disabled={sending || !generatedSubject.trim() || !generatedBody.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {sending ? (
                  "Sending..."
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    Send via Inbox
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
