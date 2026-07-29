import { cn } from "@/lib/utils";

interface AreaBadgeProps {
  name: string;
  color?: string | null;
  compact?: boolean;
}

export function AreaBadge({ name, color, compact }: AreaBadgeProps) {
  const dotColor = color || "#3b82f6";

  if (compact) {
    return (
      <span
        data-testid="area-badge"
        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
        title={name}
      />
    );
  }

  return (
    <span
      data-testid="area-badge"
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-medium"
      )}
      style={{
        backgroundColor: `${dotColor}15`,
        color: dotColor,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      {name}
    </span>
  );
}
