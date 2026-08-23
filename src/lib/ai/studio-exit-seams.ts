import { getAIStudioCleanupImageIds } from "./studio-image-lifecycle";

export type AIStudioExitClickTarget =
  | {
      kind: "link";
      href: string;
      sameOrigin: boolean;
      sameUrl: boolean;
      opensNewTab: boolean;
      download: boolean;
    }
  | { kind: "exit-control"; controlId: string }
  | { kind: "other" };

export interface AIStudioExitClickEvent {
  target: AIStudioExitClickTarget;
  button: number;
  defaultPrevented: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

export interface AIStudioExitClickActions {
  confirmExit(): boolean;
  leaveSession(): void;
  releaseForNavigation(onReleased: () => void): void;
  navigate(): void;
}

export function handleAIStudioExitClick(
  event: AIStudioExitClickEvent,
  actions: AIStudioExitClickActions,
): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false;
  }

  const target = event.target;
  if (target.kind === "other") return false;
  if (
    target.kind === "link" &&
    (!target.href ||
      target.href.startsWith("#") ||
      !target.sameOrigin ||
      target.sameUrl ||
      target.opensNewTab ||
      target.download)
  ) {
    return false;
  }

  if (!actions.confirmExit()) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  event.preventDefault();
  event.stopPropagation();
  actions.leaveSession();
  actions.releaseForNavigation(actions.navigate);
  return true;
}

export function navigateAfterAIStudioCommit(
  actions: Pick<AIStudioExitClickActions, "leaveSession" | "releaseForNavigation" | "navigate">,
): void {
  actions.releaseForNavigation(() => {
    actions.leaveSession();
    actions.navigate();
  });
}

export interface AIStudioCleanupInput {
  sessionId: string;
  attachedImageIds: readonly string[];
  uploadedImageIds: Iterable<string>;
  invalidateSession(): void;
  abortPendingUploads(): void;
  discardSession(sessionId: string): void;
  discardImages(imageIds: readonly string[]): void;
}

export interface AIStudioPagehideEvent {
  persisted: boolean;
}

export function cleanupAIStudioSession(input: AIStudioCleanupInput): void {
  input.invalidateSession();
  input.abortPendingUploads();
  input.discardSession(input.sessionId);
  input.discardImages(
    getAIStudioCleanupImageIds(input.attachedImageIds, input.uploadedImageIds),
  );
}

export function createAIStudioPagehideHandler(
  input: AIStudioCleanupInput,
): (event: AIStudioPagehideEvent) => void {
  return (event) => {
    if (event.persisted) return;
    cleanupAIStudioSession(input);
  };
}
