"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";

interface Area {
  id: string;
  name: string;
  color: string | null;
}

interface AreaFilterProps {
  areas: Area[];
  selected: string[];
  onToggle: (areaId: string) => void;
}

export function AreaFilter({ areas, selected, onToggle }: AreaFilterProps) {
  const t = useTranslations("areas.filter");
  if (areas.length === 0) return null;

  return (
    <div data-testid="area-filter" className="px-4 py-3 space-y-2">
      <span className="text-label text-sidebar-text-muted uppercase tracking-wider">
        {t("teamAreas")}
      </span>
      <div className="space-y-1.5">
        {areas.map((area) => (
          <label
            key={area.id}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <Checkbox
              checked={selected.includes(area.id)}
              onCheckedChange={() => onToggle(area.id)}
              className="border-sidebar-text-muted data-[state=checked]:bg-accent data-[state=checked]:border-accent"
            />
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: area?.color || "#3b82f6" }}
            />
            <span className="text-sm text-sidebar-text-muted group-hover:text-sidebar-text transition-colors">
              {area.name}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
