"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  maxDuration?: number; // seconds
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
}

type RecorderState = "idle" | "recording" | "processing";

export function AudioRecorder({
  maxDuration = 60,
  onRecordingComplete,
  disabled = false,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setPermissionError(null);
    chunksRef.current = [];
    setElapsed(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        setState("processing");
        const blob = new Blob(chunksRef.current, { type: mimeType });
        onRecordingComplete(blob);
        setState("idle");
        setElapsed(0);
      };

      recorder.start(250); // collect data every 250ms
      setState("recording");

      // Timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTime) / 1000);
        setElapsed(secs);
        if (secs >= maxDuration) {
          stopRecording();
        }
      }, 250);
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionError("Microphone permission denied. Enable it in browser settings.");
      } else if (err.name === "NotFoundError") {
        setPermissionError("No microphone found on this device.");
      } else {
        setPermissionError("Error accessing microphone. Please try again.");
      }
      setState("idle");
    }
  }, [maxDuration, onRecordingComplete, stopRecording]);

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const progress = maxDuration > 0 ? (elapsed / maxDuration) * 100 : 0;

  return (
    <div className="flex flex-col items-center gap-[var(--space-md)]">
      {/* Timer display */}
      {state === "recording" && (
        <div className="flex flex-col items-center gap-[var(--space-xs)]">
          <span className="text-2xl font-mono font-bold text-[var(--text-primary)]">
            {formatTime(elapsed)}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            / {formatTime(maxDuration)}
          </span>
          {/* Progress bar */}
          <div className="w-48 h-1 rounded-full bg-[var(--glass-border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent-red)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Record / Stop button */}
      <button
        type="button"
        onClick={state === "recording" ? stopRecording : startRecording}
        disabled={disabled || state === "processing"}
        className={cn(
          "flex items-center justify-center rounded-full transition-all",
          "min-h-[64px] min-w-[64px] w-16 h-16",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          state === "recording"
            ? "bg-[var(--accent-red)]/20 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/30 animate-pulse"
            : "bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25"
        )}
        aria-label={state === "recording" ? "Parar gravacao" : "Iniciar gravacao"}
      >
        {state === "recording" ? (
          // Stop icon (square)
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          // Mic icon
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
      </button>

      {/* Label */}
      <span className="text-sm text-[var(--text-secondary)]">
        {state === "idle" && "Gravar"}
        {state === "recording" && "Gravando... toque para parar"}
        {state === "processing" && "Processando..."}
      </span>

      {/* Permission error */}
      {permissionError && (
        <p className="text-xs text-[var(--accent-red)] text-center max-w-[280px]">
          {permissionError}
        </p>
      )}
    </div>
  );
}
