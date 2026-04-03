"use client";

import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/design-system/GlassCard";
import { SectionLabel } from "@/components/design-system/SectionLabel";
import { StatusDot } from "@/components/design-system/StatusDot";

/* ─── Types ────────────────────────────────────────────────────────────── */

interface TodayTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  dueDate: string;
  owner: string;
  opportunityId?: string | null;
  leadId?: string | null;
}

interface OverdueTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  dueDate: string;
  owner: string;
  daysOverdue: number;
}

interface TodayMeeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
}

interface TodayMilestone {
  id: string;
  title: string;
  account: string;
  value: number;
  stage: string;
  type: string;
}

interface NewLead {
  id: string;
  name: string;
  company: string;
  temperature: string;
  source: string;
  createdAt: string;
}

interface RecentActivity {
  id: string;
  type: string;
  channel: string;
  subject: string;
  createdAt: string;
  creator: string;
}

export interface TodayViewData {
  todayTasks: TodayTask[];
  overdueTasksDetailed: OverdueTask[];
  todayMeetings: TodayMeeting[];
  todayMilestones: TodayMilestone[];
  newLeadsToContact: NewLead[];
  recentActivities: RecentActivity[];
  summary: {
    tasksToday: number;
    tasksDue: number;
    meetingsToday: number;
    newLeads: number;
    dealsClosingToday: number;
    activitiesToday: number;
  };
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function stageLabel(stage: string): string {
  return stage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatUSD(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function greetingText(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function todayDateStr(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const priorityColor: Record<string, string> = {
  URGENT: "var(--color-danger)",
  HIGH: "var(--color-warning)",
  MEDIUM: "var(--accent-text)",
  LOW: "var(--text-tertiary)",
};

const tempColor: Record<string, string> = {
  HOT: "var(--color-danger)",
  WARM: "var(--color-warning)",
  COLD: "var(--text-tertiary)",
};

/* ─── Sub-components ───────────────────────────────────────────────────── */

function SummaryBar({ summary }: { summary: TodayViewData["summary"] }) {
  const items = [
    { label: "Tasks due", value: summary.tasksDue, status: summary.tasksDue > 0 ? "warning" as const : "success" as const },
    { label: "Meetings", value: summary.meetingsToday, status: "accent" as const },
    { label: "New leads", value: summary.newLeads, status: summary.newLeads > 0 ? "success" as const : "accent" as const },
    { label: "Deals closing", value: summary.dealsClosingToday, status: summary.dealsClosingToday > 0 ? "danger" as const : "accent" as const },
  ];

  return (
    <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            padding: "var(--space-xs) var(--space-md)",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-card)",
            border: "0.5px solid var(--border-subtle)",
            fontSize: "13px",
          }}
        >
          <StatusDot status={item.status} size="sm" pulse={item.value > 0 && item.status === "danger"} />
          <span style={{ fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
            {item.value}
          </span>
          <span style={{ color: "var(--text-tertiary)" }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function TaskItem({ task, overdue }: { task: TodayTask | OverdueTask; overdue?: boolean }) {
  const router = useRouter();
  const daysText = overdue && "daysOverdue" in task
    ? task.daysOverdue === 1 ? "1 day overdue" : `${task.daysOverdue} days overdue`
    : null;

  return (
    <div
      onClick={() => router.push("/tasks")}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "var(--space-sm) var(--space-md)",
        borderRadius: "var(--radius-sm)",
        border: `0.5px solid ${overdue ? "var(--color-danger-border)" : "var(--border-subtle)"}`,
        background: overdue ? "var(--color-danger-muted)" : "transparent",
        cursor: "pointer",
        transition: "background var(--transition-default)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = overdue
          ? "var(--color-danger-muted)"
          : "var(--bg-card-elevated)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = overdue
          ? "var(--color-danger-muted)"
          : "transparent";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", minWidth: 0 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            flexShrink: 0,
            background: priorityColor[task.priority] || "var(--text-tertiary)",
          }}
        />
        <span
          style={{
            fontSize: "13px",
            color: "var(--text-primary)",
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {task.title}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexShrink: 0 }}>
        {daysText && (
          <span style={{ fontSize: "11px", color: "var(--color-danger)", fontWeight: 500 }}>{daysText}</span>
        )}
        <span
          style={{
            fontSize: "11px",
            padding: "1px 6px",
            borderRadius: "var(--radius-xs)",
            background: "var(--bg-card-elevated)",
            color: "var(--text-secondary)",
            textTransform: "capitalize",
          }}
        >
          {task.type?.toLowerCase().replace(/_/g, " ") || "task"}
        </span>
      </div>
    </div>
  );
}

function MeetingItem({ meeting }: { meeting: TodayMeeting }) {
  const router = useRouter();
  const isPast = new Date(meeting.endTime) < new Date();
  const isNow = new Date(meeting.startTime) <= new Date() && new Date(meeting.endTime) >= new Date();

  return (
    <div
      onClick={() => router.push("/meetings")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-md)",
        padding: "var(--space-sm) var(--space-md)",
        borderRadius: "var(--radius-sm)",
        border: `0.5px solid ${isNow ? "var(--accent-border)" : "var(--border-subtle)"}`,
        background: isNow ? "var(--accent-muted)" : "transparent",
        opacity: isPast ? 0.5 : 1,
        cursor: "pointer",
        transition: "background var(--transition-default)",
      }}
      onMouseEnter={(e) => {
        if (!isPast) (e.currentTarget as HTMLElement).style.background = isNow ? "var(--accent-muted)" : "var(--bg-card-elevated)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = isNow ? "var(--accent-muted)" : "transparent";
      }}
    >
      <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: isNow ? "var(--accent-text)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
          {formatTime(meeting.startTime)}
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {meeting.title}
        </p>
        <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: 0 }}>
          {meeting.location}
          {isNow && <span style={{ marginLeft: 8, color: "var(--accent-text)", fontWeight: 600 }}>NOW</span>}
        </p>
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────── */

interface TodayViewProps {
  data: TodayViewData;
  stats: {
    totalPipeline: number;
    overdueTasks: number;
    hotLeads: number;
    activeDeals: number;
    atRiskDeals: number;
  };
  userName?: string;
}

export function TodayView({ data, stats, userName }: TodayViewProps) {
  const router = useRouter();
  const hasOverdue = data.overdueTasksDetailed.length > 0;
  const hasTodayTasks = data.todayTasks.length > 0;
  const hasMeetings = data.todayMeetings.length > 0;
  const hasNewLeads = data.newLeadsToContact.length > 0;
  const hasMilestones = data.todayMilestones.length > 0;
  const totalActions = data.summary.tasksDue + data.summary.meetingsToday + data.summary.newLeads;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
      {/* ─── Header ───────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          {greetingText()}{userName ? `, ${userName.split(" ")[0]}` : ""}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-tertiary)", margin: "var(--space-xs) 0 0" }}>
          {todayDateStr()}
          {totalActions > 0 && (
            <span style={{ marginLeft: 8, color: "var(--text-secondary)" }}>
              — {totalActions} action{totalActions !== 1 ? "s" : ""} for today
            </span>
          )}
        </p>
      </div>

      {/* ─── Summary Bar ──────────────────────────────────────────── */}
      <SummaryBar summary={data.summary} />

      {/* ─── Main Grid: 2 columns (stacks on mobile) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: "var(--space-lg)" }}>
        {/* ─── Left Column: Tasks + Overdue ──────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          {/* Overdue Tasks (Red) */}
          {hasOverdue && (
            <GlassCard danger>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                  <StatusDot status="danger" size="md" pulse />
                  <SectionLabel>Overdue Tasks</SectionLabel>
                </div>
                <span
                  onClick={() => router.push("/tasks")}
                  style={{ fontSize: "12px", color: "var(--accent-text)", cursor: "pointer", fontWeight: 500 }}
                >
                  View all
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                {data.overdueTasksDetailed.map((task) => (
                  <TaskItem key={task.id} task={task} overdue />
                ))}
              </div>
            </GlassCard>
          )}

          {/* Today's Tasks */}
          <GlassCard>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
              <SectionLabel>Today&apos;s Tasks</SectionLabel>
              <span
                onClick={() => router.push("/tasks")}
                style={{ fontSize: "12px", color: "var(--accent-text)", cursor: "pointer", fontWeight: 500 }}
              >
                View all
              </span>
            </div>
            {hasTodayTasks ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                {data.todayTasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <div style={{ padding: "var(--space-lg) 0", textAlign: "center" }}>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                  No tasks due today
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: "var(--space-xs) 0 0" }}>
                  {stats.overdueTasks > 0
                    ? `You have ${stats.overdueTasks} overdue task${stats.overdueTasks > 1 ? "s" : ""} to catch up on`
                    : "You're all caught up!"}
                </p>
              </div>
            )}
          </GlassCard>

          {/* New Leads to Contact */}
          {hasNewLeads && (
            <GlassCard>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
                <SectionLabel>New Leads to Contact</SectionLabel>
                <span
                  onClick={() => router.push("/leads")}
                  style={{ fontSize: "12px", color: "var(--accent-text)", cursor: "pointer", fontWeight: 500 }}
                >
                  View all
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                {data.newLeadsToContact.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "var(--space-sm) var(--space-md)",
                      borderRadius: "var(--radius-sm)",
                      border: "0.5px solid var(--border-subtle)",
                      cursor: "pointer",
                      transition: "background var(--transition-default)",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-card-elevated)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", minWidth: 0 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: "var(--accent-muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--accent-text)",
                          flexShrink: 0,
                        }}
                      >
                        {lead.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {lead.name}
                        </p>
                        <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: 0 }}>{lead.company}</p>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: tempColor[lead.temperature] || "var(--text-tertiary)",
                      }}
                    >
                      {lead.temperature}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        {/* ─── Right Column: Meetings + Milestones + Activity ────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          {/* Today's Schedule */}
          <GlassCard accent={hasMeetings}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                <StatusDot status="accent" size="md" />
                <SectionLabel>Today&apos;s Schedule</SectionLabel>
              </div>
              <span
                onClick={() => router.push("/meetings")}
                style={{ fontSize: "12px", color: "var(--accent-text)", cursor: "pointer", fontWeight: 500 }}
              >
                View all
              </span>
            </div>
            {hasMeetings ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                {data.todayMeetings.map((meeting) => (
                  <MeetingItem key={meeting.id} meeting={meeting} />
                ))}
              </div>
            ) : (
              <div style={{ padding: "var(--space-lg) 0", textAlign: "center" }}>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>No meetings today</p>
                <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: "var(--space-xs) 0 0" }}>
                  Your calendar is clear
                </p>
              </div>
            )}
          </GlassCard>

          {/* Deals Closing Today */}
          {hasMilestones && (
            <GlassCard success>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                <StatusDot status="success" size="md" pulse />
                <SectionLabel>Deals Closing Today</SectionLabel>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {data.todayMilestones.map((deal) => (
                  <div
                    key={deal.id}
                    onClick={() => router.push(`/opportunities/${deal.id}`)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "var(--space-sm) var(--space-md)",
                      borderRadius: "var(--radius-sm)",
                      border: "0.5px solid var(--color-success-border)",
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                        {deal.title}
                      </p>
                      <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: 0 }}>
                        {deal.account} — {stageLabel(deal.stage)}
                      </p>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-success)", fontVariantNumeric: "tabular-nums" }}>
                      {formatUSD(deal.value)}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Quick Stats */}
          <GlassCard>
            <SectionLabel>Pipeline Snapshot</SectionLabel>
            <div style={{ marginTop: "var(--space-md)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
              <div>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                  {formatUSD(stats.totalPipeline)}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: "2px 0 0" }}>Total pipeline</p>
              </div>
              <div>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                  {stats.activeDeals}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: "2px 0 0" }}>Active deals</p>
              </div>
              <div>
                <p style={{ fontSize: "20px", fontWeight: 700, color: stats.hotLeads > 0 ? "var(--color-warning)" : "var(--text-primary)", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                  {stats.hotLeads}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: "2px 0 0" }}>Hot leads</p>
              </div>
              <div>
                <p style={{ fontSize: "20px", fontWeight: 700, color: stats.atRiskDeals > 0 ? "var(--color-danger)" : "var(--text-primary)", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                  {stats.atRiskDeals}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: "2px 0 0" }}>At risk</p>
              </div>
            </div>
          </GlassCard>

          {/* Recent Activity */}
          {data.recentActivities.length > 0 && (
            <GlassCard>
              <SectionLabel>Today&apos;s Activity</SectionLabel>
              <div style={{ marginTop: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {data.recentActivities.slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-sm)",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "var(--text-tertiary)", width: 48, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {formatTime(activity.createdAt)}
                    </span>
                    <StatusDot status="accent" size="sm" />
                    <span style={{ color: "var(--text-secondary)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{activity.creator}</strong>
                      {" "}{activity.type?.toLowerCase().replace(/_/g, " ")} — {activity.subject || "No subject"}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
