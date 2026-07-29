import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  text?: string;
}

export function LoadingState({ text = "Loading..." }: LoadingStateProps) {
  return (
    <div
      data-testid="loading-state"
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <Loader2 className="h-8 w-8 text-accent animate-spin mb-3" />
      <p className="text-body-small text-text-secondary">{text}</p>
    </div>
  );
}
