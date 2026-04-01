"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = [
  ".txt",
  ".vtt",
  ".srt",
];

const ACCEPTED_MIME_TYPES = [
  "text/plain",
  "text/vtt",
  "application/x-subrip",
];

const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ onFileSelected, disabled = false }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);

      // Check extension
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED_TYPES.includes(ext)) {
        setError(`Tipo de arquivo nao suportado: ${ext}. Use ${ACCEPTED_TYPES.join(", ")}`);
        return;
      }

      // Check size
      if (file.size > MAX_SIZE_BYTES) {
        setError(`Arquivo muito grande (${formatFileSize(file.size)}). Maximo: ${MAX_SIZE_MB}MB`);
        return;
      }

      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSelect(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleClear() {
    setSelectedFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-[var(--space-sm)]">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-[var(--space-sm)]",
          "rounded-[var(--radius-sm)] border-2 border-dashed",
          "px-[var(--space-md)] py-[var(--space-lg)]",
          "cursor-pointer transition-all min-h-[120px]",
          disabled && "opacity-50 cursor-not-allowed",
          dragOver
            ? "border-[var(--accent)] bg-[var(--accent)]/5"
            : "border-[var(--glass-border)] bg-[var(--glass-bg)] hover:border-[var(--text-muted)]"
        )}
      >
        {selectedFile ? (
          <>
            {/* File icon */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--accent-emerald)]"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[240px]">
                {selectedFile.name}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="text-xs text-[var(--accent-red)] hover:underline"
            >
              Remover
            </button>
          </>
        ) : (
          <>
            {/* Upload icon */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--text-muted)]"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-sm text-[var(--text-secondary)] text-center">
              Arraste um arquivo ou clique para selecionar
            </p>
            <p className="text-xs text-[var(--text-dim)]">
              {ACCEPTED_TYPES.join(", ")} — max {MAX_SIZE_MB}MB
            </p>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleInputChange}
        disabled={disabled}
        className="hidden"
      />

      {/* Error */}
      {error && (
        <p className="text-xs text-[var(--accent-red)]">{error}</p>
      )}
    </div>
  );
}
