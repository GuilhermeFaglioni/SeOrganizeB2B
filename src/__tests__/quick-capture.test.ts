import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (file: string) =>
  readFileSync(resolve(__dirname, "../..", file), "utf8");

describe("Quick Capture", () => {
  it("mounts globally with Cmd/Ctrl K", () => {
    const context = read("src/stores/quick-capture-context.tsx");
    expect(context).toContain("event.metaKey || event.ctrlKey");
    expect(context).toContain('event.key.toLowerCase() !== "k"');
    expect(read("src/app/(authenticated)/layout.tsx")).toContain(
      "QuickCaptureProvider"
    );
  });

  it("supports task, event, and document", () => {
    const dialog = read(
      "src/components/quick-capture/quick-capture-dialog.tsx"
    );
    expect(dialog).toContain('"task" | "event" | "document"');
    expect(dialog).toContain("openScheduleEvent");
    expect(dialog).toContain("useCreateDocument");
  });
});
