"use client";

import dynamic from "next/dynamic";

const ProvisionWizard = dynamic(() => import("@/components/admin/provision-wizard").then(m => m.ProvisionWizard), { ssr: false });

export default function ProvisionPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Provision New Tenant</h1>
        <p className="mt-1 text-sm text-white/50">Create a new client organization with all required configuration</p>
      </div>
      <ProvisionWizard />
    </div>
  );
}
