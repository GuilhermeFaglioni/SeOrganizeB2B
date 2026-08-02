"use client";

import { FinancialTabs } from "@/components/financial/financial-tabs";

export default function FinancialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <FinancialTabs />
      {children}
    </div>
  );
}
