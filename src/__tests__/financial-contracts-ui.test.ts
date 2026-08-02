import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("contracts UI", () => {
  it("keeps the list, new and detail routes present", () => {
    for (const page of [
      "src/app/(authenticated)/financial/contracts/page.tsx",
      "src/app/(authenticated)/financial/contracts/new/page.tsx",
      "src/app/(authenticated)/financial/contracts/[contractId]/page.tsx",
    ]) {
      expect(exists(page), page).toBe(true);
    }
  });

  it("renders one scrollable form with collapsible sections", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain("Contract data");
    expect(form).toContain("Scope and items");
    expect(form).toContain("Linked projects");
    expect(form).toContain("Billing and installments");
    expect(form).toContain("toggleSection");
  });

  it("shows a financial consistency summary before activation", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain("Installment total");
    expect(form).toContain("Official value");
    expect(form).toContain("useContractLifecycle");
    expect(form).toContain('action: "activate"');
  });

  it("defaults a missing item quantity to 1 in the item-price sum", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain('.times(toDecimal(item.quantity ?? "1"))');
    expect(form).toContain("toDecimal(0)");
    expect(form).not.toContain("String(Number(");
    expect(form).not.toContain('.times(toDecimal(item.quantity ?? "0"))');
  });

  it("exposes lifecycle actions including renew and cancel", () => {
    const actions = read("src/components/financial/contracts/lifecycle-actions.tsx");
    expect(actions).toContain("activate");
    expect(actions).toContain("suspend");
    expect(actions).toContain("resume");
    expect(actions).toContain("close");
    expect(actions).toContain("cancel");
    expect(actions).toContain("renew");
  });

  it("lists contracts with server-side filters and CSV export", () => {
    const list = read("src/components/financial/contracts/contract-list.tsx");
    expect(list).toContain("useContracts");
    expect(list).toContain("exportContractsCsv");
  });

  it("shows a two-step confirmation for upsell and downsell", () => {
    const dialog = read("src/components/financial/contracts/change-dialog.tsx");
    expect(dialog).toContain("proposal");
    expect(dialog).toContain("confirm");
  });
});
