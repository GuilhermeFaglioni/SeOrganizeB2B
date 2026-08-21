import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const checkinSource = readFileSync(
  new URL("../app/(authenticated)/beta/checkin/page.tsx", import.meta.url),
  "utf8"
);

const alertSource = readFileSync(
  new URL("../components/ui/alert-dialog.tsx", import.meta.url),
  "utf8"
);

describe("beta check-in a11y", () => {
  it("wires short_text answers with an accessible label tied to the textarea", () => {
    expect(checkinSource).toContain('htmlFor={`answer-${question.id}`}');
    expect(checkinSource).toContain('id={`answer-${question.id}`}');
    expect(checkinSource).toContain('aria-labelledby={`q-${question.id}`}');
    expect(checkinSource).toContain('aria-describedby={`hint-${question.id}`}');
    expect(checkinSource).toContain('id={`q-${question.id}`}');
  });

  it("exposes a readable hint tied to the textarea and does not suppress it visually", () => {
    expect(checkinSource).toContain('t("privacyHint")');
    expect(checkinSource).toContain('id={`hint-${question.id}`}');
  });

  it("names rating options and marks selection for assistive tech", () => {
    expect(checkinSource).toContain('role="radiogroup"');
    expect(checkinSource).toContain('role="radio"');
    expect(checkinSource).toContain('aria-checked={value === rating}');
    expect(checkinSource).toContain('aria-label={t("ratingLabel"');
    expect(checkinSource).toContain('aria-label={question.text}');
  });

  it("supports keyboard navigation inside the rating group without trapping tab", () => {
    expect(checkinSource).toContain("ArrowLeft");
    expect(checkinSource).toContain("ArrowRight");
    expect(checkinSource).toContain("ArrowUp");
    expect(checkinSource).toContain("ArrowDown");
  });

  it("keeps the textarea and rating choices keyboard reachable", () => {
    expect(checkinSource).not.toMatch(/tabIndex=\{-1\}/);
    expect(checkinSource).toContain("focus-visible:ring");
    expect(checkinSource).toContain("focus-visible:outline-none");
  });

  it("uses an accessible alert dialog surface for the beta-exit path", () => {
    expect(checkinSource).toContain("AlertDialog");
    expect(checkinSource).toContain("AlertDialogDescription");
    expect(alertSource).toContain("Dialog");
    expect(alertSource).toContain("DialogDescription");
  });
});
