"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

export interface ContractFiltersValue {
  search?: string;
  status?: string;
  clientId?: string;
  projectId?: string;
}

export function ContractSearchFilters({
  values,
  onChange,
  clients,
  projects,
}: {
  values: ContractFiltersValue;
  onChange: (next: ContractFiltersValue) => void;
  clients?: Array<{ id: string; name: string }>;
  projects?: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("financial.contracts.searchFilters");
  const [query, setQuery] = useState(values.search ?? "");
  const statuses = ["draft", "active", "closed", "cancelled", "suspended"];

  function submitSearch() {
    onChange({ ...values, search: query.trim() || undefined });
  }

  return (
    <div className="flex flex-wrap items-center gap-3" role="search" aria-label={t("filtersLabel")}>
      <div className="flex items-center gap-2">
        <label htmlFor="contract-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <input
          id="contract-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitSearch();
          }}
          placeholder={t("searchPlaceholder")}
          className="w-56 rounded-md border border-border bg-page-alt px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        />
        <button
          type="button"
          onClick={submitSearch}
          className="flex min-h-[44px] items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          aria-label={t("searchLabel")}
        >
          <Search size={16} aria-hidden="true" />
        </button>
      </div>

      <label className="text-sm text-text-secondary">
        {t("statusFilterLabel")}
        <select
          value={values.status ?? ""}
          onChange={(event) =>
            onChange({ ...values, status: event.target.value || undefined })
          }
          className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          <option value="">{t("allStatuses")}</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      {clients && clients.length > 0 && (
        <label className="text-sm text-text-secondary">
          {t("clientFilterLabel")}
          <select
            value={values.clientId ?? ""}
            onChange={(event) =>
              onChange({ ...values, clientId: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <option value="">{t("allClients")}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {projects && projects.length > 0 && (
        <label className="text-sm text-text-secondary">
          {t("projectFilterLabel")}
          <select
            value={values.projectId ?? ""}
            onChange={(event) =>
              onChange({ ...values, projectId: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <option value="">{t("allProjects")}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
