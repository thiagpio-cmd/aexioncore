"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Suggestion {
  label: string;
  action: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: Suggestion[];
  timestamp: Date;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AIChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      setUnreadCount(0);
    }
  }, [isOpen]);

  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });

        const json = await res.json();

        if (json.success && json.data) {
          const aiMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: json.data.message,
            suggestions: json.data.suggestions,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMsg]);

          if (!isOpen) {
            setUnreadCount((c) => c + 1);
          }
        } else {
          const errorMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content:
              json.error?.message ||
              "Sorry, I had trouble processing that. Could you try again?",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
      } catch {
        const errorMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content:
            "I'm having connection issues right now. Please check your network and try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [isTyping, isOpen]
  );

  // Listen for external events (from AI insight banners)
  useEffect(() => {
    function handleExternalSend(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string") {
        setIsOpen(true);
        setTimeout(() => sendMessage(detail), 200);
      }
    }
    window.addEventListener("aexion-ai-send", handleExternalSend);
    return () => window.removeEventListener("aexion-ai-send", handleExternalSend);
  }, [sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    sendMessage(suggestion.action);
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Chat Panel ───────────────────────────────────────────────── */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-6 z-[9999] flex flex-col
            w-[calc(100vw-48px)] sm:w-[400px] h-[500px] max-h-[80vh]
            rounded-2xl shadow-2xl border border-border
            bg-surface overflow-hidden"
          style={{ backdropFilter: "blur(16px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-primary"
                >
                  <path
                    d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"
                    fill="currentColor"
                    opacity="0.2"
                  />
                  <path
                    d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Aexion AI
                </h3>
                <p className="text-[11px] text-muted leading-none">
                  CRE Deal Advisor
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center w-7 h-7 rounded-lg
                text-muted hover:text-foreground hover:bg-background transition-colors"
              aria-label="Close chat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-3">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-primary"
                  >
                    <path
                      d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"
                      fill="currentColor"
                      opacity="0.15"
                    />
                    <path
                      d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Your CRE Deal Advisor
                </p>
                <p className="text-xs text-muted mb-4 max-w-[260px]">
                  I know your entire CRM — deals, leads, tasks, meetings, accounts,
                  contacts, comps, and commissions. Ask me anything about your portfolio.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    { label: "📊 Daily Briefing", action: "Give me today's executive briefing" },
                    { label: "🔴 At-Risk Deals", action: "Which deals are at risk and why?" },
                    { label: "📈 Cap Rate Analysis", action: "Analyze cap rates across my pipeline" },
                    { label: "💰 Commission Tracker", action: "Show my commission status — pending vs paid" },
                    { label: "🏢 Portfolio Overview", action: "Give me a full portfolio summary" },
                    { label: "📰 Market Trends", action: "What are the latest CRE market trends?" },
                  ].map((s) => (
                    <button
                      key={s.label}
                      onClick={() => sendMessage(s.action)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border
                        text-muted hover:text-foreground hover:border-primary/40
                        transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id}>
                <div
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-white rounded-2xl rounded-br-md"
                        : "bg-background text-foreground rounded-2xl rounded-bl-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>

                {/* Suggestion chips */}
                {msg.role === "assistant" &&
                  msg.suggestions &&
                  msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                      {msg.suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionClick(s)}
                          className="text-xs px-3 py-1.5 rounded-full border border-border
                            text-primary hover:bg-primary/10 hover:border-primary/40
                            transition-colors"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-background rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border bg-surface px-3 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre seus dados..."
                rows={1}
                className="flex-1 resize-none bg-background border border-border rounded-xl
                  px-3 py-2 text-sm text-foreground placeholder:text-muted
                  focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                  max-h-[100px] overflow-y-auto"
                style={{ minHeight: "38px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "38px";
                  target.style.height = `${Math.min(target.scrollHeight, 100)}px`;
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                className="flex items-center justify-center w-9 h-9 rounded-xl
                  bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed
                  hover:bg-primary/90 transition-colors shrink-0"
                aria-label="Send message"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Button ──────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[9999] flex items-center justify-center
          w-14 h-14 rounded-full bg-primary text-white shadow-lg
          hover:scale-105 hover:shadow-xl active:scale-95
          transition-all duration-200"
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
      >
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-white"
            >
              <path
                d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"
                fill="currentColor"
              />
            </svg>
            {/* Unread badge */}
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center
                  min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px]
                  font-semibold shadow-md"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
}
