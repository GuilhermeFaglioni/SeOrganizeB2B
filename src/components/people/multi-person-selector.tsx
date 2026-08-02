"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PersonSummary } from "./avatar-group";

export type PersonOption = PersonSummary;

export function MultiPersonSelector({
  people,
  value,
  onValueChange,
  disabled,
}: {
  people: PersonOption[];
  value: string[];
  onValueChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("people.selector");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = useMemo(
    () => new Set(value),
    [value]
  );
  const visiblePeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return people;
    return people.filter((person) =>
      `${person.name ?? ""} ${person.email}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [people, query]);

  function toggle(id: string) {
    onValueChange(
      selected.has(id) ? value.filter((item) => item !== id) : [...value, id]
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Users className="h-4 w-4 text-text-secondary" />
            <span className="truncate">
              {value.length === 0
                ? t("unassigned")
                : t("personCount", { count: value.length })}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-2">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-8"
          />
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {visiblePeople.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-text-secondary">
              {t("noPeopleFound")}
            </p>
          )}
          {visiblePeople.map((person) => {
            const isSelected = selected.has(person.id);
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => toggle(person.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                  isSelected ? "bg-brand-50" : "hover:bg-page"
                )}
              >
                <Avatar className="h-8 w-8">
                  {person.avatarUrl && (
                    <AvatarImage
                      src={person.avatarUrl}
                      alt={person.name || person.email}
                    />
                  )}
                  <AvatarFallback className="bg-brand-100 text-xs text-brand-700">
                    {(person.name || person.email).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text-primary">
                    {person.name || person.email}
                  </span>
                  {person.name && (
                    <span className="block truncate text-xs text-text-secondary">
                      {person.email}
                    </span>
                  )}
                </span>
                <Check
                  className={cn(
                    "h-4 w-4 text-brand-600",
                    !isSelected && "opacity-0"
                  )}
                />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
