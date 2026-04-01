"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AudioRecorder } from "./AudioRecorder";
import { FileUpload } from "./FileUpload";

type InputMode = "text" | "audio" | "file";
type SubmitPhase = "idle" | "uploading" | "transcribing" | "analyzing" | "done" | "error";

interface DebriefInputProps {
  opportunityId: string;
  onResult: (result: DebriefResult) => void;
  disabled?: boolean;
}

interface DebriefResult {
  id: string;
  summary: string;
  proposals: Array<{
    id: string;
    actionType: string;
    description: string;
    urgency: string;
    financialImpact: string | null;
    status: string;
    params: Record<string, unknown>;
  }>;
}

const MODE_TABS: { key: InputMode; label: string }[] = [
  { key: "text", label: "Write" },
  { key: "audio", label: "Audio" },
  { key: "file", label: "File" },
];

const PHASE_LABELS: Record<SubmitPhase, string> = {
  idle: "",
  uploading: "Uploading...",
  transcribing: "Transcribing audio...",
  analyzing: "Analyzing...",
  done: "Done",
  error: "Error",
};

export function DebriefInput({ opportunityId, onResult, disabled = false }: DebriefInputProps) {
  const [mode, setMode] = useState<InputMode>("text");
  const [text, setText] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const isSubmitting = phase !== "idle" && phase !== "done" && phase !== "error";

  const canSubmit =
    !isSubmitting &&
    !disabled &&
    ((mode === "text" && text.trim().length >= 10) ||
      (mode === "audio" && audioBlob !== null) ||
      (mode === "file" && selectedFile !== null));

  const handleAudioComplete = useCallback((blob: Blob) => {
    setAudioBlob(blob);
    setError(null);
  }, []);

  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file);
    setError(null);
  }, []);

  async function handleSubmit() {
    setError(null);

    try {
      if (mode === "text") {
        await submitText();
      } else if (mode === "audio") {
        await submitAudio();
      } else if (mode === "file") {
        await submitFile();
      }
    } catch (err: any) {
      setPhase("error");
      setError(err.message || "Unexpected error. Please try again.");
    }
  }

  async function submitText() {
    setPhase("analyzing");

    const res = await fetch("/api/debriefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim(), opportunityId }),
    });
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error?.message || "Error processing debrief");
    }

    setPhase("done");
    onResult(mapResult(json.data));
  }

  async function submitAudio() {
    if (!audioBlob) return;

    setPhase("uploading");
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    formData.append("opportunityId", opportunityId);

    setPhase("transcribing");
    const res = await fetch("/api/debriefs/audio", {
      method: "POST",
      body: formData,
    });
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error?.message || "Error processing audio");
    }

    setPhase("done");
    onResult(mapResult(json.data));
  }

  async function submitFile() {
    if (!selectedFile) return;

    setPhase("uploading");
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("opportunityId", opportunityId);

    setPhase("analyzing");
    const res = await fetch("/api/debriefs/file", {
      method: "POST",
      body: formData,
    });
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error?.message || "Error processing file");
    }

    setPhase("done");
    onResult(mapResult(json.data));
  }

  function mapResult(data: any): DebriefResult {
    return {
      id: data.debrief?.id ?? data.id,
      summary: data.debrief?.interpretation?.summary ?? "Debrief processado",
      proposals: data.proposals ?? [],
    };
  }

  function handleReset() {
    setText("");
    setAudioBlob(null);
    setSelectedFile(null);
    setPhase("idle");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-[var(--space-md)]">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-[var(--radius-sm)] bg-[var(--glass-bg)] p-1">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              if (!isSubmitting) {
                setMode(tab.key);
                setError(null);
              }
            }}
            disabled={isSubmitting}
            className={cn(
              "flex-1 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-all",
              "min-h-[40px]",
              "disabled:cursor-not-allowed",
              mode === tab.key
                ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="min-h-[140px]">
        {mode === "text" && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe what happened in the deal..."
            rows={5}
            disabled={isSubmitting || disabled}
            className={cn(
              "w-full resize-none rounded-[var(--radius-sm)] border border-[var(--glass-border)]",
              "bg-[var(--glass-bg)] px-[var(--space-md)] py-[var(--space-sm)]",
              "text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)]",
              "focus:outline-none focus:border-[var(--accent-gold)]/50",
              "disabled:opacity-50"
            )}
          />
        )}

        {mode === "audio" && (
          <div className="flex items-center justify-center py-[var(--space-md)]">
            <AudioRecorder
              onRecordingComplete={handleAudioComplete}
              disabled={isSubmitting || disabled}
            />
          </div>
        )}

        {mode === "file" && (
          <FileUpload
            onFileSelected={handleFileSelected}
            disabled={isSubmitting || disabled}
          />
        )}
      </div>

      {/* Audio ready indicator */}
      {mode === "audio" && audioBlob && !isSubmitting && phase !== "done" && (
        <div className="flex items-center gap-2 text-sm text-[var(--accent-emerald)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Audio recorded. Ready to submit.
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-[var(--accent-red)]">{error}</p>
      )}

      {/* Submit / Reset */}
      {phase !== "done" && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            "w-full rounded-[var(--radius-sm)] px-4 py-3 text-sm font-semibold transition-all",
            "bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]",
            "hover:bg-[var(--accent-gold)]/25 active:scale-[0.99]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "min-h-[48px]"
          )}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent-gold)] border-t-transparent" />
              {PHASE_LABELS[phase]}
            </span>
          ) : (
            "Submit for analysis"
          )}
        </button>
      )}

      {phase === "error" && (
        <button
          type="button"
          onClick={handleReset}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
