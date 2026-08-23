import { describe, expect, it } from "vitest";
import {
  isAIStudioCandidateActionDisabled,
  isAIStudioDirty,
  isAIStudioRemovalConfirmed,
  isAIStudioUndoDisabled,
  recoverAIStudioContext,
  resetAIStudioContext,
  switchAIStudioProviderContext,
} from "../lib/ai/studio-session-seams";

describe("AI Studio session behavior seams", () => {
  it("gates candidate mutations while generation is in flight", () => {
    expect(isAIStudioCandidateActionDisabled({
      isGenerating: true,
      requiresRemovalConfirmation: false,
      confirmRemoval: true,
    })).toBe(true);
    expect(isAIStudioCandidateActionDisabled({
      isGenerating: false,
      requiresRemovalConfirmation: true,
      confirmRemoval: false,
    })).toBe(true);
    expect(isAIStudioCandidateActionDisabled({
      isGenerating: false,
      requiresRemovalConfirmation: false,
      confirmRemoval: false,
    })).toBe(false);
  });

  it("does not carry removal approval from one candidate to another", () => {
    const candidateA = { html: "<p>A</p>" };
    const candidateB = { html: "<p>B</p>" };

    expect(isAIStudioRemovalConfirmed(candidateA, candidateA)).toBe(true);
    expect(isAIStudioRemovalConfirmed(candidateB, candidateA)).toBe(false);
    expect(isAIStudioRemovalConfirmed(null, candidateA)).toBe(false);
  });

  it("disables the editor undo control while generation is in flight", () => {
    expect(isAIStudioUndoDisabled({
      isGenerating: true,
      historyLength: 2,
      hasCandidate: true,
    })).toBe(true);
    expect(isAIStudioUndoDisabled({
      isGenerating: false,
      historyLength: 0,
      hasCandidate: false,
    })).toBe(true);
    expect(isAIStudioUndoDisabled({
      isGenerating: false,
      historyLength: 1,
      hasCandidate: false,
    })).toBe(false);
  });

  it("treats an in-flight upload as dirty before any server image id exists", () => {
    expect(isAIStudioDirty({
      isGenerating: false,
      uploadingImage: true,
      hasCandidate: false,
      historyLength: 0,
      html: "",
      baseHtml: "",
      templateName: "",
      initialTemplateName: "",
      message: "",
      sessionMessageCount: 0,
      sessionSummary: null,
      attachedImageCount: 0,
    })).toBe(true);
  });

  it("resets transcript context without changing the applied HTML", () => {
    const reset = resetAIStudioContext({
      sessionId: "session-reset",
      appliedHtml: "<section>applied</section>",
    });

    expect(reset).toMatchObject({
      sessionId: "session-reset",
      appliedHtml: "<section>applied</section>",
      sessionMessages: [],
      sessionSummary: null,
      candidate: null,
      attachedImageIds: [],
    });
  });

  it("starts a provider context without dropping the candidate or applied HTML", () => {
    const candidate = { html: "<section>candidate</section>" };
    const next = switchAIStudioProviderContext({
      sessionId: "session-provider",
      appliedHtml: "<section>applied</section>",
      candidate,
    });

    expect(next.appliedHtml).toBe("<section>applied</section>");
    expect(next.candidate).toBe(candidate);
    expect(next.sessionMessages).toEqual([]);
    expect(next.sessionSummary).toBeNull();
    expect(next.attachedImageIds).toEqual([]);
  });

  it("recovers an invalid snapshot without reusing transcript, summary or image ids", () => {
    const candidate = { html: "<section>candidate</section>" };
    const recovered = recoverAIStudioContext({
      sessionId: "session-recovered",
      appliedHtml: "<section>applied</section>",
      candidate,
    });

    expect(recovered).toMatchObject({
      sessionId: "session-recovered",
      appliedHtml: "<section>applied</section>",
      candidate,
      sessionMessages: [],
      sessionSummary: null,
      attachedImageIds: [],
    });
  });
});
