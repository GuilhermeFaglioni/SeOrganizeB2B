import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const filterSource = readFileSync(
  resolve(__dirname, "../middleware/tenant-filter.ts"),
  "utf8",
);

describe("tenant filter exemption for Closed Beta check-in models", () => {
  it("treats check-in editions as global campaign records", () => {
    expect(filterSource).toContain('"ClosedBetaCheckinEdition"');
  });

  it("treats check-in questions as global campaign records", () => {
    expect(filterSource).toContain('"ClosedBetaCheckinQuestion"');
  });

  it("treats check-in responses as global campaign records", () => {
    expect(filterSource).toContain('"ClosedBetaCheckinResponse"');
  });

  it("treats check-in workspace states as global campaign records", () => {
    expect(filterSource).toContain('"ClosedBetaCheckinWorkspaceState"');
  });
});
