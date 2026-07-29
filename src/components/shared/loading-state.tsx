import { Loader2 } from "lucide-react";
import { SkeletonCard } from "@/components/shared/skeleton";

interface LoadingStateProps {
  text?: string;
  skeleton?: boolean;
}

export function LoadingState({ text = "Loading...", skeleton = true }: LoadingStateProps) {
  if (skeleton) {
    return (
      <div data-testid="loading-state" className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-32 bg-bg-secondary rounded animate-pulse" />
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
      <Loader2 className="h-8 w-8 text-accent motion-safe:animate-spin mb-3" />
      <p className="text-body-small text-text-secondary">{text}</p>
    </div>
  );
}
