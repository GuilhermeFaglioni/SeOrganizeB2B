import { afterEach, describe, expect, it, vi } from "vitest";
import {
  pushWithAIStudioGuard,
  registerAIStudioRouterGuard,
  shouldPreserveAIStudioParentChildren,
} from "../lib/ai/studio-router-guard";
import {
  installAIStudioPopstateGuard,
  type AIStudioPopstateEvent,
} from "../lib/ai/studio-navigation";

describe("AI Studio programmatic navigation guard", () => {
  it("preserves mounted parent-gate children until a redirect is committed", () => {
    expect(shouldPreserveAIStudioParentChildren({ hasRenderedChildren: true, redirecting: false, sameIdentity: true })).toBe(true);
    expect(shouldPreserveAIStudioParentChildren({ hasRenderedChildren: true, redirecting: true, sameIdentity: true })).toBe(false);
    expect(shouldPreserveAIStudioParentChildren({ hasRenderedChildren: true, redirecting: false, sameIdentity: false })).toBe(false);
    expect(shouldPreserveAIStudioParentChildren({ hasRenderedChildren: false, redirecting: false, sameIdentity: true })).toBe(false);
  });

  afterEach(() => {
    registerAIStudioRouterGuard({
      confirmExit: () => true,
      leaveSession: () => undefined,
      releaseForNavigation: (onReleased) => onReleased(),
    })();
  });

  it("blocks router pushes when the dirty-session confirmation is cancelled", () => {
    const router = { push: vi.fn(), replace: vi.fn() };
    const leaveSession = vi.fn();
    const dispose = registerAIStudioRouterGuard({
      confirmExit: () => false,
      leaveSession,
      releaseForNavigation: vi.fn(),
    });

    expect(pushWithAIStudioGuard(router, "/board")).toBe(false);
    expect(router.push).not.toHaveBeenCalled();
    expect(leaveSession).not.toHaveBeenCalled();
    dispose();
  });

  it("releases the navigation sentinel before cleanup and confirmed navigation", () => {
    const router = { push: vi.fn(), replace: vi.fn() };
    const order: string[] = [];
    const dispose = registerAIStudioRouterGuard({
      confirmExit: () => true,
      leaveSession: () => order.push("leave"),
      releaseForNavigation: (onReleased) => {
        order.push("release");
        onReleased();
      },
    });

    expect(pushWithAIStudioGuard(router, "/board")).toBe(true);
    expect(order).toEqual(["release", "leave"]);
    expect(router.push).toHaveBeenCalledWith("/board");
    dispose();
  });

  it("does not let an older component unregister a newer guard", () => {
    const router = { push: vi.fn(), replace: vi.fn() };
    const oldDispose = registerAIStudioRouterGuard({
      confirmExit: () => false,
      leaveSession: vi.fn(),
      releaseForNavigation: vi.fn(),
    });
    const currentLeave = vi.fn();
    registerAIStudioRouterGuard({
      confirmExit: () => true,
      leaveSession: currentLeave,
      releaseForNavigation: (onReleased) => onReleased(),
    });

    oldDispose();
    expect(pushWithAIStudioGuard(router, "/notifications")).toBe(true);
    expect(currentLeave).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith("/notifications");
  });

  it("waits for the real popstate guard to release its sentinel before pushing", () => {
    let listener: ((event: AIStudioPopstateEvent) => void) | undefined;
    const history = {
      state: { route: "/financial/proposals/templates/ai-studio" } as unknown,
      pushState: vi.fn((state: unknown) => { history.state = state; }),
      back: vi.fn(),
    };
    const target = {
      addEventListener: (_type: "popstate", next: (event: AIStudioPopstateEvent) => void) => {
        listener = next;
      },
      removeEventListener: vi.fn(),
    };
    const popstateGuard = installAIStudioPopstateGuard({
      history,
      target,
      currentUrl: "https://example.test/financial/proposals/templates/ai-studio",
      confirmExit: () => true,
      onExit: vi.fn(),
    });
    const router = { push: vi.fn(), replace: vi.fn() };
    const order: string[] = [];
    const dispose = registerAIStudioRouterGuard({
      confirmExit: () => true,
      leaveSession: () => order.push("leave"),
      releaseForNavigation: (onReleased) => popstateGuard.releaseForNavigation(() => {
        order.push("release");
        onReleased();
      }),
    });

    dispose();
    popstateGuard.dispose();
    expect(pushWithAIStudioGuard(router, "/board")).toBe(true);
    expect(history.back).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();

    listener?.({ stopImmediatePropagation: vi.fn() });

    expect(order).toEqual(["release", "leave"]);
    expect(router.push).toHaveBeenCalledWith("/board");
  });
});
