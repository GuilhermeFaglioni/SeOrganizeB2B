export interface AIStudioRouterLike {
  push(href: string): void;
  replace(href: string): void;
}

interface ActiveAIStudioRouterGuard {
  token: symbol;
  confirmExit(): boolean;
  leaveSession(): void;
  releaseForNavigation(onReleased: () => void): void;
}

let activeGuard: ActiveAIStudioRouterGuard | null = null;

export function shouldPreserveAIStudioParentChildren(input: {
  hasRenderedChildren: boolean;
  redirecting: boolean;
  sameIdentity: boolean;
}): boolean {
  return input.hasRenderedChildren && !input.redirecting && input.sameIdentity;
}

export function releaseAIStudioRouterGuard(): void {
  activeGuard = null;
}

export function registerAIStudioRouterGuard(input: {
  confirmExit(): boolean;
  leaveSession(): void;
  releaseForNavigation(onReleased: () => void): void;
}): () => void {
  const token = Symbol("ai-studio-router-guard");
  activeGuard = { token, ...input };

  return () => {
    if (activeGuard?.token !== token) return;
    // A parent gate can run its redirect effect after this child cleanup in
    // the same passive-effect flush. Keep the guard available for that handoff.
    queueMicrotask(() => {
      if (activeGuard?.token === token) activeGuard = null;
    });
  };
}

export function pushWithAIStudioGuard(
  router: AIStudioRouterLike,
  href: string,
): boolean {
  return navigateWithAIStudioGuard(router, "push", href);
}

export function replaceWithAIStudioGuard(
  router: AIStudioRouterLike,
  href: string,
): boolean {
  return navigateWithAIStudioGuard(router, "replace", href);
}

function navigateWithAIStudioGuard(
  router: AIStudioRouterLike,
  method: "push" | "replace",
  href: string,
): boolean {
  const guard = activeGuard;
  if (guard && !guard.confirmExit()) return false;
  if (guard) {
    guard.releaseForNavigation(() => {
      releaseAIStudioRouterGuard();
      guard.leaveSession();
      router[method](href);
    });
  } else {
    router[method](href);
  }
  return true;
}
