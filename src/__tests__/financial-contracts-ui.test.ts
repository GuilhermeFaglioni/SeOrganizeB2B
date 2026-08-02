import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("contracts UI", () => {
  it("keeps the list, new, detail and edit routes present", () => {
    for (const page of [
      "src/app/(authenticated)/financial/contracts/page.tsx",
      "src/app/(authenticated)/financial/contracts/new/page.tsx",
      "src/app/(authenticated)/financial/contracts/[contractId]/page.tsx",
      "src/app/(authenticated)/financial/contracts/[contractId]/edit/page.tsx",
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
    expect(form).toContain('item.quantity && item.quantity !== "" ? item.quantity : "1"');
    expect(form).toContain('item.price && item.price !== "" ? item.price : "0"');
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

  it("edit route renders ContractForm with contractId param", () => {
    const editPage = read("src/app/(authenticated)/financial/contracts/[contractId]/edit/page.tsx");
    expect(editPage).toContain("ContractForm");
    expect(editPage).toContain("contractId");
  });

  it("detail shows Edit link for draft and active contracts", () => {
    const detail = read("src/components/financial/contracts/contract-detail.tsx");
    expect(detail).toContain('href={`/financial/contracts/${contract.id}/edit`}');
    expect(detail).toContain('contract.status === "draft"');
    expect(detail).toContain('contract.status === "active"');
  });

  it("form hydrates async contract data once via useRef guard without clobbering edits", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain("hydratedId");
    expect(form).toContain("useRef");
    expect(form).toContain("useEffect");
    expect(form).toContain("hydratedId.current = existing.id");
    expect(form).toContain("hydratedId.current === existing.id");
  });

  it("form hydrates items and projectIds from fetched contract", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain("existing.items");
    expect(form).toContain("existing.projects");
    expect(form).toContain("setProjectIds");
    expect(form).toContain("setItems");
  });

  it("form shows required-value error when officialValue is empty", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain("Official contract value is required");
    expect(form).toContain("parsedOfficialValue");
  });

  it("form validates open-ended contracts without exact-sum requirement", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain("A billing frequency is required for open-ended contracts");
    expect(form).toContain("positive amount");
    expect(form).toContain("validateFinitePlan");
  });

  it("form sends items and projectIds in the update payload", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain("items: items");
    expect(form).toContain("projectIds,");
  });
});
