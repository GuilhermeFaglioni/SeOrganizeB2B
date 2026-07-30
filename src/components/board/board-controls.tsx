"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useAreas } from "@/hooks/use-areas";
import { useProfiles } from "@/hooks/use-profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

export interface BoardControlValues {
  assignee: string | null;
  areas: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  sort: string;
  group: string;
}

export function BoardControls({
  values,
  onChange,
  onClear,
}: {
  values: BoardControlValues;
  onChange: (key: keyof BoardControlValues, value: string | null) => void;
  onClear: () => void;
}) {
  const { data: profiles = [] } = useProfiles();
  const { data: areas = [] } = useAreas();
  const activeControlCount = [
    values.assignee,
    values.areas,
    values.dateFrom,
    values.dateTo,
    values.sort !== "manual" ? values.sort : null,
    values.group !== "workflow" ? values.group : null,
  ].filter(Boolean).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filtros</span>
          {activeControlCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white">
              {activeControlCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[calc(100vh-8rem)] w-[calc(100vw-2rem)] overflow-y-auto p-4 sm:w-[680px]"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Filtros e visualização
            </p>
            <p className="text-xs text-text-muted">
              Alterações são aplicadas imediatamente.
            </p>
          </div>
          {activeControlCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={onClear}
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="mb-1 block text-[11px] font-medium text-text-secondary">
              Responsável
            </span>
            <Select
              value={values.assignee || ALL}
              onValueChange={(value) =>
                onChange("assignee", value === ALL ? null : value)
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as pessoas</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name || profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <span className="mb-1 block text-[11px] font-medium text-text-secondary">
              Team area
            </span>
            <Select
              value={values.areas || ALL}
              onValueChange={(value) =>
                onChange("areas", value === ALL ? null : value)
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as áreas</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label>
            <span className="mb-1 block text-[11px] font-medium text-text-secondary">
              Prazo inicial
            </span>
            <Input
              className="h-9"
              type="date"
              value={values.dateFrom || ""}
              onChange={(event) =>
                onChange("dateFrom", event.target.value || null)
              }
            />
          </label>

          <label>
            <span className="mb-1 block text-[11px] font-medium text-text-secondary">
              Prazo final
            </span>
            <Input
              className="h-9"
              type="date"
              min={values.dateFrom || undefined}
              value={values.dateTo || ""}
              onChange={(event) =>
                onChange("dateTo", event.target.value || null)
              }
            />
          </label>

          <div>
            <span className="mb-1 block text-[11px] font-medium text-text-secondary">
              Ordenar
            </span>
            <Select
              value={values.sort}
              onValueChange={(value) => onChange("sort", value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Ordem manual</SelectItem>
                <SelectItem value="priority">Prioridade</SelectItem>
                <SelectItem value="dueDate">Prazo</SelectItem>
                <SelectItem value="title">Título</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <span className="mb-1 block text-[11px] font-medium text-text-secondary">
              Agrupar
            </span>
            <Select
              value={values.group}
              onValueChange={(value) => onChange("group", value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workflow">Sem agrupamento</SelectItem>
                <SelectItem value="assignee">Pessoa principal</SelectItem>
                <SelectItem value="area">Team area</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
