import type {
  AIStudioSessionMessage,
  AIStudioSessionSummary,
} from "./studio-contract";

export interface AIStudioDirtyInput {
  isGenerating: boolean;
  uploadingImage: boolean;
  hasCandidate: boolean;
  historyLength: number;
  html: string;
  baseHtml: string;
  templateName: string;
  initialTemplateName: string;
  message: string;
  sessionMessageCount: number;
  sessionSummary: AIStudioSessionSummary | null;
  attachedImageCount: number;
}

export function isAIStudioDirty(input: AIStudioDirtyInput): boolean {
  return (
    input.isGenerating ||
    input.uploadingImage ||
    input.hasCandidate ||
    input.historyLength > 0 ||
    input.html !== input.baseHtml ||
    input.templateName !== input.initialTemplateName ||
    input.message.trim().length > 0 ||
    input.sessionMessageCount > 0 ||
    input.sessionSummary !== null ||
    input.attachedImageCount > 0
  );
}

export function isAIStudioCandidateActionDisabled(input: {
  isGenerating: boolean;
  requiresRemovalConfirmation: boolean;
  confirmRemoval: boolean;
}): boolean {
  return input.isGenerating ||
    (input.requiresRemovalConfirmation && !input.confirmRemoval);
}

export function isAIStudioRemovalConfirmed<TCandidate>(
  candidate: TCandidate | null,
  confirmedCandidate: TCandidate | null,
): boolean {
  return candidate !== null && candidate === confirmedCandidate;
}

export function isAIStudioUndoDisabled(input: {
  isGenerating: boolean;
  historyLength: number;
  hasCandidate: boolean;
}): boolean {
  return input.isGenerating ||
    (input.historyLength === 0 && !input.hasCandidate);
}

export interface FreshAIStudioContext<TCandidate> {
  sessionId: string;
  appliedHtml: string;
  message: string;
  sessionMessages: AIStudioSessionMessage[];
  sessionSummary: AIStudioSessionSummary | null;
  compactionState: "idle";
  partial: string;
  candidate: TCandidate | null;
  attachedImageIds: string[];
  error: string;
  lastFailedMessage: string | null;
  justSwitchedProvider: boolean;
}

export function createFreshAIStudioContext<TCandidate>(input: {
  sessionId: string;
  appliedHtml: string;
  candidate?: TCandidate | null;
}): FreshAIStudioContext<TCandidate> {
  return {
    sessionId: input.sessionId,
    appliedHtml: input.appliedHtml,
    message: "",
    sessionMessages: [],
    sessionSummary: null,
    compactionState: "idle",
    partial: "",
    candidate: input.candidate ?? null,
    attachedImageIds: [],
    error: "",
    lastFailedMessage: null,
    justSwitchedProvider: false,
  };
}

export function resetAIStudioContext<TCandidate>(input: {
  sessionId: string;
  appliedHtml: string;
}): FreshAIStudioContext<TCandidate> {
  return createFreshAIStudioContext(input);
}

export function switchAIStudioProviderContext<TCandidate>(input: {
  sessionId: string;
  appliedHtml: string;
  candidate: TCandidate | null;
}): FreshAIStudioContext<TCandidate> {
  return createFreshAIStudioContext(input);
}

export function recoverAIStudioContext<TCandidate>(input: {
  sessionId: string;
  appliedHtml: string;
  candidate: TCandidate | null;
}): FreshAIStudioContext<TCandidate> {
  return createFreshAIStudioContext(input);
}
