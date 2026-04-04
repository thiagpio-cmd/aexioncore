"use client";

import { useState, useEffect } from "react";
import { Modal, FormField, inputStyles, selectStyles } from "@/components/shared/modal";
import { useToast } from "@/components/shared/toast";
import { apiPost } from "@/lib/hooks/use-api";

interface CreateLeadModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Pre-fill with current user's ID */
  currentUserId?: string;
}

type CompanyOption = { id: string; name: string };
type UserOption = { id: string; name: string };

export function CreateLeadModal({ open, onClose, onCreated, currentUserId }: CreateLeadModalProps) {
  const { toastSuccess, toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [companySearch, setCompanySearch] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    title: "",
    source: "web",
    status: "NEW",
    temperature: "COLD",
    fitScore: 50,
    companyId: "",
    companyName: "",
    ownerId: currentUserId || "",
  });

  // Fetch companies and users when modal opens
  useEffect(() => {
    if (!open) return;

    setLoadingCompanies(true);
    fetch("/api/accounts?limit=100")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          // Extract unique companies from accounts
          const companyMap = new Map<string, string>();
          for (const account of json.data) {
            if (account.company?.id && account.company?.name) {
              companyMap.set(account.company.id, account.company.name);
            }
          }
          setCompanies(
            Array.from(companyMap.entries()).map(([id, name]) => ({ id, name }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCompanies(false));

    setLoadingUsers(true);
    fetch("/api/users")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setUsers(
            json.data.map((u: any) => ({ id: u.id, name: u.name }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [open]);

  function set(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (!form.companyId.trim() && !form.companyName.trim()) e.companyId = "Company is required";
    if (!form.ownerId.trim()) e.ownerId = "Owner is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const { data, error } = await apiPost("/api/leads", {
      ...form,
      fitScore: Number(form.fitScore),
    });
    setSubmitting(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess("Lead created successfully");
    onCreated();
    onClose();
    // Reset form
    setForm({
      name: "", email: "", phone: "", title: "", source: "web",
      status: "NEW", temperature: "COLD", fitScore: 50,
      companyId: "", companyName: "", ownerId: currentUserId || "",
    });
    setCompanySearch("");
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Lead" description="Add a new lead to your pipeline">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Name" required error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="John Doe"
              className={inputStyles}
            />
          </FormField>
          <FormField label="Email" required error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="john@company.com"
              className={inputStyles}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Phone">
            <input
              type="text"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+1 (555) 000-0000"
              className={inputStyles}
            />
          </FormField>
          <FormField label="Title">
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="VP of Sales"
              className={inputStyles}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Source">
            <select value={form.source} onChange={(e) => set("source", e.target.value)} className={selectStyles}>
              <option value="web">Web</option>
              <option value="linkedin">LinkedIn</option>
              <option value="referral">Referral</option>
              <option value="outbound">Outbound</option>
              <option value="event">Event</option>
              <option value="partner">Partner</option>
            </select>
          </FormField>
          <FormField label="Temperature">
            <select value={form.temperature} onChange={(e) => set("temperature", e.target.value)} className={selectStyles}>
              <option value="COLD">Cold</option>
              <option value="COOL">Cool</option>
              <option value="WARM">Warm</option>
              <option value="HOT">Hot</option>
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Company" required error={errors.companyId}>
            <div className="relative">
              <input
                type="text"
                value={companySearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setCompanySearch(val);
                  setShowCompanyDropdown(true);
                  // Clear selected company when user types
                  set("companyId", "");
                  set("companyName", val);
                }}
                onFocus={() => setShowCompanyDropdown(true)}
                onBlur={() => {
                  // Delay to allow click on dropdown items
                  setTimeout(() => setShowCompanyDropdown(false), 200);
                }}
                placeholder={loadingCompanies ? "Loading companies..." : "Select or type a new company"}
                className={inputStyles}
                disabled={loadingCompanies}
              />
              {showCompanyDropdown && companySearch.trim() && (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                  {companies
                    .filter((c) =>
                      c.name.toLowerCase().includes(companySearch.toLowerCase())
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-background transition-colors"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          set("companyId", c.id);
                          set("companyName", "");
                          setCompanySearch(c.name);
                          setShowCompanyDropdown(false);
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  {!companies.some(
                    (c) => c.name.toLowerCase() === companySearch.toLowerCase()
                  ) && (
                    <div className="px-3 py-2 text-sm text-muted-foreground border-t border-border">
                      <span className="font-medium text-primary">+ Create</span>{" "}
                      &quot;{companySearch}&quot;
                    </div>
                  )}
                </div>
              )}
            </div>
          </FormField>
          <FormField label="Owner" required error={errors.ownerId}>
            <select
              value={form.ownerId}
              onChange={(e) => set("ownerId", e.target.value)}
              className={selectStyles}
              disabled={loadingUsers}
            >
              <option value="">
                {loadingUsers ? "Loading users..." : "Select owner"}
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
              {/* Fallback: if users couldn't load but we have currentUserId */}
              {users.length === 0 && currentUserId && (
                <option value={currentUserId}>Current User</option>
              )}
            </select>
          </FormField>
        </div>

        <FormField label={`Fit Score: ${form.fitScore}`}>
          <input
            type="range"
            min="0"
            max="100"
            value={form.fitScore}
            onChange={(e) => set("fitScore", Number(e.target.value))}
            className="w-full accent-primary"
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Lead"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
