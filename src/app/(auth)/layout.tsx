"use client";

import { AuthProvider } from "@/lib/auth-context";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-[440px]">
          <div className="rounded-xl bg-surface px-8 py-10 shadow-lg">
            {children}
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
