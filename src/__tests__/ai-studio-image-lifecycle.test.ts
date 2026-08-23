import { describe, expect, it } from "vitest";
import {
  getAIStudioCleanupImageIds,
  getUnsubmittedAIStudioImageIds,
  registerAIStudioUpload,
} from "../lib/ai/studio-image-lifecycle";

describe("AI Studio image lifecycle", () => {
  it("returns only uploads that were not included in a generation request", () => {
    expect(getUnsubmittedAIStudioImageIds(
      ["uploaded-1", "uploaded-2", "uploaded-2"],
      ["uploaded-1"],
    )).toEqual(["uploaded-2"]);
  });

  it("returns no orphan cleanup when every uploaded image was submitted", () => {
    expect(getUnsubmittedAIStudioImageIds(["uploaded-1"], ["uploaded-1"])).toEqual([]);
  });

  it("includes pending upload ids in the pagehide/reset cleanup list", () => {
    expect(getAIStudioCleanupImageIds(
      ["attached-1"],
      ["pending-1", "attached-1"],
    )).toEqual(["attached-1", "pending-1"]);
  });

  it("registers the client id before POST/response parsing so pagehide can delete it", () => {
    const pendingControllers = new Set<AbortController>();
    const uploadedImageIds = new Set<string>();
    const controller = new AbortController();
    const registration = registerAIStudioUpload({
      uploadId: "upload-before-response",
      controller,
      pendingControllers,
      uploadedImageIds,
    });

    expect(pendingControllers.has(controller)).toBe(true);
    expect(Array.from(uploadedImageIds)).toEqual(["upload-before-response"]);
    expect(getUnsubmittedAIStudioImageIds(uploadedImageIds, [])).toEqual(["upload-before-response"]);

    registration.complete("upload-before-response");
    expect(pendingControllers.has(controller)).toBe(false);
    expect(uploadedImageIds.has("upload-before-response")).toBe(true);

    const failed = registerAIStudioUpload({
      uploadId: "upload-failed",
      controller: new AbortController(),
      pendingControllers,
      uploadedImageIds,
    });
    failed.fail();
    expect(uploadedImageIds).toEqual(new Set(["upload-before-response"]));
  });
});
