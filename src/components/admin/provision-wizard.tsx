"use client";

import { useState } from "react";
import { useAdminSecret } from "./admin-gate";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CompanyData {
  name: string;
  slug: string;
  industry: string;
  defaultCurrency: string;
  timezone: string;
}

interface AdminUserData {
  name: string;
  email: string;
  password: string;
}

interface TeamMember {
  name: string;
  email: string;
  role: string;
  password: string;
}

interface PipelineStage {
  name: string;
  order: number;
  color: string;
  probability: number;
}

interface BrandingData {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
}

interface GmailData {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

interface ProvisionResult {
  organization: { id: string; name: string; slug: string };
  credentials: Array<{ name: string; email: string; password: string; role: string }>;
  teams: Array<{ id: string; name: string }>;
  pipeline: { id: string; name: string; stageCount: number };
  loginUrl: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const INDUSTRIES = ["SaaS", "Real Estate", "Financial Services", "Healthcare", "Manufacturing", "Consulting", "E-Commerce", "Education", "Legal", "Other"];
const CURRENCIES = ["USD", "BRL", "EUR", "GBP", "CAD", "AUD"];
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo", "Europe/London", "Europe/Berlin", "Asia/Tokyo", "UTC"];
const ROLES = ["SDR", "CLOSER", "MANAGER", "DIRECTOR", "REVOPS", "ADMIN", "VIEWER"];
const MODULES = [
  { key: "commercial", label: "Commercial", desc: "CRM, leads, opportunities, pipeline" },
  { key: "data", label: "Data & Analytics", desc: "Reports, metrics, conversion analysis" },
  { key: "reports", label: "Reports", desc: "Custom reports and saved views" },
  { key: "automation", label: "Automation", desc: "Alerts, rules, and workflow triggers" },
  { key: "post_sale", label: "Post-Sale", desc: "Customer success and retention" },
  { key: "playbooks", label: "Playbooks", desc: "Sales playbooks and best practices" },
];
const DEFAULT_STAGES: PipelineStage[] = [
  { name: "Discovery", order: 1, color: "#3B82F6", probability: 10 },
  { name: "Qualification", order: 2, color: "#8B5CF6", probability: 25 },
  { name: "Proposal", order: 3, color: "#F59E0B", probability: 50 },
  { name: "Negotiation", order: 4, color: "#EF4444", probability: 75 },
  { name: "Closed Won", order: 5, color: "#10B981", probability: 100 },
  { name: "Closed Lost", order: 6, color: "#6B7280", probability: 0 },
];
const STAGE_COLORS = ["#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981", "#6B7280", "#EC4899", "#14B8A6", "#F97316", "#6366F1"];

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pw = "";
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

// ─── Input Components ───────────────────────────────────────────────────────

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#2457FF] focus:outline-none";
const selectClass = "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-[#2457FF] focus:outline-none [&>option]:bg-[#1a1a2e] [&>option]:text-white";
const labelClass = "block text-xs font-medium text-white/60 mb-1.5";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={labelClass}>{label}</label>{children}</div>;
}

// ─── Wizard Component ───────────────────────────────────────────────────────

export function ProvisionWizard() {
  const { headers } = useAdminSecret();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [error, setError] = useState("");

  // State
  const [company, setCompany] = useState<CompanyData>({ name: "", slug: "", industry: "SaaS", defaultCurrency: "USD", timezone: "America/New_York" });
  const [adminUser, setAdminUser] = useState<AdminUserData>({ name: "", email: "", password: "" });
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pipelineName, setPipelineName] = useState("Sales Pipeline");
  const [stages, setStages] = useState<PipelineStage[]>([...DEFAULT_STAGES]);
  const [modules, setModules] = useState<string[]>(MODULES.map((m) => m.key));
  const [branding, setBranding] = useState<BrandingData>({ primaryColor: "#2457FF", secondaryColor: "#1a1a2e", logoUrl: "" });
  const [gmail, setGmail] = useState<GmailData>({ enabled: false, clientId: "", clientSecret: "" });

  const STEPS = ["Company", "Admin User", "Team", "Pipeline", "Modules", "Branding", "Gmail", "Review"];

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");

    try {
      const payload = {
        company,
        adminUser,
        teamMembers: members,
        pipeline: { name: pipelineName, stages },
        modules,
        branding,
        ...(gmail.enabled ? { gmail: { clientId: gmail.clientId, clientSecret: gmail.clientSecret } } : {}),
      };

      const res = await fetch("/api/admin/provision", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setResult(data.data);
        setStep(8); // Success step
      } else {
        setError(data.error?.message || "Provisioning failed");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    }
    setSubmitting(false);
  };

  const canNext = (): boolean => {
    switch (step) {
      case 0: return !!company.name && !!company.slug;
      case 1: return !!adminUser.name && !!adminUser.email && adminUser.password.length >= 6;
      default: return true;
    }
  };

  return (
    <div>
      {/* Step Indicator */}
      {step < 8 && (
        <div className="mb-8 flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <button
                onClick={() => { if (i <= step) setStep(i); }}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  i < step ? "bg-[#10B981] text-white" :
                  i === step ? "bg-[#2457FF] text-white ring-2 ring-[#2457FF]/30" :
                  "bg-white/5 text-white/30"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded ${i < step ? "bg-[#10B981]" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Step Content */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
        {/* Step 0: Company */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-white">Company Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Company Name *">
                <input className={inputClass} value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value, slug: slugify(e.target.value) })} placeholder="Acme Corp" />
              </Field>
              <Field label="Slug *">
                <input className={inputClass} value={company.slug} onChange={(e) => setCompany({ ...company, slug: e.target.value })} placeholder="acme-corp" />
              </Field>
              <Field label="Industry">
                <select className={selectClass} value={company.industry} onChange={(e) => setCompany({ ...company, industry: e.target.value })}>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Currency">
                <select className={selectClass} value={company.defaultCurrency} onChange={(e) => setCompany({ ...company, defaultCurrency: e.target.value })}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Timezone">
                <select className={selectClass} value={company.timezone} onChange={(e) => setCompany({ ...company, timezone: e.target.value })}>
                  {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          </div>
        )}

        {/* Step 1: Admin User */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-white">Admin User</h2>
            <p className="text-sm text-white/50">This user will have full ADMIN access to the tenant.</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name *">
                <input className={inputClass} value={adminUser.name} onChange={(e) => setAdminUser({ ...adminUser, name: e.target.value })} placeholder="Jane Smith" />
              </Field>
              <Field label="Email *">
                <input className={inputClass} type="email" value={adminUser.email} onChange={(e) => setAdminUser({ ...adminUser, email: e.target.value })} placeholder="jane@acme.com" />
              </Field>
              <Field label="Password * (min 6 chars)">
                <input className={inputClass} value={adminUser.password} onChange={(e) => setAdminUser({ ...adminUser, password: e.target.value })} placeholder="••••••••" />
              </Field>
            </div>
          </div>
        )}

        {/* Step 2: Team Members */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Team Members</h2>
                <p className="text-sm text-white/50">Optional. Add team members now or invite them later.</p>
              </div>
              <button
                onClick={() => setMembers([...members, { name: "", email: "", role: "SDR", password: generatePassword() }])}
                className="rounded-lg bg-[#2457FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a45dd] transition-colors"
              >
                + Add Member
              </button>
            </div>
            {members.length === 0 && (
              <div className="rounded-xl border border-white/5 bg-white/2 p-8 text-center">
                <p className="text-sm text-white/30">No team members added yet</p>
              </div>
            )}
            <div className="space-y-3">
              {members.map((m, i) => (
                <div key={i} className="grid grid-cols-5 gap-3 items-end rounded-lg border border-white/5 bg-white/2 p-4">
                  <Field label="Name">
                    <input className={inputClass} value={m.name} onChange={(e) => { const arr = [...members]; arr[i].name = e.target.value; setMembers(arr); }} placeholder="John Doe" />
                  </Field>
                  <Field label="Email">
                    <input className={inputClass} value={m.email} onChange={(e) => { const arr = [...members]; arr[i].email = e.target.value; setMembers(arr); }} placeholder="john@acme.com" />
                  </Field>
                  <Field label="Role">
                    <select className={selectClass} value={m.role} onChange={(e) => { const arr = [...members]; arr[i].role = e.target.value; setMembers(arr); }}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label="Password">
                    <input className={inputClass} value={m.password} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
                  </Field>
                  <button onClick={() => setMembers(members.filter((_, j) => j !== i))} className="rounded-lg border border-red-500/30 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Pipeline */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-white">Pipeline Configuration</h2>
            <Field label="Pipeline Name">
              <input className={inputClass} value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} />
            </Field>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={labelClass}>Stages</label>
                <button
                  onClick={() => setStages([...stages, { name: "", order: stages.length + 1, color: STAGE_COLORS[stages.length % STAGE_COLORS.length], probability: 50 }])}
                  className="text-xs text-[#2457FF] hover:underline"
                >
                  + Add Stage
                </button>
              </div>
              {stages.map((s, i) => (
                <div key={i} className="grid grid-cols-5 gap-3 items-center rounded-lg border border-white/5 bg-white/2 p-3">
                  <div className="col-span-2">
                    <input className={inputClass} value={s.name} onChange={(e) => { const arr = [...stages]; arr[i].name = e.target.value; setStages(arr); }} placeholder="Stage name" />
                  </div>
                  <input type="color" value={s.color} onChange={(e) => { const arr = [...stages]; arr[i].color = e.target.value; setStages(arr); }} className="h-10 w-full rounded cursor-pointer bg-transparent" />
                  <div className="flex items-center gap-1">
                    <input className={inputClass + " text-center"} type="number" min={0} max={100} value={s.probability} onChange={(e) => { const arr = [...stages]; arr[i].probability = +e.target.value; setStages(arr); }} />
                    <span className="text-xs text-white/30">%</span>
                  </div>
                  <button onClick={() => setStages(stages.filter((_, j) => j !== i))} className="text-xs text-red-400 hover:underline">Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Modules */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-white">Module Activation</h2>
            <p className="text-sm text-white/50">Choose which modules to enable for this tenant.</p>
            <div className="grid grid-cols-2 gap-3">
              {MODULES.map((mod) => {
                const active = modules.includes(mod.key);
                return (
                  <button
                    key={mod.key}
                    onClick={() => setModules(active ? modules.filter((m) => m !== mod.key) : [...modules, mod.key])}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      active ? "border-[#2457FF] bg-[#2457FF]/10" : "border-white/10 bg-white/2 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-white">{mod.label}</span>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${active ? "border-[#2457FF] bg-[#2457FF]" : "border-white/20"}`}>
                        {active && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                      </div>
                    </div>
                    <p className="text-xs text-white/40">{mod.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 5: Branding */}
        {step === 5 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-white">Branding</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <Field label="Primary Color">
                  <div className="flex gap-3">
                    <input type="color" value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} className="h-10 w-14 rounded cursor-pointer bg-transparent" />
                    <input className={inputClass} value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} />
                  </div>
                </Field>
                <Field label="Secondary Color">
                  <div className="flex gap-3">
                    <input type="color" value={branding.secondaryColor} onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })} className="h-10 w-14 rounded cursor-pointer bg-transparent" />
                    <input className={inputClass} value={branding.secondaryColor} onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })} />
                  </div>
                </Field>
                <Field label="Logo URL (optional)">
                  <input className={inputClass} value={branding.logoUrl} onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })} placeholder="https://..." />
                </Field>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs text-white/40 mb-3">Preview</p>
                <div className="rounded-lg p-4" style={{ backgroundColor: branding.secondaryColor }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: branding.primaryColor }} />
                    <span className="text-sm font-bold text-white">{company.name || "Company Name"}</span>
                  </div>
                  <div className="h-3 w-3/4 rounded" style={{ backgroundColor: branding.primaryColor, opacity: 0.3 }} />
                  <div className="mt-2 h-3 w-1/2 rounded bg-white/10" />
                  <button className="mt-4 rounded-lg px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: branding.primaryColor }}>
                    Sample Button
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Gmail */}
        {step === 6 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-white">Gmail Integration</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setGmail({ ...gmail, enabled: !gmail.enabled })}
                className={`relative h-6 w-11 rounded-full transition-colors ${gmail.enabled ? "bg-[#2457FF]" : "bg-white/10"}`}
              >
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${gmail.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-sm text-white">{gmail.enabled ? "Enabled" : "Skip for now"}</span>
            </div>
            {gmail.enabled && (
              <div className="space-y-4 mt-4">
                <p className="text-xs text-white/40">Enter Google OAuth credentials. The client will complete OAuth setup after first login.</p>
                <Field label="Client ID">
                  <input className={inputClass} value={gmail.clientId} onChange={(e) => setGmail({ ...gmail, clientId: e.target.value })} placeholder="xxx.apps.googleusercontent.com" />
                </Field>
                <Field label="Client Secret">
                  <input className={inputClass} value={gmail.clientSecret} onChange={(e) => setGmail({ ...gmail, clientSecret: e.target.value })} placeholder="GOCSPX-xxx" />
                </Field>
              </div>
            )}
          </div>
        )}

        {/* Step 7: Review */}
        {step === 7 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-white">Review & Provision</h2>
            <div className="grid grid-cols-2 gap-4">
              <ReviewSection title="Company" items={[
                ["Name", company.name],
                ["Slug", company.slug],
                ["Industry", company.industry],
                ["Currency", company.defaultCurrency],
                ["Timezone", company.timezone],
              ]} />
              <ReviewSection title="Admin User" items={[
                ["Name", adminUser.name],
                ["Email", adminUser.email],
                ["Password", adminUser.password],
              ]} />
              <ReviewSection title="Team" items={[
                ["Members", `${members.length} additional user(s)`],
                ...members.map((m) => [m.role, `${m.name} (${m.email})`] as [string, string]),
              ]} />
              <ReviewSection title="Pipeline" items={[
                ["Name", pipelineName],
                ["Stages", stages.map((s) => s.name).join(" → ")],
              ]} />
              <ReviewSection title="Modules" items={[
                ["Active", modules.join(", ")],
              ]} />
              <ReviewSection title="Branding" items={[
                ["Primary", branding.primaryColor],
                ["Secondary", branding.secondaryColor],
                ...(branding.logoUrl ? [["Logo", "✓ Provided"] as [string, string]] : []),
              ]} color={branding.primaryColor} />
            </div>
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 8: Success */}
        {step === 8 && result && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#10B981]/20">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-white">Tenant Provisioned!</h2>
              <p className="mt-1 text-sm text-white/50">{result.organization.name} is ready to use</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Credentials</h3>
                <button
                  onClick={() => {
                    const text = result.credentials.map((c) => `${c.role}: ${c.email} / ${c.password}`).join("\n");
                    navigator.clipboard.writeText(text);
                  }}
                  className="rounded-lg bg-[#2457FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a45dd] transition-colors"
                >
                  Copy All
                </button>
              </div>
              <div className="space-y-2">
                {result.credentials.map((cred, i) => (
                  <div key={i} className="flex items-center gap-4 rounded-lg border border-white/5 bg-white/2 px-4 py-3">
                    <span className="rounded-full bg-[#2457FF]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#2457FF]">{cred.role}</span>
                    <span className="text-sm text-white font-medium flex-1">{cred.email}</span>
                    <code className="text-sm text-white/60 font-mono">{cred.password}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                <p className="text-2xl font-bold text-white">{result.teams.length}</p>
                <p className="text-xs text-white/40">Teams</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                <p className="text-2xl font-bold text-white">{result.credentials.length}</p>
                <p className="text-xs text-white/40">Users</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                <p className="text-2xl font-bold text-white">{result.pipeline.stageCount}</p>
                <p className="text-xs text-white/40">Stages</p>
              </div>
            </div>

            <div className="flex gap-3">
              <a href="/admin/tenants" className="flex-1 rounded-lg border border-white/10 px-4 py-3 text-center text-sm font-medium text-white hover:bg-white/5 transition-colors">
                View All Tenants
              </a>
              <a href="/admin/provision" onClick={() => window.location.reload()} className="flex-1 rounded-lg bg-[#2457FF] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#1a45dd] transition-colors">
                Provision Another
              </a>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        {step < 7 && (
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white transition-colors disabled:opacity-30"
            >
              Back
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30">{step + 1} of {STEPS.length}</span>
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                className="rounded-lg bg-[#2457FF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1a45dd] transition-colors disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="mt-8 flex items-center justify-between">
            <button onClick={() => setStep(6)} className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white transition-colors">
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-[#10B981] px-8 py-3 text-sm font-bold text-white hover:bg-[#0d9668] transition-colors disabled:opacity-50"
            >
              {submitting ? "Provisioning..." : "🚀 Provision Tenant"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewSection({ title, items, color }: { title: string; items: [string, string][]; color?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/2 p-4">
      <div className="flex items-center gap-2 mb-3">
        {color && <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />}
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">{title}</h3>
      </div>
      <dl className="space-y-1.5">
        {items.map(([k, v], i) => (
          <div key={i} className="flex items-start justify-between gap-2">
            <dt className="text-xs text-white/40 shrink-0">{k}</dt>
            <dd className="text-xs text-white font-medium text-right truncate">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
