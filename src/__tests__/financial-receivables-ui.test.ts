import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("receivables UI", () => {
  it("keeps the receivables route present", () => {
    expect(exists("src/app/(authenticated)/financial/receivables/page.tsx")).toBe(true);
  });

  it("lists installments with status filters and CSV export", () => {
    const list = read("src/components/financial/receivables/receivables-list.tsx");
    expect(list).toContain("pending");
    expect(list).toContain("paid");
    expect(list).toContain("overdue");
    expect(list).toContain("cancelled");
    expect(list).toContain("exportReceivablesCsv");
  });

  it("supports paying, cancelling and refunding installments", () => {
    const actions = read("src/components/financial/receivables/installment-actions.tsx");
    expect(actions).toContain("useMarkInstallmentPaid");
    expect(actions).toContain("useCancelInstallment");
    expect(actions).toContain("useRefundInstallment");
  });
});
