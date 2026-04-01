"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { WorkspaceType } from "@/types";
import { SDRWorkspace } from "@/components/workspaces/sdr-workspace";
import { CloserWorkspace } from "@/components/workspaces/closer-workspace";
import { ManagerWorkspace } from "@/components/workspaces/manager-workspace";
import { ExecutiveWorkspace } from "@/components/workspaces/executive-workspace";
import { SetupWizard, isOnboardingComplete } from "@/components/onboarding/setup-wizard";
import { SetupProgressBanner } from "@/components/onboarding/progress-banner";
import { MoneyAtRiskWidget } from "@/components/MoneyAtRiskWidget";
import { DebriefModal } from "@/components/DebriefModal";
import { BentoGrid } from "@/components/design-system/BentoGrid";
import { GlassCard } from "@/components/design-system/GlassCard";
import { MetricValue } from "@/components/design-system/MetricValue";
import { SectionLabel } from "@/components/design-system/SectionLabel";
import { StatusDot } from "@/components/design-system/StatusDot";

function DashboardBentoOverview({ workspace }: { workspace: WorkspaceType }) {
  const isExecutive = workspace === WorkspaceType.EXECUTIVE;
  const isManager = workspace === WorkspaceType.MANAGER || isExecutive;

  return (
    <BentoGrid columns={4} gap="10px">
      {/* Row 1: Pipeline Value (span 2) */}
      <GlassCard accent span={2}>
        <SectionLabel>Valor do Pipeline</SectionLabel>
        <div style={{ marginTop: "var(--space-md)" }}>
          <MetricValue
            value="R$ 2.4M"
            label="Total ativo"
            size="hero"
            prefix="R$ "
            subtitle="+12% vs. mes anterior"
            subtitleColor="success"
          />
        </div>
      </GlassCard>

      {/* Row 1: Forecast (span 1) */}
      <GlassCard span={1}>
        <SectionLabel>Forecast</SectionLabel>
        <div style={{ marginTop: "var(--space-md)" }}>
          <MetricValue
            value="R$ 890K"
            label="Projecao do mes"
            size="large"
            prefix="R$ "
          />
        </div>
        <div style={{ marginTop: "var(--space-md)", display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <StatusDot status="success" size="sm" />
          <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>82% confianca</span>
        </div>
      </GlassCard>

      {/* Row 1-2: Today/Agenda (span 1, rowspan 2) */}
      <GlassCard span={1} rowSpan={2}>
        <SectionLabel>Agenda de Hoje</SectionLabel>
        <div style={{ marginTop: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-sm)" }}>
            <StatusDot status="accent" size="sm" />
            <div>
              <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                Call com TechCorp
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: 0 }}>10:00</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-sm)" }}>
            <StatusDot status="warning" size="sm" />
            <div>
              <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                Follow-up DataSoft
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: 0 }}>14:00</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-sm)" }}>
            <StatusDot status="danger" size="sm" />
            <div>
              <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                Proposta vence hoje
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: 0 }}>CloudMax Inc.</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-sm)" }}>
            <StatusDot status="neutral" size="sm" />
            <div>
              <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                Reuniao de equipe
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: 0 }}>16:30</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Row 2: Risk Alert (span 1) */}
      <GlassCard danger span={1}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
          <StatusDot status="danger" size="md" pulse />
          <SectionLabel>Alerta de Risco</SectionLabel>
        </div>
        <MetricValue
          value="3"
          label="Deals em risco"
          size="large"
          subtitle="R$ 420K em risco"
          subtitleColor="danger"
        />
      </GlassCard>

      {/* Row 2: Priority Deal (span 2) */}
      <GlassCard accent span={2}>
        <SectionLabel>Deal Prioritario</SectionLabel>
        <div style={{ marginTop: "var(--space-md)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
              TechCorp — Plano Enterprise
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: "var(--space-xs) 0 0" }}>
              Fase: Negociacao
            </p>
          </div>
          <MetricValue value="R$ 380K" label="Valor" size="small" />
        </div>
        <div style={{ marginTop: "var(--space-md)", display: "flex", gap: "var(--space-lg)" }}>
          <StatusDot status="success" size="sm" label="Decisor engajado" />
          <StatusDot status="warning" size="sm" label="Prazo curto" />
        </div>
      </GlassCard>

      {/* Row 3: Top Deals (span 2) */}
      <GlassCard span={2}>
        <SectionLabel action={{ label: "Ver todos", onClick: () => {} }}>
          Top Deals
        </SectionLabel>
        <div style={{ marginTop: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {[
            { name: "TechCorp Enterprise", value: "R$ 380K", status: "success" as const },
            { name: "DataSoft Premium", value: "R$ 250K", status: "warning" as const },
            { name: "CloudMax Scale", value: "R$ 180K", status: "accent" as const },
          ].map((deal) => (
            <div
              key={deal.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--space-sm) 0",
                borderBottom: "0.5px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                <StatusDot status={deal.status} size="sm" />
                <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{deal.name}</span>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                {deal.value}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Row 3: Insights (span 1) */}
      <GlassCard span={1}>
        <SectionLabel>Insights</SectionLabel>
        <div style={{ marginTop: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div>
            <MetricValue value="4.2" label="Dias ate resposta" size="small" subtitle="Media" subtitleColor="muted" />
          </div>
          {isManager && (
            <div>
              <MetricValue value="67%" label="Win Rate" size="small" subtitle="+5pp vs meta" subtitleColor="success" />
            </div>
          )}
        </div>
      </GlassCard>

      {/* Row 3: Ready to Close (span 1) */}
      <GlassCard success span={1}>
        <SectionLabel>Prontos p/ Fechar</SectionLabel>
        <div style={{ marginTop: "var(--space-md)" }}>
          <MetricValue
            value="5"
            label="Deals qualificados"
            size="large"
            subtitle="R$ 620K total"
            subtitleColor="success"
          />
        </div>
      </GlassCard>
    </BentoGrid>
  );
}

export default function HomePage() {
  const { workspace } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(true);
  const [showDebrief, setShowDebrief] = useState(false);
  const [debriefOppId, setDebriefOppId] = useState("");

  useEffect(() => {
    const done = isOnboardingComplete();
    setOnboardingDone(done);
    if (!done) {
      setShowWizard(true);
    }
  }, []);

  function handleWizardComplete() {
    setShowWizard(false);
    setOnboardingDone(true);
  }

  function handleResumeSetup() {
    setShowWizard(true);
  }

  // Role-specific workspace components below the bento overview
  const workspaceContent = (() => {
    switch (workspace) {
      case WorkspaceType.SDR:
        return <SDRWorkspace />;
      case WorkspaceType.CLOSER:
        return <CloserWorkspace />;
      case WorkspaceType.MANAGER:
        return <ManagerWorkspace />;
      case WorkspaceType.EXECUTIVE:
        return <ExecutiveWorkspace />;
      default:
        return <SDRWorkspace />;
    }
  })();

  return (
    <>
      {showWizard && <SetupWizard onComplete={handleWizardComplete} />}
      {!onboardingDone && !showWizard && (
        <SetupProgressBanner onResumeSetup={handleResumeSetup} />
      )}

      {/* Bento Grid Dashboard Overview */}
      <div style={{ marginBottom: "var(--space-2xl)" }}>
        <DashboardBentoOverview workspace={workspace} />
      </div>

      {/* Dinheiro em Risco + Debrief */}
      <div style={{ marginBottom: "var(--space-xl)", display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--space-lg)", alignItems: "start" }}>
        <MoneyAtRiskWidget />
        <button
          onClick={() => {
            setDebriefOppId("");
            setShowDebrief(true);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            padding: "var(--space-sm) var(--space-lg)",
            borderRadius: "var(--radius-sm)",
            border: "0.5px solid var(--accent-border)",
            background: "var(--accent-muted)",
            color: "var(--accent-text)",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "border-color var(--transition-default)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Novo Debrief
        </button>
      </div>

      {/* Role-specific workspace */}
      {workspaceContent}

      <DebriefModal
        open={showDebrief}
        onClose={() => setShowDebrief(false)}
        opportunityId={debriefOppId}
      />
    </>
  );
}
