import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      {Icon && (
        <div className="mb-4 text-text-muted">
          <Icon className="h-12 w-12" />
        </div>
      )}
      <h3 className="text-display text-text-primary mb-2">{title}</h3>
      {description && (
        <p className="text-body-small text-text-secondary max-w-sm mb-6">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}
