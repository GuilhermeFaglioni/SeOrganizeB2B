import { describe, expect, it } from "vitest";
import { createAIStudioId } from "../lib/ai/studio-identifiers";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("AI Studio identifiers", () => {
  it("uses the platform UUID generator when available", () => {
    expect(createAIStudioId({ randomUUID: () => "platform-uuid" })).toBe("platform-uuid");
  });

  it("keeps the upload route UUID contract without randomUUID", () => {
    const id = createAIStudioId({
      getRandomValues: (values) => {
        values.fill(0);
        return values;
      },
    });

    expect(id).toMatch(UUID_PATTERN);
  });

  it("still produces a UUID-shaped id with no Web Crypto APIs", () => {
    expect(createAIStudioId({})).toMatch(UUID_PATTERN);
  });
});
