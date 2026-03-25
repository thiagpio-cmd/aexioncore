"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { Modal } from "@/components/shared/modal";

interface ShortcutAction {
  key: string;
  label: string;
  meta?: boolean;
  handler: () => void;
}

interface KeyboardShortcutsContextValue {
  registerShortcut: (id: string, action: ShortcutAction) => void;
  unregisterShortcut: (id: string) => void;
  showHelp: () => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null);

export function useKeyboardShortcuts() {
  const ctx = useContext(KeyboardShortcutsContext);
  if (!ctx) throw new Error("useKeyboardShortcuts must be used within KeyboardShortcutsProvider");
  return ctx;
}

const DEFAULT_SHORTCUTS: { id: string; key: string; label: string; meta?: boolean; section: string }[] = [
  { id: "search", key: "K", label: "Focus search", meta: true, section: "Navigation" },
  { id: "new-item", key: "N", label: "New item", meta: true, section: "Actions" },
  { id: "help", key: "?", label: "Show keyboard shortcuts", section: "General" },
  { id: "close", key: "Esc", label: "Close modal / panel", section: "General" },
];

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState<Map<string, ShortcutAction>>(new Map());

  const registerShortcut = useCallback((id: string, action: ShortcutAction) => {
    setShortcuts((prev) => new Map(prev).set(id, action));
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const showHelp = useCallback(() => setHelpOpen(true), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        // Still allow Escape
        if (e.key !== "Escape") return;
      }

      // ? — show help
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
        return;
      }

      // Cmd/Ctrl+K — focus search (handled by GlobalSearch, but also broadcast)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        // GlobalSearch already handles this — let it bubble
        return;
      }

      // Cmd/Ctrl+N — new item
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        const newItemAction = shortcuts.get("new-item");
        if (newItemAction) newItemAction.handler();
        return;
      }

      // Escape — close modals
      if (e.key === "Escape") {
        setHelpOpen(false);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);

  return (
    <KeyboardShortcutsContext.Provider value={{ registerShortcut, unregisterShortcut, showHelp }}>
      {children}
      <ShortcutsHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </KeyboardShortcutsContext.Provider>
  );
}

/* ─── Help Modal ────────────────────────────────────────────────────────────── */

function ShortcutsHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isMac = typeof navigator !== "undefined" && navigator.platform?.includes("Mac");
  const modKey = isMac ? "\u2318" : "Ctrl";

  const sections = [
    {
      title: "Navigation",
      shortcuts: [
        { keys: [modKey, "K"], label: "Focus search" },
      ],
    },
    {
      title: "Actions",
      shortcuts: [
        { keys: [modKey, "N"], label: "New item" },
      ],
    },
    {
      title: "General",
      shortcuts: [
        { keys: ["?"], label: "Show keyboard shortcuts" },
        { keys: ["Esc"], label: "Close modal / panel" },
      ],
    },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Keyboard Shortcuts" description="Navigate faster with these shortcuts" maxWidth="max-w-md">
      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted/60">
              {section.title}
            </h4>
            <div className="space-y-1.5">
              {section.shortcuts.map((s) => (
                <div key={s.label} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-background transition-colors">
                  <span className="text-sm text-foreground">{s.label}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((key, i) => (
                      <span key={i}>
                        <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-background px-1.5 text-xs font-medium text-muted shadow-sm">
                          {key}
                        </kbd>
                        {i < s.keys.length - 1 && <span className="mx-0.5 text-muted/40">+</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
