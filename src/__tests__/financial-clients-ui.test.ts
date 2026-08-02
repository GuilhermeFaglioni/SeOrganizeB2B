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
    expect(detail).toContain("Contract and revenue history");
  });

  it("deactivates instead of deleting clients", () => {
    const detail = read("src/components/financial/clients/client-detail.tsx");
    expect(detail).toContain("useDeactivateClient");
  });
});
