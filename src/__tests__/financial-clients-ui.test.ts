import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("clients UI", () => {
  it("keeps the clients routes present", () => {
    for (const page of [
      "src/app/(authenticated)/financial/clients/page.tsx",
      "src/app/(authenticated)/financial/clients/new/page.tsx",
      "src/app/(authenticated)/financial/clients/[clientId]/page.tsx",
      "src/app/(authenticated)/financial/clients/[clientId]/edit/page.tsx",
    ]) {
      expect(exists(page), page).toBe(true);
    }
  });

  it("lists clients with search and pagination", () => {
    const list = read("src/components/financial/clients/client-list.tsx");
    expect(list).toContain("useClients");
    expect(list).toContain("search");
    expect(list).toContain("Pagination");
  });

  it("consolidates contract and revenue history on the detail", () => {
    const detail = read("src/components/financial/clients/client-detail.tsx");
    expect(detail).toContain("contracts");
    expect(detail).toContain('t("historyTitle")');
  });

  it("deactivates instead of deleting clients", () => {
    const detail = read("src/components/financial/clients/client-detail.tsx");
    expect(detail).toContain("useDeactivateClient");
  });

  it("edit route renders ClientForm with clientId param", () => {
    const editPage = read(
      "src/app/(authenticated)/financial/clients/[clientId]/edit/page.tsx"
    );
    expect(editPage).toContain("ClientForm");
    expect(editPage).toContain("clientId");
  });

  it("detail shows Edit link for all clients including inactive", () => {
    const detail = read("src/components/financial/clients/client-detail.tsx");
    expect(detail).toContain(
      'href={`/financial/clients/${client.id}/edit`}'
    );
  });

  it("form hydrates existing client data via useRef guard", () => {
    const form = read("src/components/financial/clients/client-form.tsx");
    expect(form).toContain("hydratedId");
    expect(form).toContain("useRef");
    expect(form).toContain("useEffect");
    expect(form).toContain("hydratedId.current = existing.id");
    expect(form).toContain("hydratedId.current === existing.id");
  });

  it("form shows loading state while fetching existing client", () => {
    const form = read("src/components/financial/clients/client-form.tsx");
    expect(form).toContain("loadingExisting");
    expect(form).toContain("LoadingState");
  });

  it("list has accessible status filter with All/Active/Inactive", () => {
    const list = read("src/components/financial/clients/client-list.tsx");
    expect(list).toContain('role="radiogroup"');
    expect(list).toContain('aria-label={t("filterStatusLabel")}');
    expect(list).toContain("aria-checked");
    expect(list).toContain('"all"');
    expect(list).toContain('"active"');
    expect(list).toContain('"inactive"');
  });

  it("list resets page to 1 on status filter change", () => {
    const list = read("src/components/financial/clients/client-list.tsx");
    expect(list).toContain("setPage(1)");
  });

  it("list sends true/false/all to useClients active param", () => {
    const list = read("src/components/financial/clients/client-list.tsx");
    expect(list).toContain('"all"');
    expect(list).toContain("apiActive");
    expect(list).toContain("statusFilter === \"active\" ? true");
  });

  it("list does not client-side filter inactive clients (server-side only)", () => {
    const list = read("src/components/financial/clients/client-list.tsx");
    expect(list).not.toContain("filter((c) => !c.active)");
    expect(list).not.toContain("ClientData");
  });

  it("list shows inactive badge and reduced opacity for inactive rows", () => {
    const list = read("src/components/financial/clients/client-list.tsx");
    expect(list).toContain("opacity-60");
    expect(list).toContain('t("inactive")');
  });

  it("list shows Status column only in All filter", () => {
    const list = read("src/components/financial/clients/client-list.tsx");
    expect(list).toContain('statusFilter === "all"');
  });

  it("list uses data.items directly (no local items variable)", () => {
    const list = read("src/components/financial/clients/client-list.tsx");
    expect(list).toContain("data.items.length === 0");
    expect(list).toContain("data.items.map");
    expect(list).not.toContain("\n  const items");
  });
});
