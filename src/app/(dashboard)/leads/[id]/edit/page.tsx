"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function LeadEditRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  useEffect(() => {
    router.replace(`/leads/${leadId}?edit=true`);
  }, [router, leadId]);

  return null;
}
