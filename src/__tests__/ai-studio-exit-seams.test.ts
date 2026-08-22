import { describe, expect, it, vi } from "vitest";
import {
  createAIStudioPagehideHandler,
  handleAIStudioExitClick,
  navigateAfterAIStudioCommit,
  type AIStudioExitClickEvent,
  type AIStudioExitClickTarget,
} from "../lib/ai/studio-exit-seams";

function clickEvent(target: AIStudioExitClickTarget): AIStudioExitClickEvent {
  return {
    target,
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
}

function exitActions(confirmExit: boolean) {
  const order: string[] = [];
  const actions = {
    confirmExit: vi.fn(() => confirmExit),
    leaveSession: vi.fn(() => order.push("leave")),
    releaseForNavigation: vi.fn((onReleased: () => void) => {
      order.push("release");
      onReleased();
    }),
    navigate: vi.fn(() => order.push("navigate")),
  };
  return { actions, order };
}

describe("AI Studio exit behavior seams", () => {
  it("cancels a same-origin link without cleanup or navigation", () => {
    const event = clickEvent({
      kind: "link",
      href: "/financial/proposals/templates",
      sameOrigin: true,
      sameUrl: false,
      opensNewTab: false,
      download: false,
    });
    const { actions, order } = exitActions(false);

    expect(handleAIStudioExitClick(event, actions)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(actions.leaveSession).not.toHaveBeenCalled();
    expect(actions.releaseForNavigation).not.toHaveBeenCalled();
    expect(actions.navigate).not.toHaveBeenCalled();
    expect(order).toEqual([]);
  });

  it("confirms a same-origin link and cleans the session before navigation", () => {
    const event = clickEvent({
      kind: "link",
      href: "/financial/proposals/templates",
      sameOrigin: true,
      sameUrl: false,
      opensNewTab: false,
      download: false,
    });
    const { actions, order } = exitActions(true);

    expect(handleAIStudioExitClick(event, actions)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(order).toEqual(["leave", "release", "navigate"]);
  });

  it("applies the confirmed cleanup path to all three sidebar sign-out controls", () => {
    for (const controlId of ["mobile", "desktop", "compact"]) {
      const { actions, order } = exitActions(true);
      const event = clickEvent({ kind: "exit-control", controlId });

      expect(handleAIStudioExitClick(event, actions)).toBe(true);
      expect(actions.confirmExit).toHaveBeenCalledOnce();
      expect(order).toEqual(["leave", "release", "navigate"]);
    }
  });

  it("releases the sentinel before cleaning up and navigating after an explicit commit", () => {
    const { actions, order } = exitActions(true);

    navigateAfterAIStudioCommit(actions);

    expect(actions.confirmExit).not.toHaveBeenCalled();
    expect(order).toEqual(["release", "leave", "navigate"]);
  });

  it("ignores modified, external, same-page and new-tab clicks", () => {
    const targets: AIStudioExitClickTarget[] = [
      {
        kind: "link",
        href: "https://external.test/elsewhere",
        sameOrigin: false,
        sameUrl: false,
        opensNewTab: false,
        download: false,
      },
      {
        kind: "link",
        href: "/financial/proposals/templates/ai-studio#section",
        sameOrigin: true,
        sameUrl: true,
        opensNewTab: false,
        download: false,
      },
      {
        kind: "link",
        href: "/financial/proposals/templates",
        sameOrigin: true,
        sameUrl: false,
        opensNewTab: true,
        download: false,
      },
    ];

    for (const target of targets) {
      const event = clickEvent(target);
      const { actions } = exitActions(true);
      expect(handleAIStudioExitClick(event, actions)).toBe(false);
      expect(actions.confirmExit).not.toHaveBeenCalled();
    }

    const modified = clickEvent(targets[0]!);
    modified.ctrlKey = true;
    const { actions: modifiedActions } = exitActions(true);
    expect(handleAIStudioExitClick(modified, modifiedActions)).toBe(false);
  });
});

describe("AI Studio pagehide cleanup seam", () => {
  it("defers cleanup while the document enters the back-forward cache", () => {
    const invalidateSession = vi.fn();
    const abortPendingUploads = vi.fn();
    const discardSession = vi.fn();
    const discardImages = vi.fn();
    const handler = createAIStudioPagehideHandler({
      sessionId: "session-bfcache",
      attachedImageIds: ["image-attached"],
      uploadedImageIds: new Set(["image-pending"]),
      invalidateSession,
      abortPendingUploads,
      discardSession,
      discardImages,
    });

    handler({ persisted: true });

    expect(invalidateSession).not.toHaveBeenCalled();
    expect(abortPendingUploads).not.toHaveBeenCalled();
    expect(discardSession).not.toHaveBeenCalled();
    expect(discardImages).not.toHaveBeenCalled();
  });

  it("aborts uploads, invalidates the session and deduplicates attached and pending images", () => {
    const invalidateSession = vi.fn();
    const abortPendingUploads = vi.fn();
    const discardSession = vi.fn();
    const discardImages = vi.fn();
    const handler = createAIStudioPagehideHandler({
      sessionId: "session-pagehide",
      attachedImageIds: ["image-attached", "image-shared"],
      uploadedImageIds: new Set(["image-pending", "image-shared"]),
      invalidateSession,
      abortPendingUploads,
      discardSession,
      discardImages,
    });

    handler({ persisted: false });

    expect(invalidateSession).toHaveBeenCalledOnce();
    expect(abortPendingUploads).toHaveBeenCalledOnce();
    expect(discardSession).toHaveBeenCalledWith("session-pagehide");
    expect(discardImages).toHaveBeenCalledWith([
      "image-attached",
      "image-shared",
      "image-pending",
    ]);
  });
});
