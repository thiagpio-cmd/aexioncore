"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useApi, apiPut, apiPost } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { PageHeader } from "@/components/shared/page-header";
import { CardSkeleton } from "@/components/shared/skeleton";
import { Modal, FormField, inputStyles, selectStyles } from "@/components/shared/modal";

const channelConfig: Record<string, { label: string; color: string; icon: string }> = {
  WHATSAPP: { label: "WhatsApp", color: "bg-green-100 text-green-700", icon: "💬" },
  EMAIL: { label: "Email", color: "bg-blue-100 text-blue-700", icon: "📧" },
  CALL: { label: "Call", color: "bg-purple-100 text-purple-700", icon: "📞" },
  INTERNAL: { label: "Internal", color: "bg-gray-100 text-gray-700", icon: "🏢" },
};

export default function InboxPage() {
  const { data, loading, refetch } = useApi<any[]>("/api/inbox");
  const { toastSuccess, toastError } = useToast();
  const items = data || [];
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [marking, setMarking] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Inbox" subtitle="Loading messages..." />
        <div className="grid grid-cols-5 gap-4" style={{ minHeight: "400px" }}>
          <div className="col-span-2"><CardSkeleton /></div>
          <div className="col-span-3"><CardSkeleton /></div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Inbox" subtitle="No messages" />
        <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-border bg-surface">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted mb-3">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <p className="text-sm text-muted">Your inbox is empty</p>
          <p className="text-xs text-muted mt-1">Messages from connected integrations will appear here</p>
        </div>
      </div>
    );
  }

  const activeSelectedId = selectedId || items[0]?.id || null;
  const filtered = filter === "all" ? items : items.filter((m) => m.channel === filter.toUpperCase());
  const selected = items.find((m) => m.id === activeSelectedId);
  const unreadCount = items.filter((m) => !m.isRead).length;

  const handleMarkRead = async (messageId: string, isRead: boolean) => {
    setMarking(true);
    const { error } = await apiPut(`/api/inbox/${messageId}`, { isRead });
    setMarking(false);
    if (error) { toastError(error); return; }
    refetch();
  };

  const handleStar = async (messageId: string, starred: boolean) => {
    const { error } = await apiPut(`/api/inbox/${messageId}`, { starred });
    if (error) { toastError(error); return; }
    refetch();
  };

  const handleSelectMessage = (id: string) => {
    setSelectedId(id);
    const msg = items.find((m) => m.id === id);
    if (msg && !msg.isRead) {
      handleMarkRead(id, true);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selected) return;
    const { error } = await apiPost("/api/activities", {
      type: "MESSAGE",
      channel: selected.channel,
      subject: `Re: ${selected.subject || ""}`,
      body: replyText,
      leadId: selected.leadId || undefined,
      opportunityId: selected.opportunityId || undefined,
    });
    if (error) { toastError(error); return; }
    toastSuccess("Reply sent successfully");
    setReplyText("");
    refetch();
  };

  const handleCreateTask = async (title: string) => {
    if (!selected) return;
    const { error } = await apiPost(`/api/inbox/${selected.id}/actions`, {
      action: "create_task",
      title,
    });
    if (error) { toastError(error); return; }
    toastSuccess("Task created successfully");
    refetch();
  };

  const handleConvertLead = async () => {
    if (!selected) return;
    const { error } = await apiPost(`/api/inbox/${selected.id}/actions`, {
      action: "create_lead",
      name: selected.sender,
    });
    if (error) { toastError(error); return; }
    toastSuccess("Lead created successfully");
    refetch();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Inbox" subtitle={`${unreadCount} unread message${unreadCount !== 1 ? "s" : ""}`} />

      {/* Channel Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[
            { key: "all", label: "All", count: items.length },
            { key: "EMAIL", label: "Email", count: items.filter((m) => m.channel === "EMAIL").length },
            { key: "WHATSAPP", label: "WhatsApp", count: items.filter((m) => m.channel === "WHATSAPP").length },
            { key: "CALL", label: "Calls", count: items.filter((m) => m.channel === "CALL").length },
            { key: "INTERNAL", label: "Internal", count: items.filter((m) => m.channel === "INTERNAL").length },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filter === f.key ? "bg-primary text-white" : "bg-surface border border-border text-muted hover:text-foreground"}`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${filter === f.key ? "bg-white/20" : "bg-background"}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setComposeOpen(true)}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Compose
          </button>
          <button
            onClick={() => {
              const unread = items.filter((m) => !m.isRead);
              unread.forEach((m) => handleMarkRead(m.id, true));
            }}
            disabled={marking || unreadCount === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            Mark all as read
          </button>
        </div>
      </div>

      {/* Split Pane */}
      <div className="grid grid-cols-5 gap-4" style={{ minHeight: "calc(100vh - 240px)" }}>
        {/* Message List */}
        <div className="col-span-2 rounded-xl border border-border bg-surface overflow-hidden">
          <div className="divide-y divide-border overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted">No messages in this channel</p>
              </div>
            ) : (
              filtered.map((msg) => {
                const ch = channelConfig[msg.channel] || channelConfig.EMAIL;
                const preview = msg.body?.slice(0, 80) || "";
                return (
                  <button
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg.id)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-background ${
                      activeSelectedId === msg.id ? "bg-primary-light border-l-2 border-l-primary" : ""
                    } ${!msg.isRead ? "bg-blue-50/50" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">{ch.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-sm truncate ${!msg.isRead ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                            {msg.sender}
                          </span>
                          <span className="text-[11px] text-muted whitespace-nowrap ml-2">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {msg.subject && <p className={`text-xs truncate mt-0.5 ${!msg.isRead ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>{msg.subject}</p>}
                        <p className="text-xs text-muted truncate mt-0.5">{preview}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${ch.color}`}>{ch.label}</span>
                          {msg.starred && <span className="text-amber-400 text-xs">★</span>}
                          {!msg.isRead && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Message Detail */}
        <div className="col-span-3 rounded-xl border border-border bg-surface overflow-hidden flex flex-col">
          {selected ? (
            <>
              {/* Header */}
              <div className="border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{selected.sender}</h2>
                    <p className="text-sm text-muted">{channelConfig[selected.channel]?.label} · {new Date(selected.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStar(selected.id, !selected.starred)}
                      className={`rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-background ${selected.starred ? "text-amber-500" : "text-muted"}`}
                    >
                      {selected.starred ? "★ Starred" : "☆ Star"}
                    </button>
                    {!selected.lead && !selected.opportunity && (
                      <button
                        onClick={handleConvertLead}
                        className="rounded-lg border border-primary text-primary px-3 py-1.5 text-xs font-medium hover:bg-primary-light transition-colors"
                      >
                        + Create Lead
                      </button>
                    )}
                    <button
                      onClick={() => handleCreateTask(`Follow up with ${selected.sender}`)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background transition-colors"
                    >
                      + Create Task
                    </button>
                    <button
                      onClick={() => handleMarkRead(selected.id, !selected.isRead)}
                      disabled={marking}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-background transition-colors disabled:opacity-50"
                    >
                      {selected.isRead ? "Mark Unread" : "Mark Read"}
                    </button>
                  </div>
                </div>
                {selected.subject && <p className="text-sm font-medium text-foreground mt-2">{selected.subject}</p>}
              </div>

              {/* Body */}
              <div className="flex-1 px-6 py-4 overflow-y-auto">
                <div className="rounded-lg bg-background p-4">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.body}</p>
                  <p className="text-xs text-muted mt-3">{new Date(selected.createdAt).toLocaleString()}</p>
                </div>

                {/* Related to */}
                {(selected.lead || selected.opportunity) && (
                  <div className="mt-4 rounded-lg border border-border bg-background p-4">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Related to</p>
                    <div className="flex flex-wrap gap-2">
                      {selected.lead && (
                        <Link
                          href={`/leads/${selected.lead.id || selected.leadId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-border px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-light transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          {selected.lead.name || "Lead"}
                        </Link>
                      )}
                      {selected.opportunity && (
                        <Link
                          href={`/pipeline/${selected.opportunity.id || selected.opportunityId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-border px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-light transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                          </svg>
                          {selected.opportunity.name || selected.opportunity.title || "Opportunity"}
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Classification & Suggested Response */}
                <AIMessagePanel
                  message={selected}
                  onUseReply={(text) => setReplyText(text)}
                />
              </div>

              {/* Reply Bar */}
              <div className="border-t border-border p-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleReply(); }}
                    placeholder="Type your reply..."
                    className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim()}
                    className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto text-muted mb-2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <p className="text-sm text-muted">Select a message to view</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={() => refetch()}
      />
    </div>
  );
}

function ComposeModal({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [channel, setChannel] = useState("EMAIL");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const handleSend = async () => {
    if (!to.trim() || !body.trim()) return;
    setSending(true);
    const { error } = await apiPost("/api/activities", {
      type: "MESSAGE",
      channel,
      subject: subject || `Message to ${to}`,
      body,
    });
    setSending(false);
    if (error) {
      toastError(error);
      return;
    }
    toastSuccess("Message sent successfully");
    setTo("");
    setSubject("");
    setBody("");
    onClose();
    onSent();
  };

  return (
    <Modal open={open} onClose={onClose} title="Compose Message">
      <div className="space-y-4">
        <FormField label="Channel">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className={selectStyles}
          >
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="INTERNAL">Internal</option>
          </select>
        </FormField>
        <FormField label="To">
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={channel === "EMAIL" ? "email@example.com" : "+55 11 99999-0000"}
            className={inputStyles}
          />
        </FormField>
        {channel === "EMAIL" && (
          <FormField label="Subject">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Message subject"
              className={inputStyles}
            />
          </FormField>
        )}
        <FormField label="Message">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message..."
            rows={5}
            className={`${inputStyles} resize-none`}
          />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !to.trim() || !body.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send Message"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AIMessagePanel({ message, onUseReply }: { message: any; onUseReply: (text: string) => void }) {
  const [aiData, setAiData] = useState<{
    classification?: { category: string; relevance: string; sentiment: string; confidence: number };
    suggestedReply?: string;
    provider?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classify = useCallback(async () => {
    if (!message) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await apiPost("/api/ai/classify-message", {
        subject: message.subject || "",
        body: message.body || "",
        sender: message.sender || "",
        channel: message.channel || "EMAIL",
      });
      if (fetchError) {
        setError(fetchError);
      } else {
        setAiData(data);
      }
    } catch (err) {
      setError("Failed to classify message");
    }
    setLoading(false);
  }, [message?.id]);

  useEffect(() => {
    setAiData(null);
    classify();
  }, [message?.id, classify]);

  const relevanceColors: Record<string, string> = {
    HIGH: "bg-emerald-100 text-emerald-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    LOW: "bg-gray-100 text-gray-600",
    NONE: "bg-gray-100 text-gray-400",
  };

  const sentimentColors: Record<string, string> = {
    POSITIVE: "bg-emerald-100 text-emerald-700",
    NEUTRAL: "bg-blue-100 text-blue-700",
    NEGATIVE: "bg-red-100 text-red-700",
  };

  const categoryLabels: Record<string, string> = {
    DEAL_RELATED: "Deal Related",
    MEETING_REQUEST: "Meeting Request",
    FOLLOW_UP: "Follow-up",
    SUPPORT: "Support",
    INQUIRY: "Inquiry",
    MARKETING: "Marketing",
    PERSONAL: "Personal",
    UNKNOWN: "Unclassified",
  };

  return (
    <div className="mt-4 rounded-lg border border-primary/20 bg-primary-light p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-primary">AI Analysis</span>
        {aiData?.provider && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {aiData.provider === "openai" ? "GPT-4o" : aiData.provider === "gemini" ? "Gemini" : "Smart Reply"}
          </span>
        )}
      </div>

      {loading && (
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-primary/10 animate-pulse" />
          <div className="h-10 rounded bg-primary/10 animate-pulse" />
        </div>
      )}

      {error && (
        <p className="text-xs text-muted">{error}</p>
      )}

      {aiData && !loading && (
        <>
          {/* Classification Tags */}
          {aiData.classification && (
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold bg-primary/10 text-primary">
                {categoryLabels[aiData.classification.category] || aiData.classification.category}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${relevanceColors[aiData.classification.relevance] || relevanceColors.MEDIUM}`}>
                {aiData.classification.relevance} Relevance
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${sentimentColors[aiData.classification.sentiment] || sentimentColors.NEUTRAL}`}>
                {aiData.classification.sentiment}
              </span>
              <span className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium bg-gray-100 text-gray-500">
                {Math.round((aiData.classification.confidence || 0) * 100)}% confidence
              </span>
            </div>
          )}

          {/* Suggested Reply */}
          {aiData.suggestedReply && (
            <>
              <p className="text-xs font-medium text-primary/70 mb-1.5">Suggested Reply</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{aiData.suggestedReply}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onUseReply(aiData.suggestedReply!)}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors"
                >
                  Use Response
                </button>
                <button
                  onClick={classify}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
                >
                  Regenerate
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
