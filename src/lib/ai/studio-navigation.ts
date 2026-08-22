interface AIStudioHistoryLike {
  state: unknown;
  pushState(data: unknown, unused: string, url?: string | URL | null): void;
  back(): void;
}

export interface AIStudioPopstateEvent {
  stopImmediatePropagation(): void;
}

interface AIStudioPopstateTarget {
  addEventListener(
    type: "popstate",
    listener: (event: AIStudioPopstateEvent) => void,
    options?: boolean,
  ): void;
  removeEventListener(
    type: "popstate",
    listener: (event: AIStudioPopstateEvent) => void,
    options?: boolean,
  ): void;
}

export interface AIStudioPopstateGuardHandle {
  dispose(): void;
  releaseForNavigation(onReleased: () => void): void;
}

type PendingPop =
  | { kind: "route" }
  | { kind: "cleanup"; onReleased?: () => void };

export function installAIStudioPopstateGuard(input: {
  history: AIStudioHistoryLike;
  target: AIStudioPopstateTarget;
  currentUrl: string;
  confirmExit: () => boolean;
  onExit: () => void;
}): AIStudioPopstateGuardHandle {
  const currentState =
    typeof input.history.state === "object" && input.history.state !== null
      ? input.history.state
      : {};
  const guardedState = { ...currentState, aiStudioGuard: true };
  let sentinelActive = true;
  let disposed = false;
  let pendingPop: PendingPop | null = null;
  let listenerActive = true;

  // Add a same-URL sentinel so the first Back event can be intercepted before
  // Next receives a route transition.
  input.history.pushState(guardedState, "", input.currentUrl);

  const isCurrentSentinel = () => {
    const state = input.history.state;
    return typeof state === "object" && state !== null && "aiStudioGuard" in state;
  };

  const removeListener = () => {
    if (!listenerActive) return;
    listenerActive = false;
    input.target.removeEventListener("popstate", handlePopstate, true);
  };

  function handlePopstate(event: AIStudioPopstateEvent) {
    if (pendingPop?.kind === "cleanup") {
      event.stopImmediatePropagation();
      sentinelActive = false;
      const onReleased = pendingPop.onReleased;
      pendingPop = null;
      removeListener();
      onReleased?.();
      return;
    }

    if (pendingPop?.kind === "route") {
      sentinelActive = false;
      pendingPop = null;
      removeListener();
      return;
    }

    event.stopImmediatePropagation();

    if (!input.confirmExit()) {
      input.history.pushState(guardedState, "", input.currentUrl);
      return;
    }

    input.onExit();
    pendingPop = { kind: "route" };
    input.history.back();
  }

  input.target.addEventListener("popstate", handlePopstate, true);
  const releaseSentinel = (onReleased?: () => void) => {
    if (!sentinelActive || !isCurrentSentinel()) {
      sentinelActive = false;
      removeListener();
      onReleased?.();
      return;
    }
    pendingPop = { kind: "cleanup", onReleased };
    input.history.back();
  };

  return {
    dispose() {
      // Remove the same-URL sentinel before the guarded component disappears.
      if (disposed) return;
      disposed = true;
      if (pendingPop) return;
      releaseSentinel();
    },
    releaseForNavigation(onReleased) {
      // Collapse the sentinel first, then run the route/sign-out callback on
      // the following popstate so the browser history stays aligned.
      if (pendingPop?.kind === "cleanup" && disposed && !pendingPop.onReleased) {
        pendingPop.onReleased = onReleased;
        return;
      }
      if (pendingPop) return;
      releaseSentinel(onReleased);
    },
  };
}
