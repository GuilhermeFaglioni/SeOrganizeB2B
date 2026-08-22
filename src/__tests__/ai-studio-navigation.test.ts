import { describe, expect, it, vi } from "vitest";
import {
  installAIStudioPopstateGuard,
  type AIStudioPopstateEvent,
} from "../lib/ai/studio-navigation";

function popstateEvent() {
  return { stopImmediatePropagation: vi.fn() } satisfies AIStudioPopstateEvent;
}

describe("AI Studio SPA navigation guard", () => {
  it("keeps the same URL on a cancelled Back and releases exactly one confirmed Back", () => {
    let listener: ((event: AIStudioPopstateEvent) => void) | undefined;
    type HistoryDouble = { state: unknown; pushState: (state: unknown, unused: string, url?: string | URL | null) => void; back: () => void };
    const pushState = vi.fn((state: unknown) => { history.state = state; });
    const back = vi.fn();
    const history: HistoryDouble = {
      state: { route: "/financial/proposals/templates/ai-studio" },
      pushState,
      back,
    };
    const target = {
      addEventListener: (_type: "popstate", next: (event: AIStudioPopstateEvent) => void) => {
        listener = next;
      },
      removeEventListener: vi.fn((_type: "popstate", removed: (event: AIStudioPopstateEvent) => void) => {
        if (listener === removed) listener = undefined;
      }),
    };
    const confirmExit = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const onExit = vi.fn();
    const cleanup = installAIStudioPopstateGuard({
      history,
      target,
      currentUrl: "https://example.test/financial/proposals/templates/ai-studio",
      confirmExit,
      onExit,
    });

    expect(pushState).toHaveBeenCalledTimes(1);
    const cancelled = popstateEvent();
    listener?.(cancelled);
    expect(cancelled.stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(pushState).toHaveBeenCalledTimes(2);
    expect(back).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();

    const confirmed = popstateEvent();
    listener?.(confirmed);
    expect(back).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);

    history.state = { route: "/financial/proposals/templates" };
    const released = popstateEvent();
    listener?.(released);
    expect(back).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(released.stopImmediatePropagation).not.toHaveBeenCalled();

    cleanup.dispose();
    expect(target.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it("removes its same-URL sentinel on disposal and reinstalls only one new sentinel", () => {
    let listener: ((event: AIStudioPopstateEvent) => void) | undefined;
    type HistoryDouble = { state: unknown; pushState: (state: unknown, unused: string, url?: string | URL | null) => void; back: () => void };
    const pushState = vi.fn((state: unknown) => { history.state = state; });
    const back = vi.fn();
    const history: HistoryDouble = {
      state: { route: "/financial/proposals/templates/ai-studio" },
      pushState,
      back,
    };
    const target = {
      addEventListener: (_type: "popstate", next: (event: AIStudioPopstateEvent) => void) => {
        listener = next;
      },
      removeEventListener: vi.fn((_type: "popstate", removed: (event: AIStudioPopstateEvent) => void) => {
        if (listener === removed) listener = undefined;
      }),
    };
    const options = {
      history,
      target,
      currentUrl: "https://example.test/financial/proposals/templates/ai-studio",
      confirmExit: () => false,
      onExit: vi.fn(),
    };

    const first = installAIStudioPopstateGuard(options);
    first.dispose();
    expect(back).toHaveBeenCalledTimes(1);

    history.state = { route: "/financial/proposals/templates/ai-studio" };
    const cleanupPop = popstateEvent();
    listener?.(cleanupPop);
    expect(cleanupPop.stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(target.removeEventListener).toHaveBeenCalledTimes(1);

    const second = installAIStudioPopstateGuard(options);
    expect(pushState).toHaveBeenCalledTimes(2);
    const onReleased = vi.fn();
    second.releaseForNavigation(onReleased);
    expect(back).toHaveBeenCalledTimes(2);
    history.state = { route: "/financial/proposals/templates/ai-studio" };
    listener?.(popstateEvent());
    expect(onReleased).toHaveBeenCalledTimes(1);
  });

  it("lets a parent redirect attach its callback after child disposal started", () => {
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
    const guard = installAIStudioPopstateGuard({
      history,
      target,
      currentUrl: "https://example.test/financial/proposals/templates/ai-studio",
      confirmExit: () => true,
      onExit: vi.fn(),
    });

    guard.dispose();
    const onReleased = vi.fn();
    guard.releaseForNavigation(onReleased);
    expect(history.back).toHaveBeenCalledOnce();
    expect(onReleased).not.toHaveBeenCalled();

    history.state = { route: "/financial/proposals/templates/ai-studio" };
    listener?.(popstateEvent());
    expect(onReleased).toHaveBeenCalledOnce();
  });
});
