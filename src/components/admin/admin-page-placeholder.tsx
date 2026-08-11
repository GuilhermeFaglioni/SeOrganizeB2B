"use client";

import { EmptyState } from "@/components/shared/empty-state";
import type { LucideIcon } from "lucide-react";

interface AdminPagePlaceholderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  testId: string;
}

export function AdminPagePlaceholder({
  title,
  description,
  icon,
  testId,
}: AdminPagePlaceholderProps) {
  return (
    <div data-testid={testId} className="p-6">
      <EmptyState icon={icon} title={title} description={description} />
    </div>
  );
}
