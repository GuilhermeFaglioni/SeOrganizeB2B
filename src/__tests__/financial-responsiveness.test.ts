import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("financial responsiveness and accessibility", () => {
  it("wraps tables in horizontal scroll containers", () => {
    for (const file of [
      "src/components/financial/contracts/contract-list.tsx",
      "src/components/financial/receivables/receivables-list.tsx",
      "src/components/financial/clients/client-list.tsx",
      "src/components/financial/contracts/contract-detail.tsx",
    ]) {
      const source = read(file);
      expect(source).toContain("overflow-x-auto");
      expect(source).toContain("min-w-[");
    }
  });

  it("uses responsive KPI grids that collapse on mobile", () => {
    const overview = read("src/components/financial/overview/overview-page.tsx");
    expect(overview).toContain("grid-cols-1");
    expect(overview).toContain("sm:grid-cols-2");
    expect(overview).toContain("xl:grid-cols-4");
  });

  it("labels every filter input and search field", () => {
    const filters = read("src/components/financial/overview/financial-filters.tsx");
    expect(filters).toContain("<label");
    const search = read("src/components/financial/contracts/contract-search-filters.tsx");
    expect(search).toContain('htmlFor="contract-search"');
  });

  it("keeps 44px minimum touch targets on controls", () => {
    const tabs = read("src/components/financial/financial-tabs.tsx");
    expect(tabs).toContain("min-h-[44px]");
    const csv = read("src/components/financial/contracts/csv-export-button.tsx");
    expect(csv).toContain("min-h-[44px]");
  });

  it("associates semantic labels and announces list state", () => {
    const list = read("src/components/financial/contracts/contract-list.tsx");
    expect(list).toContain('scope="col"');
    expect(list).toContain("<caption");
    const pagination = read("src/components/financial/contracts/pagination.tsx");
    expect(pagination).toContain("aria-live");
    expect(pagination).toContain('aria-label={t("previousAria")}');
  });

  it("renders loading, empty, error and validation feedback states", () => {
    const overview = read("src/components/financial/overview/overview-page.tsx");
    expect(overview).toContain("LoadingState");
    expect(overview).toContain("FinancialEmptyState");
    expect(overview).toContain("FinancialErrorState");
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain('role="alert"');
  });

  it("adds aria-live to KPI grid for screen reader announcements", () => {
    const overview = read("src/components/financial/overview/overview-page.tsx");
    expect(overview).toContain('aria-live="polite"');
    expect(overview).toContain('aria-label={t("kpisAriaLabel")}');
  });

  it("adds focus-visible ring classes to interactive controls", () => {
    const search = read("src/components/financial/contracts/contract-search-filters.tsx");
    expect(search).toContain("focus-visible:ring-2");
    expect(search).toContain("focus-visible:ring-accent");
    const tabs = read("src/components/financial/financial-tabs.tsx");
    expect(tabs).toContain("focus-visible:ring-2");
    const pagination = read("src/components/financial/contracts/pagination.tsx");
    expect(pagination).toContain("focus-visible:ring-2");
  });

  it("uses navigation semantics (not ARIA tabs) for financial section links", () => {
    const tabs = read("src/components/financial/financial-tabs.tsx");
    expect(tabs).toContain('aria-label={t("sections")}');
    expect(tabs).toContain("aria-current");
    expect(tabs).not.toContain('role="tablist"');
    expect(tabs).not.toContain('role="tab"');
    expect(tabs).not.toContain("aria-selected");
  });

  it("adds ARIA tab semantics to receivables status tabs", () => {
    const receivables = read("src/components/financial/receivables/receivables-list.tsx");
    expect(receivables).toContain('role="tablist"');
    expect(receivables).toContain('aria-label={t("statusLabel")}');
    expect(receivables).toContain('role="tab"');
    expect(receivables).toContain("aria-selected");
  });

  it("adds htmlFor/id associations to change dialog inputs", () => {
    const dialog = read("src/components/financial/contracts/change-dialog.tsx");
    expect(dialog).toContain('htmlFor="change-type"');
    expect(dialog).toContain('id="change-type"');
    expect(dialog).toContain('htmlFor="change-strategy"');
    expect(dialog).toContain('id="change-strategy"');
    expect(dialog).toContain('htmlFor="change-delta"');
    expect(dialog).toContain('id="change-delta"');
    expect(dialog).toContain('htmlFor="change-effective-date"');
    expect(dialog).toContain('id="change-effective-date"');
    expect(dialog).toContain('htmlFor="change-description"');
    expect(dialog).toContain('id="change-description"');
  });

  it("adds htmlFor/id associations to refund dialog inputs", () => {
    const actions = read("src/components/financial/receivables/installment-actions.tsx");
    expect(actions).toContain('htmlFor="refund-amount"');
    expect(actions).toContain('id="refund-amount"');
    expect(actions).toContain('htmlFor="refund-date"');
    expect(actions).toContain('id="refund-date"');
  });

  it("adds aria-expanded to contract form collapsible sections", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain('aria-expanded={sectionsOpen.contract}');
    expect(form).toContain('aria-expanded={sectionsOpen.scope}');
    expect(form).toContain('aria-expanded={sectionsOpen.projects}');
    expect(form).toContain('aria-expanded={sectionsOpen.billing}');
  });

  it("adds aria-labelledby to contract form sections", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain('aria-labelledby="contract-data-heading"');
    expect(form).toContain('aria-labelledby="scope-heading"');
    expect(form).toContain('aria-labelledby="projects-heading"');
    expect(form).toContain('aria-labelledby="billing-heading"');
    expect(form).toContain('id="contract-data-heading"');
    expect(form).toContain('id="scope-heading"');
    expect(form).toContain('id="projects-heading"');
    expect(form).toContain('id="billing-heading"');
  });

  it("adds role=status to loading and empty states", () => {
    const loading = read("src/components/shared/loading-state.tsx");
    expect(loading).toContain('role="status"');
    expect(loading).toContain('aria-live="polite"');
    const empty = read("src/components/financial/shared/empty-state.tsx");
    expect(empty).toContain('role="status"');
  });

  it("adds role=alert to error state", () => {
    const error = read("src/components/financial/shared/error-state.tsx");
    expect(error).toContain('role="alert"');
  });

  it("adds aria-label to all data tables", () => {
    const contractList = read("src/components/financial/contracts/contract-list.tsx");
    expect(contractList).toContain('aria-label={t("tableLabel")}');
    const receivables = read("src/components/financial/receivables/receivables-list.tsx");
    expect(receivables).toContain('aria-label={t("tableLabel")}');
    const clientList = read("src/components/financial/clients/client-list.tsx");
    expect(clientList).toContain('aria-label={t("tableLabel")}');
    const detail = read("src/components/financial/contracts/contract-detail.tsx");
    expect(detail).toContain('aria-label={t("itemsAria")}');
    expect(detail).toContain('aria-label={t("installmentsAria")}');
    expect(detail).toContain('aria-label={t("changesAria")}');
    expect(detail).toContain('aria-label={t("auditAria")}');
    const clientDetail = read("src/components/financial/clients/client-detail.tsx");
    expect(clientDetail).toContain('aria-label={t("contractHistoryLabel")}');
  });

  it("adds aria-label to list containers", () => {
    const overview = read("src/components/financial/overview/overview-page.tsx");
    expect(overview).toContain('aria-label={t("overdueListAria")}');
    expect(overview).toContain('aria-label={t("expiringListAria")}');
    const contractDetail = read("src/components/financial/contracts/contract-detail.tsx");
    expect(contractDetail).toContain('aria-label={t("linkedProjectsAria")}');
    expect(contractDetail).toContain('aria-label={t("auditAria")}');
  });

  it("adds role=search to filter areas", () => {
    const search = read("src/components/financial/contracts/contract-search-filters.tsx");
    expect(search).toContain('role="search"');
    expect(search).toContain('aria-label={t("filtersLabel")}');
    const clientList = read("src/components/financial/clients/client-list.tsx");
    expect(clientList).toContain('role="search"');
    expect(clientList).toContain('aria-label={t("searchFiltersLabel")}');
  });

  it("adds aria-label to client detail summary cards", () => {
    const detail = read("src/components/financial/clients/client-detail.tsx");
    expect(detail).toContain('aria-label={t("contractCountLabel")}');
    expect(detail).toContain('aria-label={t("activeValueLabel")}');
    expect(detail).toContain('aria-label={t("projectsCountLabel")}');
    expect(detail).toContain('id="client-summary"');
  });

  it("adds aria-hidden to decorative chart legend swatches", () => {
    const chart = read("src/components/financial/overview/forecast-received-chart.tsx");
    expect(chart).toContain('aria-hidden="true"');
  });

  it("adds aria-label to inactive client rows", () => {
    const list = read("src/components/financial/clients/client-list.tsx");
    expect(list).toContain("aria-label={!client.active");
  });

  it("adds search hint to empty contract list", () => {
    const list = read("src/components/financial/contracts/contract-list.tsx");
    expect(list).toContain('hint={filters.search');
  });

  it("adds aria-live to list results areas", () => {
    const contractList = read("src/components/financial/contracts/contract-list.tsx");
    expect(contractList).toContain('aria-live="polite"');
    const receivables = read("src/components/financial/receivables/receivables-list.tsx");
    expect(receivables).toContain('aria-live="polite"');
    const clientList = read("src/components/financial/clients/client-list.tsx");
    expect(clientList).toContain('aria-live="polite"');
  });

  it("adds focus-visible ring classes to date inputs in financial filters", () => {
    const filters = read("src/components/financial/overview/financial-filters.tsx");
    expect(filters).toContain("focus-visible:ring-2");
    expect(filters).toContain("focus-visible:ring-accent");
  });

  it("adds global filter selects to overview page", () => {
    const overview = read("src/components/financial/overview/overview-page.tsx");
    expect(overview).toContain("useProjects");
    expect(overview).toContain("useClients");
    expect(overview).toContain('t("contractStatus")');
    expect(overview).toContain('t("installmentStatus")');
    expect(overview).toContain('aria-label={t("globalFilters")}');
  });
});
