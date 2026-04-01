"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useOrg } from "@/lib/org-context";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useToast } from "@/components/shared/toast";
import { GlassCard } from "@/components/design-system/GlassCard";
import { SectionLabel } from "@/components/design-system/SectionLabel";
import { MetricValue } from "@/components/design-system/MetricValue";
import { StatusDot } from "@/components/design-system/StatusDot";

const PRESET_COLORS = [
  { label: "Neutro", hex: "#B0ACA5" },
  { label: "Slate", hex: "#94A3B8" },
  { label: "Blue", hex: "#3B82F6" },
  { label: "Emerald", hex: "#10B981" },
  { label: "Amber", hex: "#F59E0B" },
  { label: "Rose", hex: "#F43F5E" },
  { label: "Violet", hex: "#8B5CF6" },
  { label: "Stone", hex: "#78716C" },
];

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(176, 172, 165, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getRelativeLuminance(hex: string): number {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

export default function BrandingSettingsPage() {
  const { org, refresh } = useOrg();
  const { theme, setTheme } = useTheme();
  const { toastSuccess, toastError } = useToast();
  const [saving, setSaving] = useState(false);
  const [contrastWarning, setContrastWarning] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    displayName: "",
    logoUrl: "",
    brandLogoMarkUrl: "",
    brandAccentColor: "#B0ACA5",
    brandThemeDefault: "dark" as "dark" | "light",
  });

  useEffect(() => {
    if (org.id) {
      const extended = org as unknown as Record<string, unknown>;
      setForm({
        displayName: org.displayName || org.name || "",
        logoUrl: org.logoUrl || "",
        brandLogoMarkUrl: (extended.brandLogoMarkUrl as string) || "",
        brandAccentColor: (extended.brandAccentColor as string) || org.primaryColor || "#B0ACA5",
        brandThemeDefault: ((extended.brandThemeDefault as string) || "dark") as "dark" | "light",
      });
    }
  }, [org]);

  // Contrast validation
  useEffect(() => {
    if (!isValidHex(form.brandAccentColor)) {
      setContrastWarning("");
      return;
    }
    const lum = getRelativeLuminance(form.brandAccentColor);
    if (form.brandThemeDefault === "dark" && lum < 0.05) {
      setContrastWarning("Cor muito escura para o modo dark. Visibilidade pode ser prejudicada.");
    } else if (form.brandThemeDefault === "light" && lum > 0.9) {
      setContrastWarning("Cor muito clara para o modo light. Visibilidade pode ser prejudicada.");
    } else {
      setContrastWarning("");
    }
  }, [form.brandAccentColor, form.brandThemeDefault]);

  const handleSave = async () => {
    if (!isValidHex(form.brandAccentColor)) {
      toastError("Cor hexadecimal invalida");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          logoUrl: form.logoUrl || null,
          primaryColor: form.brandAccentColor,
          brandAccentColor: form.brandAccentColor,
          brandLogoMarkUrl: form.brandLogoMarkUrl || null,
          brandThemeDefault: form.brandThemeDefault,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toastSuccess("Branding atualizado");
        refresh();
      } else {
        toastError(data.error?.message || "Falha ao salvar");
      }
    } catch {
      toastError("Erro de rede");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({
      displayName: org.name || "",
      logoUrl: "",
      brandLogoMarkUrl: "",
      brandAccentColor: "#B0ACA5",
      brandThemeDefault: "dark",
    });
  };

  const handleFileDrop = useCallback(
    (field: "logoUrl" | "brandLogoMarkUrl") => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        setForm((f) => ({ ...f, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleFileChange = useCallback(
    (field: "logoUrl" | "brandLogoMarkUrl") => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        setForm((f) => ({ ...f, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    },
    []
  );

  // Preview accent styles
  const previewAccent = isValidHex(form.brandAccentColor) ? form.brandAccentColor : "#B0ACA5";

  return (
    <div className="mx-auto max-w-3xl" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2xl)" }}>
      <div>
        <h1 style={{ fontSize: "20px", fontWeight: 500, color: "var(--text-primary)" }}>
          Branding
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-tertiary)", marginTop: "var(--space-xs)" }}>
          Personalize a aparencia do seu workspace.
        </p>
      </div>

      {/* Live Preview */}
      <GlassCard elevated>
        <SectionLabel>Preview</SectionLabel>
        <div style={{ marginTop: "var(--space-lg)" }}>
          {/* Mini nav preview */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-lg)",
              padding: "var(--space-md) 0",
              borderBottom: "0.5px solid var(--border-subtle)",
              marginBottom: "var(--space-lg)",
            }}
          >
            {form.logoUrl ? (
              <img
                src={form.logoUrl}
                alt="Logo"
                style={{ maxHeight: "20px", width: "auto" }}
              />
            ) : (
              <span
                style={{
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: previewAccent,
                  fontSize: "12px",
                }}
              >
                {(form.displayName || "AEXION").toUpperCase()}
              </span>
            )}
            <span
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text-primary)",
                borderBottom: `1.5px solid ${previewAccent}`,
                paddingBottom: "2px",
              }}
            >
              Dashboard
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-ghost)" }}>Pipeline</span>
          </div>
          {/* Mini cards preview */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            <GlassCard accent>
              <MetricValue value="R$ 2.4M" label="Pipeline" size="small" />
            </GlassCard>
            <GlassCard success>
              <StatusDot status="success" size="sm" label="Saudavel" />
              <div style={{ marginTop: "var(--space-sm)" }}>
                <MetricValue value="85" label="Health Score" size="small" />
              </div>
            </GlassCard>
            <GlassCard danger>
              <StatusDot status="danger" size="sm" label="Risco" />
              <div style={{ marginTop: "var(--space-sm)" }}>
                <MetricValue value="3" label="Alertas" size="small" />
              </div>
            </GlassCard>
          </div>
        </div>
      </GlassCard>

      {/* Display Name */}
      <GlassCard>
        <SectionLabel>Nome de Exibicao</SectionLabel>
        <div style={{ marginTop: "var(--space-md)" }}>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            placeholder="Nome da empresa"
            style={{
              width: "100%",
              padding: "var(--space-sm) var(--space-md)",
              borderRadius: "var(--radius-sm)",
              border: "0.5px solid var(--border-default)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>
      </GlassCard>

      {/* Accent Color */}
      <GlassCard>
        <SectionLabel>Cor Accent</SectionLabel>
        <div style={{ marginTop: "var(--space-md)" }}>
          {/* Presets */}
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", marginBottom: "var(--space-md)" }}>
            {PRESET_COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => setForm((f) => ({ ...f, brandAccentColor: c.hex }))}
                title={c.label}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: c.hex,
                  border: form.brandAccentColor === c.hex
                    ? "2px solid var(--text-primary)"
                    : "2px solid transparent",
                  cursor: "pointer",
                  transition: "border-color var(--transition-default)",
                }}
              />
            ))}
          </div>
          {/* Custom hex */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
            <input
              type="color"
              value={isValidHex(form.brandAccentColor) ? form.brandAccentColor : "#B0ACA5"}
              onChange={(e) => setForm((f) => ({ ...f, brandAccentColor: e.target.value }))}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-sm)",
                border: "0.5px solid var(--border-default)",
                cursor: "pointer",
                background: "none",
                padding: 0,
              }}
            />
            <input
              type="text"
              value={form.brandAccentColor}
              onChange={(e) => setForm((f) => ({ ...f, brandAccentColor: e.target.value }))}
              placeholder="#B0ACA5"
              style={{
                width: "120px",
                padding: "var(--space-sm) var(--space-md)",
                borderRadius: "var(--radius-sm)",
                border: "0.5px solid var(--border-default)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                fontSize: "13px",
                fontFamily: "var(--font-mono)",
                outline: "none",
              }}
            />
            {/* Preview swatch */}
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: previewAccent,
              }}
            />
          </div>
          {contrastWarning && (
            <p style={{ fontSize: "12px", color: "var(--color-warning)", marginTop: "var(--space-sm)" }}>
              {contrastWarning}
            </p>
          )}
        </div>
      </GlassCard>

      {/* Logo Upload */}
      <GlassCard>
        <SectionLabel>Logo</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)", marginTop: "var(--space-md)" }}>
          {/* Full logo */}
          <div>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "var(--space-sm)" }}>
              Logo completa
            </p>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop("logoUrl")}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "1px dashed var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-xl)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "80px",
                cursor: "pointer",
                transition: "border-color var(--transition-default)",
              }}
            >
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" style={{ maxHeight: "36px", width: "auto" }} />
              ) : (
                <span style={{ fontSize: "12px", color: "var(--text-ghost)" }}>
                  Arraste ou clique
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange("logoUrl")}
                style={{ display: "none" }}
              />
            </div>
            {form.logoUrl && (
              <input
                type="url"
                value={form.logoUrl.startsWith("data:") ? "" : form.logoUrl}
                onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                placeholder="ou insira URL"
                style={{
                  width: "100%",
                  padding: "var(--space-xs) var(--space-sm)",
                  borderRadius: "var(--radius-sm)",
                  border: "0.5px solid var(--border-default)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  fontSize: "11px",
                  marginTop: "var(--space-sm)",
                  outline: "none",
                }}
              />
            )}
          </div>
          {/* Logomark */}
          <div>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "var(--space-sm)" }}>
              Logomark (icone)
            </p>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop("brandLogoMarkUrl")}
              onClick={() => markInputRef.current?.click()}
              style={{
                border: "1px dashed var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-xl)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "80px",
                cursor: "pointer",
                transition: "border-color var(--transition-default)",
              }}
            >
              {form.brandLogoMarkUrl ? (
                <img src={form.brandLogoMarkUrl} alt="Mark" style={{ maxHeight: "36px", width: "auto" }} />
              ) : (
                <span style={{ fontSize: "12px", color: "var(--text-ghost)" }}>
                  Arraste ou clique
                </span>
              )}
              <input
                ref={markInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange("brandLogoMarkUrl")}
                style={{ display: "none" }}
              />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Theme Default */}
      <GlassCard>
        <SectionLabel>Tema Padrao</SectionLabel>
        <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-md)" }}>
          <button
            onClick={() => {
              setForm((f) => ({ ...f, brandThemeDefault: "dark" }));
              setTheme("dark");
            }}
            style={{
              flex: 1,
              padding: "var(--space-md)",
              borderRadius: "var(--radius-md)",
              border: form.brandThemeDefault === "dark"
                ? `1.5px solid ${previewAccent}`
                : "1px solid var(--border-default)",
              background: form.brandThemeDefault === "dark" ? hexToRgba(previewAccent, 0.06) : "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: "13px",
              fontWeight: form.brandThemeDefault === "dark" ? 500 : 400,
              cursor: "pointer",
              transition: "all var(--transition-default)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <span style={{ width: "20px", height: "14px", borderRadius: "3px", background: "#08080A", border: "1px solid rgba(255,255,255,0.1)", display: "inline-block" }} />
              Dark
            </div>
          </button>
          <button
            onClick={() => {
              setForm((f) => ({ ...f, brandThemeDefault: "light" }));
              setTheme("light");
            }}
            style={{
              flex: 1,
              padding: "var(--space-md)",
              borderRadius: "var(--radius-md)",
              border: form.brandThemeDefault === "light"
                ? `1.5px solid ${previewAccent}`
                : "1px solid var(--border-default)",
              background: form.brandThemeDefault === "light" ? hexToRgba(previewAccent, 0.06) : "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: "13px",
              fontWeight: form.brandThemeDefault === "light" ? 500 : 400,
              cursor: "pointer",
              transition: "all var(--transition-default)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <span style={{ width: "20px", height: "14px", borderRadius: "3px", background: "#FAF9F6", border: "1px solid rgba(0,0,0,0.1)", display: "inline-block" }} />
              Light
            </div>
          </button>
        </div>
      </GlassCard>

      {/* Actions */}
      <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "flex-end" }}>
        <button
          onClick={handleReset}
          style={{
            padding: "var(--space-sm) var(--space-xl)",
            borderRadius: "var(--radius-sm)",
            border: "0.5px solid var(--border-default)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: "13px",
            fontWeight: 400,
            cursor: "pointer",
            transition: "border-color var(--transition-default)",
          }}
        >
          Restaurar Padrao
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "var(--space-sm) var(--space-xl)",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: previewAccent,
            color: "#FFFFFF",
            fontSize: "13px",
            fontWeight: 500,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.5 : 1,
            transition: "opacity var(--transition-default)",
          }}
        >
          {saving ? "Salvando..." : "Salvar Branding"}
        </button>
      </div>
    </div>
  );
}
