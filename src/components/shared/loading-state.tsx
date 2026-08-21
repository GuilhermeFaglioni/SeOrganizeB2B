"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { SkeletonCard } from "@/components/shared/skeleton";

interface LoadingStateProps {
  text?: string;
  skeleton?: boolean;
}

export function LoadingState({ text, skeleton = true }: LoadingStateProps) {
  const t = useTranslations("shared.loadingState");
  const label = text ?? t("loading");
  if (skeleton) {
    return (
      <div data-testid="loading-state" className="p-4" role="status" aria-live="polite">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-32 animate-pulse rounded-balsa-control bg-balsa-muted" />
        </div>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div
      data-testid="loading-state"
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <Loader2 className="mb-3 h-8 w-8 text-balsa-primary motion-safe:animate-spin" />
      <p className="text-balsa-sm text-balsa-muted-foreground">{label}</p>
    </div>
  );
}
