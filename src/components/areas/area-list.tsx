"use client";

import { useAreas, useAreaImpact } from "@/hooks/use-areas";
import { AreaBadge } from "@/components/areas/area-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Pencil, Trash2, Layers } from "lucide-react";

interface AreaListProps {
  onEdit: (area: { id: string; name: string; color: string | null }) => void;
  onDelete: (area: { id: string; name: string }) => void;
}

function AreaRow({
  area,
  onEdit,
  onDelete,
}: {
  area: { id: string; name: string; color: string | null };
  onEdit: AreaListProps["onEdit"];
  onDelete: AreaListProps["onDelete"];
}) {
  const { data: impact } = useAreaImpact(area.id);

  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <AreaBadge name={area.name} color={area?.color} />
        <span className="text-sm text-text-primary font-medium">{area.name}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 text-body-small text-text-secondary">
          <span>{impact?.tasks ?? "—"} tasks</span>
          <span>{impact?.projects ?? "—"} projects</span>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(area)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(area)}>
            <Trash2 className="w-4 h-4 text-danger" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AreaList({ onEdit, onDelete }: AreaListProps) {
  const { data: areas, isLoading } = useAreas();

  if (isLoading) {
    return <div className="py-8 text-center text-body-small text-text-secondary">Loading...</div>;
  }

  if (!areas || areas.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No areas yet"
        description="Create your first team area to organize projects and tasks."
      />
    );
  }

  return (
    <div data-testid="area-list" className="border border-border rounded-lg bg-page-alt">
      {areas.map((area) => (
        <AreaRow key={area.id} area={area} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
