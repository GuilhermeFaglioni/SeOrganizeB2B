"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Code2,
  Copy,
  EyeOff,
  Image as ImageIcon,
  MessageCircle,
  Monitor,
  Paperclip,
  RotateCcw,
  Save,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { useCan } from "@/hooks/use-permissions";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/stores/auth-context";
import {
  useAIStudioConfig,
  useRecordAIStudioConsent,
  useUpdateRefinedTemplate,
} from "@/hooks/use-ai-studio";
import { useCreateProposalTemplate, useProposalTemplates } from "@/hooks/use-proposals";
import { ProposalHtmlPreview } from "@/components/financial/proposals/proposal-html-preview";
import { Modal } from "@/components/ui/Modal";
import { Popup } from "@/components/ui/Popup";
import {
  installAIStudioPopstateGuard,
  type AIStudioPopstateGuardHandle,
} from "@/lib/ai/studio-navigation";
import {
  cleanupAIStudioSession,
  createAIStudioPagehideHandler,
  handleAIStudioExitClick,
  navigateAfterAIStudioCommit,
  type AIStudioCleanupInput,
  type AIStudioExitClickEvent,
  type AIStudioExitClickTarget,
} from "@/lib/ai/studio-exit-seams";
import { createAIStudioId } from "@/lib/ai/studio-identifiers";
import {
  registerAIStudioRouterGuard,
  releaseAIStudioRouterGuard,
} from "@/lib/ai/studio-router-guard";
import {
  getUnsubmittedAIStudioImageIds,
  registerAIStudioUpload,
} from "@/lib/ai/studio-image-lifecycle";
import {
  isAIStudioCandidateActionDisabled,
  isAIStudioDirty,
  isAIStudioRemovalConfirmed,
  isAIStudioUndoDisabled,
  recoverAIStudioContext,
  resetAIStudioContext,
  switchAIStudioProviderContext,
} from "@/lib/ai/studio-session-seams";
import {
  AI_STUDIO_MAX_IMAGES_PER_MESSAGE,
  AI_STUDIO_MAX_RECENT_MESSAGES,
  compactSessionMessage,
  type AIStudioCandidateResponse,
  type AIStudioImageFormat,
  type AIStudioImageReference,
  type AIStudioSessionMessage,
  type AIStudioSessionSummary,
} from "@/lib/ai/studio-contract";
import type { AIStudioRefinementBase } from "@/lib/ai/studio-service";
import type { AIProviderId } from "@/lib/ai/provider-contract";

interface Candidate extends AIStudioCandidateResponse {
  variableDiff: { added: string[]; removed: string[]; preserved: string[] };
  warnings: string[];
}

interface GenerationResult {
  candidate: Candidate;
  sessionSnapshot?: string;
}

interface StudioConnection {
  id: string;
  provider: AIProviderId;
  defaultModel: string | null;
  models: Array<{ id: string; vision: boolean; streaming: boolean; default: boolean }>;
}

interface StudioConfig {
  consentVersion: string;
  directiveConfigured: boolean;
  consents: Record<string, { accepted: boolean; acceptedAt: string | null }>;
  connections: StudioConnection[];
}

type CompactionState = "idle" | "compacting" | "compacted" | "error";
type LeaveSessionOptions = { releaseRouterGuard?: boolean };
type StudioView = "preview" | "html";
type ConfirmationKind = "removeVariables" | "updateOriginal";

const AI_STUDIO_CONFIRMATION_STORAGE_KEY = "seorganize:ai-studio:confirmations";

function requestSessionDiscard(sessionId: string): void {
  if (!sessionId) return;
  void fetch("/api/ai/studio/session", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
    keepalive: true,
  }).catch(() => undefined);
}

function requestImageDiscard(imageIds: string[]): void {
  if (imageIds.length === 0) return;
  void fetch("/api/ai/studio/images", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageIds }),
    keepalive: true,
  }).catch(() => undefined);
}

async function responseData<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json()) as {
    data?: T;
    error?: { code?: string; detailCode?: string };
  };
  if (!response.ok || payload.error) {
    const error = new Error(fallbackMessage) as Error & {
      code?: string;
      detailCode?: string;
    };
    error.code = payload.error?.code;
    error.detailCode = payload.error?.detailCode;
    throw error;
  }
  return payload.data as T;
}

function localeForApi(locale: string): "pt-BR" | "en" {
  return locale.startsWith("en") ? "en" : "pt-BR";
}

function providerDisplayName(provider: AIProviderId): string {
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
  if (provider === "opencode-go") return "OpenCode Go";
  return "OpenCode Zen";
}

function preferredModel(connection: {
  defaultModel: string | null;
  models: Array<{ id: string; default: boolean }>;
}): string {
  if (connection.defaultModel && connection.models.some((item) => item.id === connection.defaultModel)) {
    return connection.defaultModel;
  }
  return connection.models.find((item) => item.default)?.id ?? connection.models[0]?.id ?? "";
}

export function AIStudioEntry() {
  const t = useTranslations("proposals.aiStudio");
  const locale = useLocale();
  const { can } = useCan();
  const { user } = useAuth();
  const { data: workspace, isLoading: workspaceLoading } = useWorkspace();
  const eligible = can("financial.proposals.manageTemplates") && can("financial.proposals.generateWithAi");
  const financialAllowed = workspace?.features.allowedModules?.includes("financial.proposals") ?? false;
  const configQuery = useAIStudioConfig({ enabled: eligible && financialAllowed });
  const [mode, setMode] = useState<"choice" | "new" | "refine">("choice");

  if (workspaceLoading) {
    return <StudioState title={t("loadingTitle")} description={t("loadingDescription")} />;
  }

  if (!financialAllowed) {
    return (
      <StudioState title={t("featureGatedTitle")} description={t("featureGatedDescription")}>
        <Link href="/plans?module=financial.proposals" className="text-sm font-medium text-accent hover:underline">
          {t("goToPlans")}
        </Link>
      </StudioState>
    );
  }

  if (!eligible) {
    return <StudioState title={t("notAuthorizedTitle")} description={t("notAuthorizedDescription")} />;
  }
  if (configQuery.isLoading) return <StudioState title={t("loadingTitle")} description={t("loadingDescription")} />;
  if (configQuery.isError || !configQuery.data) {
    return (
      <StudioState title={t("loadFailedTitle")} description={t("loadFailedDescription")}>
        <button type="button" onClick={() => configQuery.refetch()} className="text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {t("retry")}
        </button>
      </StudioState>
    );
  }

  const config = configQuery.data;
  if (!config.enabled) return <StudioState title={t("disabledTitle")} description={t("disabledDescription")} />;

  if (config.connections.length === 0) {
    return (
      <StudioState title={t("noProviderTitle")} description={t("noProviderDescription")}>
        <Link href="/settings/ai" className="inline-flex min-h-[44px] items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {t("configureProvider")}
        </Link>
      </StudioState>
    );
  }

  if (mode === "choice") {
    return (
      <div className="h-full overflow-y-auto bg-page p-6 sm:p-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/financial/proposals/templates" aria-label={t("backToTemplates")} className="rounded-md p-2 text-text-secondary hover:bg-bg-secondary">
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{t("eyebrow")}</p>
              <h1 className="text-xl font-semibold text-text-primary">{t("title")}</h1>
            </div>
          </div>
          <p className="max-w-2xl text-sm text-text-secondary">{t("choiceDescription")}</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <button type="button" onClick={() => setMode("new")} className="rounded-xl border-2 border-accent bg-accent/5 p-5 text-left transition hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <Sparkles size={22} className="mb-4 text-accent" aria-hidden="true" />
              <h2 className="font-semibold text-text-primary">{t("newTemplateTitle")}</h2>
              <p className="mt-2 text-sm text-text-secondary">{t("newTemplateDescription")}</p>
              <span className="mt-4 inline-flex text-sm font-medium text-accent">{t("startNewTemplate")}</span>
            </button>
            <button type="button" onClick={() => setMode("refine")} className="rounded-xl border-2 border-accent bg-accent/5 p-5 text-left transition hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <RotateCcw size={22} className="mb-4 text-accent" aria-hidden="true" />
              <h2 className="font-semibold text-text-primary">{t("refineTemplateTitle")}</h2>
              <p className="mt-2 text-sm text-text-secondary">{t("refineTemplateDescription")}</p>
              <span className="mt-4 inline-flex text-sm font-medium text-accent">{t("startRefineTemplate")}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "refine") {
    return (
      <RefineTemplateFlow
        config={config}
        locale={localeForApi(locale)}
        workspaceId={`${workspace?.id ?? "workspace"}:${user?.id ?? "user"}`}
        onExit={() => setMode("choice")}
      />
    );
  }

  return (
    <TemplateStudio
      config={config}
      locale={localeForApi(locale)}
      workspaceId={`${workspace?.id ?? "workspace"}:${user?.id ?? "user"}`}
      onBack={() => setMode("choice")}
      refinement={null}
    />
  );
}

function StudioState({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center bg-page p-6 text-center" aria-live="polite">
      <h1 tabIndex={-1} className="text-lg font-semibold text-text-primary">{title}</h1>
      <p className="mt-2 max-w-xl text-sm text-text-secondary">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function RefineTemplateFlow({
  config,
  locale,
  workspaceId,
  onExit,
}: {
  config: StudioConfig;
  locale: "pt-BR" | "en";
  workspaceId: string;
  onExit: () => void;
}) {
  const [base, setBase] = useState<AIStudioRefinementBase | null>(null);
  if (!base) {
    return (
      <div className="h-full overflow-y-auto bg-page p-6 sm:p-10">
        <div className="mx-auto max-w-5xl">
          <RefineTemplatePicker onBack={onExit} onSelect={setBase} />
        </div>
      </div>
    );
  }
  return (
    <TemplateStudio
      config={config}
      locale={locale}
      workspaceId={workspaceId}
      onBack={() => setBase(null)}
      refinement={base}
    />
  );
}

function RefineTemplatePicker({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (base: AIStudioRefinementBase) => void;
}) {
  const t = useTranslations("proposals.aiStudio");
  const locale = useLocale();
  const templatesQuery = useProposalTemplates();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function pick(templateId: string) {
    setError("");
    setLoadingId(templateId);
    try {
      const response = await fetch(`/api/ai/studio/refine/${templateId}`);
      const base = await responseData<AIStudioRefinementBase>(response, t("operationFailed"));
      onSelect(base);
    } catch {
      setError(t("pickFailed"));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
         <button type="button" onClick={onBack} aria-label={t("backToChoices")} className="rounded-md p-2 text-text-secondary hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{t("eyebrow")}</p>
          <h1 className="text-xl font-semibold text-text-primary">{t("refinePickTitle")}</h1>
        </div>
      </div>
      <p className="max-w-2xl text-sm text-text-secondary">{t("refinePickDescription")}</p>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {templatesQuery.isLoading ? (
        <p className="text-sm text-text-muted">{t("loadingTemplates")}</p>
      ) : templatesQuery.isError ? (
        <p role="alert" className="text-sm text-danger">{t("pickFailed")}</p>
      ) : templatesQuery.data && templatesQuery.data.length > 0 ? (
        <ul className="space-y-2">
          {templatesQuery.data.map((template) => (
            <li key={template.id} className="rounded-xl border border-border bg-page-alt p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-text-primary">{template.name}</h2>
                  <p className="mt-1 text-xs text-text-muted">
                    {new Date(template.updatedAt).toLocaleDateString(locale === "en" ? "en-US" : "pt-BR")}
                  </p>
                </div>
                <button type="button" onClick={() => pick(template.id)} disabled={loadingId === template.id} className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50">
                  {loadingId === template.id ? t("pickLoading") : t("pickTemplate")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-border bg-page p-4 text-sm text-text-muted">{t("templatesEmpty")}</p>
      )}
    </div>
  );
}

function TemplateStudio({
  config,
  locale,
  workspaceId,
  onBack,
  refinement,
}: {
  config: StudioConfig;
  locale: "pt-BR" | "en";
  workspaceId: string;
  onBack: () => void;
  refinement: AIStudioRefinementBase | null;
}) {
  const t = useTranslations("proposals.aiStudio");
  const router = useRouter();
  const createTemplate = useCreateProposalTemplate();
  const updateOriginal = useUpdateRefinedTemplate();
  const recordConsent = useRecordAIStudioConsent();
  const firstConnection = config.connections[0];
  const [provider, setProvider] = useState(firstConnection.provider);
  const [model, setModel] = useState(preferredModel(firstConnection));
  const [message, setMessage] = useState("");
  const [templateName, setTemplateName] = useState(refinement?.name ?? "");
  const [html, setHtml] = useState(refinement?.html ?? "");
  const [preview, setPreview] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [partial, setPartial] = useState("");
  const [sessionMessages, setSessionMessages] = useState<AIStudioSessionMessage[]>([]);
  const [sessionSummary, setSessionSummary] = useState<AIStudioSessionSummary | null>(null);
  const [compactionState, setCompactionState] = useState<CompactionState>("idle");
  const [history, setHistory] = useState<string[]>([]);
  const [consentedProviders, setConsentedProviders] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.entries(config.consents).map(([name, consent]) => [name, consent.accepted])),
  );
  const [consentModalChecked, setConsentModalChecked] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [confirmedRemovalCandidate, setConfirmedRemovalCandidate] = useState<Candidate | null>(null);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [draftCount, setDraftCount] = useState(refinement?.draftCount ?? 0);
  const [refreshingDraftCount, setRefreshingDraftCount] = useState(false);
  const [attachedImages, setAttachedImages] = useState<AIStudioImageReference[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [justSwitchedProvider, setJustSwitchedProvider] = useState(false);
  const [sessionSnapshot, setSessionSnapshot] = useState<string | null>(null);
  const [studioView, setStudioView] = useState<StudioView>("preview");
  const [confirmation, setConfirmation] = useState<ConfirmationKind | null>(null);
  const [rememberConfirmation, setRememberConfirmation] = useState(false);
  const [rememberedConfirmations, setRememberedConfirmations] = useState<Record<ConfirmationKind, boolean>>({
    removeVariables: false,
    updateOriginal: false,
  });
  const sessionEpochRef = useRef(0);
  const uploadGenerationRef = useRef(0);
  const uploadedImageIdsRef = useRef(new Set<string>());
  const attachedImageFilesRef = useRef(new Map<string, File>());
  const pendingUploadControllersRef = useRef(new Set<AbortController>());
  const leaveSessionRef = useRef<(options?: LeaveSessionOptions) => void>(() => undefined);
  const confirmExitRef = useRef<() => boolean>(() => false);
  const bypassExitControlRef = useRef(false);
  const navigationGuardRef = useRef<AIStudioPopstateGuardHandle | null>(null);
  const candidateTitleRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedConnection = useMemo(() => config.connections.find((item) => item.provider === provider) ?? firstConnection, [config.connections, firstConnection, provider]);
  const selectedModel = selectedConnection.models.find((item) => item.id === model) ?? selectedConnection.models[0];
  const previewSource = candidate?.html ?? html;
  const baseHtml = refinement?.html ?? "";
  const consentChecked = consentedProviders[provider] === true;
  const confirmationStorageKey = `${AI_STUDIO_CONFIRMATION_STORAGE_KEY}:${workspaceId}`;
  const dirty = isAIStudioDirty({
    isGenerating,
    uploadingImage,
    hasCandidate: candidate !== null,
    historyLength: history.length,
    html,
    baseHtml,
    templateName,
    initialTemplateName: refinement?.name ?? "",
    message,
    sessionMessageCount: sessionMessages.length,
    sessionSummary,
    attachedImageCount: attachedImages.length,
  });
  const visionAvailable = selectedModel?.vision === true;
  const attachedBlocked = attachedImages.length > 0 && !visionAvailable;

  function imageFormatLabel(format: AIStudioImageFormat): string {
    return format === "jpeg" ? "JPEG" : format.toUpperCase();
  }

  const localizedImageError = useCallback(
    (
    code: string | undefined,
    detailCode: string | undefined,
    fallback: string,
    ): string => {
      switch (detailCode ?? code) {
        case "TOO_LARGE":
          return t("imageErrorTooLarge");
        case "TOO_MANY":
          return t("imageErrorTooMany");
        case "UNSUPPORTED_FORMAT":
          return t("imageErrorUnsupportedFormat");
        case "MISMATCHED_FORMAT":
          return t("imageErrorMismatchedFormat");
        case "INVALID_DIMENSIONS":
          return t("imageErrorInvalidDimensions");
        case "EMPTY":
          return t("imageErrorEmpty");
        case "IMAGE_EXPIRED":
          return t("imageErrorExpired");
        case "SESSION_SNAPSHOT_INVALID":
          return t("sessionSnapshotInvalid");
        case "NO_VISION_MODEL":
          return t("imageVisionRequired");
        default:
          return fallback;
      }
    },
    [t],
  );

  const localizedGenerationError = useCallback(
    (
      code: string | undefined,
      detailCode: string | undefined,
      fallback: string,
    ): string => {
      switch (code) {
        case "INVALID_STRUCTURED_OUTPUT":
          return t("invalidOutput");
        case "RATE_LIMITED":
          return t("rateLimited");
        case "TIMEOUT":
          return t("generationTimeout");
        case "PROVIDER_ERROR":
          return t("providerFailed");
        case "CONNECTION_UNAVAILABLE":
          return t("connectionUnavailable");
        case "CONSENT_REQUIRED":
          return t("consentRequired");
        default:
          return localizedImageError(code, detailCode, fallback);
      }
    },
    [localizedImageError, t],
  );

  const localizedStudioError = useCallback(
    (error: unknown, fallback: string): string => {
      const details = error as { code?: string; detailCode?: string };
      return localizedGenerationError(details.code, details.detailCode, fallback);
    },
    [localizedGenerationError],
  );

  function localizeStudioWarning(warning: string): string {
    return warning.includes("recursos externos") ? t("sanitizationWarning") : warning;
  }

  function generationConsumedImages(code: string | undefined): boolean {
    return (
      code === "TIMEOUT" ||
      code === "INVALID_STRUCTURED_OUTPUT" ||
      code === "PROVIDER_ERROR" ||
      code === "CONFIGURATION_ERROR" ||
      code === "PAYLOAD_LIMITED" ||
      code === "INTERNAL_ERROR" ||
      code === "IMAGE_EXPIRED" ||
      code === "IMAGE_VALIDATION_ERROR"
    );
  }

  async function handleAttachFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0 || !visionAvailable) return;
    const slotsLeft = AI_STUDIO_MAX_IMAGES_PER_MESSAGE - attachedImages.length;
    if (slotsLeft <= 0) {
      setImageError(t("imageMaxReached"));
      return;
    }
    const uploadEpoch = sessionEpochRef.current;
    const uploadGeneration = uploadGenerationRef.current;
    setImageError("");
    setUploadingImage(true);
    try {
      for (const file of files.slice(0, slotsLeft)) {
        const form = new FormData();
        const uploadId = createAIStudioId();
        form.append("file", file);
        form.append("uploadId", uploadId);
        const controller = new AbortController();
        const registration = registerAIStudioUpload({
          uploadId,
          controller,
          pendingControllers: pendingUploadControllersRef.current,
          uploadedImageIds: uploadedImageIdsRef.current,
        });
        try {
          const response = await fetch("/api/ai/studio/images", { method: "POST", body: form, signal: controller.signal });
          let payload: {
            data?: AIStudioImageReference;
            error?: { code?: string; detailCode?: string };
          } = {};
          try {
            payload = (await response.json()) as typeof payload;
          } catch {
            payload = {};
          }
          if (!response.ok || payload.error || !payload.data) {
            throw {
              code: payload.error?.code,
              detailCode: payload.error?.detailCode,
            };
          }
          const image = payload.data as AIStudioImageReference;
          registration.complete(image.id);
          attachedImageFilesRef.current.set(image.id, file);
          if (uploadEpoch !== sessionEpochRef.current || uploadGeneration !== uploadGenerationRef.current) {
            uploadedImageIdsRef.current.delete(image.id);
            attachedImageFilesRef.current.delete(image.id);
            requestImageDiscard([image.id]);
            continue;
          }
          setAttachedImages((previous) =>
            previous.length >= AI_STUDIO_MAX_IMAGES_PER_MESSAGE
              ? previous
              : [...previous, image],
          );
        } catch (uploadError) {
          registration.fail();
          requestImageDiscard([uploadId]);
          throw uploadError;
        }
      }
    } catch (attachError) {
      const details = attachError as { name?: string; code?: string; detailCode?: string };
      if (details.name === "AbortError") return;
      setImageError(localizedImageError(details.code, details.detailCode, t("imageUploadFailed")));
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleRemoveImage(imageId: string) {
    setAttachedImages((previous) => previous.filter((image) => image.id !== imageId));
    uploadedImageIdsRef.current.delete(imageId);
    attachedImageFilesRef.current.delete(imageId);
    setImageError("");
    try {
      await fetch("/api/ai/studio/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: [imageId] }),
      });
    } catch {
      // Best-effort server cleanup; the local reference is already gone.
    }
  }

  const abortPendingUploads = useCallback(() => {
    for (const controller of pendingUploadControllersRef.current) controller.abort();
    pendingUploadControllersRef.current.clear();
  }, []);

  function discardUnsubmittedImages(submittedImageIds: readonly string[]) {
    const orphaned = getUnsubmittedAIStudioImageIds(uploadedImageIdsRef.current, submittedImageIds);
    requestImageDiscard(orphaned);
    uploadedImageIdsRef.current.clear();
  }

  const createCleanupInput = useCallback((): AIStudioCleanupInput => {
    return {
      sessionId,
      attachedImageIds: attachedImages.map((image) => image.id),
      uploadedImageIds: uploadedImageIdsRef.current,
      invalidateSession: () => {
        sessionEpochRef.current += 1;
        uploadGenerationRef.current += 1;
      },
      abortPendingUploads,
      discardSession: requestSessionDiscard,
      discardImages: requestImageDiscard,
    };
  }, [abortPendingUploads, attachedImages, sessionId]);

  function leaveSession(options: LeaveSessionOptions = {}) {
    if (options.releaseRouterGuard) releaseAIStudioRouterGuard();
    cleanupAIStudioSession(createCleanupInput());
    uploadedImageIdsRef.current.clear();
    attachedImageFilesRef.current.clear();
    setAttachedImages([]);
    setImageError("");
    setIsGenerating(false);
    setUploadingImage(false);
    setCandidate(null);
    setHistory([]);
    setMessage("");
    setSessionMessages([]);
    setSessionSummary(null);
    setSessionSnapshot(null);
    setSessionId("");
    setCompactionState("idle");
    setPartial("");
    setError("");
    setLastFailedMessage(null);
    setJustSwitchedProvider(false);
    setConfirmedRemovalCandidate(null);
    setConfirmUpdate(false);
    setConfirmation(null);
    setRememberConfirmation(false);
    setConsentOpen(false);
    setConsentModalChecked(false);
    setHtml(refinement?.html ?? "");
    setTemplateName(refinement?.name ?? "");
  }

  function releaseForNavigation(onReleased: () => void) {
    const guard = navigationGuardRef.current;
    if (guard) {
      guard.releaseForNavigation(onReleased);
    } else {
      onReleased();
    }
  }

  leaveSessionRef.current = leaveSession;
  confirmExitRef.current = () => window.confirm(t("exitConfirm"));

  function discardSessionSnapshot() {
    requestSessionDiscard(sessionId);
    setSessionSnapshot(null);
  }

  useEffect(() => {
    setSessionId(createAIStudioId());
    setSessionSnapshot(null);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(confirmationStorageKey);
      if (!raw) {
        setRememberedConfirmations({ removeVariables: false, updateOriginal: false });
        return;
      }
      const parsed = JSON.parse(raw) as Partial<Record<ConfirmationKind, unknown>>;
      setRememberedConfirmations({
        removeVariables: parsed.removeVariables === true,
        updateOriginal: parsed.updateOriginal === true,
      });
    } catch {
      setRememberedConfirmations({ removeVariables: false, updateOriginal: false });
    }
  }, [confirmationStorageKey]);

  useEffect(() => {
    if (candidate) candidateTitleRef.current?.focus();
  }, [candidate]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: partial ? "auto" : "smooth", block: "end" });
  }, [candidate, error, partial, sessionMessages.length]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    return registerAIStudioRouterGuard({
      confirmExit: () => confirmExitRef.current(),
      leaveSession: () => leaveSessionRef.current({ releaseRouterGuard: true }),
      releaseForNavigation,
    });
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const handler = createAIStudioPagehideHandler(createCleanupInput());
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, [createCleanupInput, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a");
      const exitControl = event.target.closest("[data-ai-studio-exit]");
      if (!link && !exitControl) return;
      if (exitControl && bypassExitControlRef.current) return;
      let destination: URL | null = null;
      if (link) {
        const href = link.getAttribute("href");
        if (!href || href.startsWith("#")) return;
        destination = new URL(href, window.location.href);
        if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      }
      const target: AIStudioExitClickTarget = exitControl
        ? { kind: "exit-control", controlId: "sidebar" }
        : destination
          ? {
              kind: "link",
              href: destination.href,
              sameOrigin: destination.origin === window.location.origin,
              sameUrl: destination.href === window.location.href,
              opensNewTab: link?.target === "_blank",
              download: link?.hasAttribute("download") ?? false,
            }
          : { kind: "other" };
      const guard = navigationGuardRef.current;
      const navigate = () => {
        if (destination) {
          router.push(`${destination.pathname}${destination.search}${destination.hash}`);
        } else if (exitControl instanceof HTMLElement) {
          bypassExitControlRef.current = true;
          try {
            exitControl.click();
          } finally {
            bypassExitControlRef.current = false;
          }
        }
      };
      const exitEvent: AIStudioExitClickEvent = {
        target,
        button: event.button,
        defaultPrevented: event.defaultPrevented,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation(),
      };
      handleAIStudioExitClick(exitEvent, {
        confirmExit: () => window.confirm(t("exitConfirm")),
        leaveSession: () => leaveSessionRef.current({ releaseRouterGuard: true }),
        releaseForNavigation: (onReleased) => {
          if (guard) {
            guard.releaseForNavigation(onReleased);
          } else {
            onReleased();
          }
        },
        navigate,
      });
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [attachedImages, dirty, router, sessionId, t]);

  useEffect(() => {
    if (!dirty) return;
    const guard = installAIStudioPopstateGuard({
      history: window.history,
      target: window,
      currentUrl: window.location.href,
      confirmExit: () => confirmExitRef.current(),
      onExit: () => leaveSessionRef.current({ releaseRouterGuard: true }),
    });
    navigationGuardRef.current = guard;
    return () => {
      guard.dispose();
    };
  }, [dirty]);

  useEffect(() => {
    if (!previewSource.trim()) {
      setPreview("");
      setPreviewError("");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/ai/studio/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html: previewSource, locale }), signal: controller.signal });
        const data = await responseData<{ html: string }>(response, t("operationFailed"));
        setPreview(data.html);
        setPreviewError("");
      } catch (previewRequestError) {
        if (!controller.signal.aborted) setPreviewError(localizedStudioError(previewRequestError, t("previewFailed")));
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [locale, localizedStudioError, previewSource, t]);

  function handleProviderChange(nextProvider: string) {
    if (nextProvider === provider) return;
    const nextConnection = config.connections.find((connection) => connection.provider === nextProvider);
    if (!nextConnection) return;
    leaveSession();
    const freshContext = switchAIStudioProviderContext<Candidate>({
      sessionId: createAIStudioId(),
      appliedHtml: html,
      candidate,
    });
    setProvider(nextProvider as typeof provider);
    setModel(preferredModel(nextConnection));
    setHtml(freshContext.appliedHtml);
    setMessage(freshContext.message);
    setSessionId(freshContext.sessionId);
    setSessionSnapshot(null);
    setSessionMessages(freshContext.sessionMessages);
    setSessionSummary(freshContext.sessionSummary);
    setCompactionState(freshContext.compactionState);
    setPartial(freshContext.partial);
    setCandidate(freshContext.candidate);
    setLastFailedMessage(freshContext.lastFailedMessage);
    setConfirmedRemovalCandidate(null);
    setError("");
    setJustSwitchedProvider(true);
  }

  function openConsentDialog(): void {
    setConsentModalChecked(false);
    setConsentOpen(true);
  }

  async function acceptConsentAndGenerate(): Promise<void> {
    if (!consentModalChecked) {
      setError(t("consentRequired"));
      return;
    }
    if (!message.trim()) {
      setError(t("briefingRequired"));
      return;
    }

    setError("");
    try {
      await recordConsent.mutateAsync({ provider, version: config.consentVersion });
      setConsentedProviders((previous) => ({ ...previous, [provider]: true }));
      setConsentOpen(false);
      setConsentModalChecked(false);
      await runGeneration(message, { consentRecorded: true });
    } catch (consentError) {
      setError(localizedStudioError(consentError, t("consentRequired")));
    }
  }

  async function readGenerationResponse(response: Response): Promise<GenerationResult> {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/x-ndjson")) return responseData<GenerationResult>(response, t("operationFailed"));
    if (!response.body) throw new Error(t("streamFailed"));
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let complete: GenerationResult | null = null;
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { type: string; text?: string; data?: GenerationResult; error?: { code?: string; detailCode?: string } };
          if (event.type === "delta") setPartial((previous) => previous + (event.text ?? ""));
          if (event.type === "complete") complete = event.data ?? null;
          if (event.type === "error") {
            throw {
              code: event.error?.code,
              detailCode: event.error?.detailCode,
            };
          }
        }
        if (done) break;
      }
    } finally { reader.releaseLock(); }
    if (!complete) throw new Error(t("generationFailed"));
    return complete;
  }

  async function runGeneration(briefing: string, options: { consentRecorded?: boolean } = {}) {
    setError("");
    if (!briefing.trim()) { setError(t("briefingRequired")); return; }
    if (!consentChecked && !options.consentRecorded) { openConsentDialog(); return; }
    if (attachedBlocked) { setError(t("imageVisionRequired")); return; }
    if (uploadingImage) { setError(t("imageUploading")); return; }
    if (attachedImages.some((image) => !attachedImageFilesRef.current.has(image.id))) {
      setImageError(t("imageErrorExpired"));
      return;
    }
    const compacting = sessionMessages.length >= AI_STUDIO_MAX_RECENT_MESSAGES;
    const generationEpoch = sessionEpochRef.current;
    uploadGenerationRef.current += 1;
    const submittedImageIds = attachedImages.map((image) => image.id);
    setIsGenerating(true);
    setPartial("");
    setLastFailedMessage(null);
    setJustSwitchedProvider(false);
    setCompactionState(compacting ? "compacting" : "idle");
    try {
      const requestPayload = {
        provider,
        model,
        message: briefing,
        locale,
        sessionId,
        sessionSnapshot,
        recentMessages: sessionMessages,
        sessionSummary,
        consentVersion: config.consentVersion,
        baseHtml: html.trim() ? html : null,
        imageIds: attachedImages.map((image) => image.id),
        stream: Boolean(selectedModel.streaming),
      };
      const requestFiles = attachedImages.map((image) => attachedImageFilesRef.current.get(image.id));
      let requestBody: BodyInit = JSON.stringify(requestPayload);
      let requestHeaders: HeadersInit | undefined = { "Content-Type": "application/json" };
      if (requestFiles.length > 0) {
        const form = new FormData();
        for (const [key, value] of Object.entries(requestPayload)) {
          if (value !== undefined && value !== null) {
            form.append(key, typeof value === "string" ? value : JSON.stringify(value));
          }
        }
        for (const file of requestFiles) {
          if (file) form.append("imageFiles", file, file.name);
        }
        requestBody = form;
        requestHeaders = undefined;
      }
      const response = await fetch("/api/ai/studio/generate", { method: "POST", headers: requestHeaders, body: requestBody });
      const generation = await readGenerationResponse(response);
      if (generationEpoch !== sessionEpochRef.current) return;
      const nextCandidate = generation.candidate;
      setSessionSnapshot(generation.sessionSnapshot ?? sessionSnapshot);
      discardUnsubmittedImages(submittedImageIds);
      setAttachedImages([]);
      attachedImageFilesRef.current.clear();
      setImageError("");
      setCandidate(nextCandidate);
      setTemplateName((previous) => previous.trim() || nextCandidate.suggestedName);
      setSessionSummary(nextCandidate.sessionSummary);
      setSessionMessages((previous) => [...previous.slice(-(AI_STUDIO_MAX_RECENT_MESSAGES - 2)), { role: "user", content: compactSessionMessage(briefing) }, { role: "assistant", content: compactSessionMessage(nextCandidate.explanation) }]);
      setCompactionState(compacting ? "compacted" : "idle");
      setPartial("");
    } catch (generationError) {
       const withCode = generationError as { code?: string; detailCode?: string };
      if (generationConsumedImages(withCode.code)) {
        discardUnsubmittedImages(submittedImageIds);
        setAttachedImages([]);
        attachedImageFilesRef.current.clear();
        setImageError("");
      }
      if (withCode.detailCode === "SESSION_SNAPSHOT_INVALID") {
        sessionEpochRef.current += 1;
        uploadGenerationRef.current += 1;
        uploadedImageIdsRef.current.clear();
        setAttachedImages([]);
        attachedImageFilesRef.current.clear();
        setImageError("");
        discardSessionSnapshot();
        const freshContext = recoverAIStudioContext<Candidate>({
          sessionId: createAIStudioId(),
          appliedHtml: html,
          candidate,
        });
        setSessionId(freshContext.sessionId);
        setSessionMessages(freshContext.sessionMessages);
        setSessionSummary(freshContext.sessionSummary);
        setCompactionState(freshContext.compactionState);
        setPartial(freshContext.partial);
        setCandidate(freshContext.candidate);
        setLastFailedMessage(freshContext.lastFailedMessage);
      }
      if (withCode.code === "PAYLOAD_LIMITED") {
        setError(t("payloadLimitError"));
      } else {
        setError(localizedStudioError(generationError, t("generationFailed")));
      }
      setLastFailedMessage(briefing.trim());
      setCompactionState(compacting ? "error" : "idle");
      setPartial("");
    } finally { setIsGenerating(false); }
  }

  function handleGenerate(event: FormEvent) {
    event.preventDefault();
    void runGeneration(message);
  }

  function rememberConfirmationChoice(kind: ConfirmationKind): void {
    const next = { ...rememberedConfirmations, [kind]: true };
    setRememberedConfirmations(next);
    try {
      window.localStorage.setItem(confirmationStorageKey, JSON.stringify(next));
    } catch {
      // Remembering is best effort; the protected action still completes.
    }
  }

  function openConfirmation(kind: ConfirmationKind): void {
    setConfirmation(kind);
    setRememberConfirmation(rememberedConfirmations[kind]);
    if (kind === "updateOriginal") setConfirmUpdate(false);
  }

  function closeConfirmation(): void {
    setConfirmation(null);
    setRememberConfirmation(false);
  }

  function commitCandidate(): void {
    if (!candidate || isGenerating) return;
    setHistory((previous) => [...previous, html]);
    setHtml(candidate.html);
    setCandidate(null);
    setStudioView("preview");
  }

  function applyCandidate() {
    if (!candidate || isGenerating) return;
    const requiresRemovalConfirmation = Boolean(refinement && candidate.variableDiff.removed.length > 0);
    const removalConfirmed = isAIStudioRemovalConfirmed(candidate, confirmedRemovalCandidate);
    if (requiresRemovalConfirmation && !removalConfirmed && !rememberedConfirmations.removeVariables) {
      openConfirmation("removeVariables");
      return;
    }
    commitCandidate();
  }

  function undoLastChange() {
    if (isGenerating) return;
    if (candidate) { setCandidate(null); return; }
    if (history.length === 0) return;
    const previousHtml = history[history.length - 1] ?? "";
    setHtml(previousHtml);
    setHistory((previous) => previous.slice(0, -1));
  }

  function restoreRevision(index: number): void {
    if (isGenerating) return;
    const revision = history[index];
    if (revision === undefined) return;
    setHtml(revision);
    setHistory((previous) => previous.slice(0, index));
    setCandidate(null);
    setStudioView("preview");
  }

  function resetConversation() {
    leaveSession();
    const freshContext = resetAIStudioContext<Candidate>({
      sessionId: createAIStudioId(),
      appliedHtml: html,
    });
    setHtml(freshContext.appliedHtml);
    setMessage(freshContext.message);
    setSessionId(freshContext.sessionId);
    setSessionSnapshot(null);
    setSessionMessages(freshContext.sessionMessages);
    setSessionSummary(freshContext.sessionSummary);
    setCompactionState(freshContext.compactionState);
    setPartial(freshContext.partial);
    setCandidate(freshContext.candidate);
    setError(freshContext.error);
    setLastFailedMessage(freshContext.lastFailedMessage);
    setJustSwitchedProvider(freshContext.justSwitchedProvider);
    setStudioView("preview");
  }

  function handleBack() {
    if (dirty && !window.confirm(t("exitConfirm"))) return;
    leaveSession({ releaseRouterGuard: true });
    onBack();
  }

  function saveTemplate(event: FormEvent) {
    event.preventDefault();
    if (!templateName.trim() || !html.trim()) return;
    createTemplate.mutate({ name: templateName.trim(), html, source: "ai-studio" }, { onSuccess: () => {
      navigateAfterAIStudioCommit({
        leaveSession: () => leaveSession({ releaseRouterGuard: true }),
        releaseForNavigation,
        navigate: () => router.push("/financial/proposals/templates"),
      });
    } });
  }

  async function commitOriginalUpdate(confirmed = confirmUpdate) {
    if (!refinement || !confirmed || !html.trim()) return;
    setError("");
    try {
      await updateOriginal.mutateAsync({ templateId: refinement.id, html, confirmed: true });
      navigateAfterAIStudioCommit({
        leaveSession: () => leaveSession({ releaseRouterGuard: true }),
        releaseForNavigation,
        navigate: () => router.push("/financial/proposals/templates"),
      });
    } catch (updateError) {
      setError(localizedStudioError(updateError, t("updateFailed")));
    }
  }

  function handleUpdateOriginal() {
    if (!refinement || !html.trim()) return;
    if (!rememberedConfirmations.updateOriginal) {
      openConfirmation("updateOriginal");
      return;
    }
    setConfirmUpdate(true);
    void commitOriginalUpdate(true);
  }

  function confirmProtectedAction(): void {
    if (!confirmation) return;
    if (rememberConfirmation) rememberConfirmationChoice(confirmation);

    if (confirmation === "removeVariables") {
      if (!candidate) return;
      setConfirmedRemovalCandidate(candidate);
      closeConfirmation();
      commitCandidate();
      return;
    }

    if (!confirmUpdate) return;
    closeConfirmation();
    void commitOriginalUpdate(true);
  }

  async function handleConfirmUpdateChange(checked: boolean) {
    setConfirmUpdate(checked);
    if (!checked || !refinement) return;
    setRefreshingDraftCount(true);
    try {
      const response = await fetch(`/api/ai/studio/refine/${refinement.id}`);
      const base = await responseData<AIStudioRefinementBase>(response, t("operationFailed"));
      setDraftCount(base.draftCount);
    } catch {
      // Keep the session-start count; the update endpoint recomputes it anyway.
    } finally {
      setRefreshingDraftCount(false);
    }
  }

  const requiresRemovalConfirmation = Boolean(refinement && candidate && candidate.variableDiff.removed.length > 0);
  const confirmRemoval = isAIStudioRemovalConfirmed(candidate, confirmedRemovalCandidate);
  const candidateActionDisabled = isAIStudioCandidateActionDisabled({
    isGenerating,
    // The protected action is confirmed in the modal instead of blocking the
    // review button behind an inline checkbox.
    requiresRemovalConfirmation: requiresRemovalConfirmation && Boolean(confirmation),
    confirmRemoval,
  });
  const protectedActionReady = confirmation === "removeVariables" ? confirmRemoval : confirmUpdate;

  function copyChatMessage(content: string): void {
    void navigator.clipboard?.writeText(content);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-page text-text-primary">
      <header className="flex h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-page-alt px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label={t("backToChoices")}
            className="rounded-md p-2 text-text-secondary transition hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{t("eyebrow")}</p>
            <h1 className="truncate text-lg font-semibold text-text-primary sm:text-xl">
              {refinement ? t("refineTemplateTitle") : t("newTemplateTitle")}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {candidate ? (
            <span className="hidden items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent sm:inline-flex">
              <Sparkles size={13} aria-hidden="true" /> {t("candidatePendingLabel")}
            </span>
          ) : null}
          <div className="inline-flex rounded-lg border border-border bg-page p-1" role="group" aria-label={t("viewModeLabel")}>
            <button
              type="button"
              aria-pressed={studioView === "preview"}
              onClick={() => setStudioView("preview")}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${studioView === "preview" ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-secondary"}`}
            >
              <Monitor size={14} aria-hidden="true" /> {t("previewMode")}
            </button>
            <button
              type="button"
              aria-pressed={studioView === "html"}
              onClick={() => setStudioView("html")}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${studioView === "html" ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-secondary"}`}
            >
              <Code2 size={14} aria-hidden="true" /> {t("sourceMode")}
            </button>
          </div>
          <Popup
            id="ai-studio-settings"
            label={t("settingsLabel")}
            size="lg"
            align="end"
            triggerAsChild
            trigger={
              <button
                type="button"
                aria-label={t("settingsLabel")}
                className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border bg-page px-3 text-text-secondary transition hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Settings2 size={17} aria-hidden="true" />
              </button>
            }
          >
            {(close) => (
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">{t("settingsLabel")}</h2>
                  <p className="mt-1 text-xs text-text-muted">{t("settingsDescription")}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label htmlFor="ai-studio-provider" className="text-sm text-text-secondary">
                    <span className="mb-1 block font-medium text-text-primary">{t("providerLabel")}</span>
                    <span className="relative block">
                      <select
                        id="ai-studio-provider"
                        value={provider}
                        onChange={(event) => handleProviderChange(event.target.value)}
                        disabled={isGenerating}
                        className="min-h-[44px] w-full appearance-none rounded-md border border-border bg-page px-3 pr-10 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {config.connections.map((connection) => (
                          <option key={connection.id} value={connection.provider}>{providerDisplayName(connection.provider)}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-3.5 text-text-muted" aria-hidden="true" />
                    </span>
                  </label>
                  <label htmlFor="ai-studio-model" className="text-sm text-text-secondary">
                    <span className="mb-1 block font-medium text-text-primary">{t("modelLabel")}</span>
                    <span className="relative block">
                      <select
                        id="ai-studio-model"
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        className="min-h-[44px] w-full appearance-none rounded-md border border-border bg-page px-3 pr-10 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {selectedConnection.models.map((item) => (
                          <option key={item.id} value={item.id}>{item.id}{item.default ? ` — ${t("defaultModel")}` : ""}{item.vision ? ` · ${t("vision")}` : ""}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-3.5 text-text-muted" aria-hidden="true" />
                    </span>
                  </label>
                </div>
                <p role="status" aria-live="polite" className="text-xs text-text-muted">
                  {config.directiveConfigured ? t("directiveSnapshot") : t("noDirectiveWarning")}
                </p>
                {justSwitchedProvider ? <p className="text-xs text-text-muted">{t("providerSwitchContext")}</p> : null}
                {refinement ? (
                  <div className="space-y-3 border-t border-border pt-4">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{t("updateOriginalTitle")}</h3>
                      <p className="mt-1 text-xs text-text-secondary">{t("updateOriginalDescription")}</p>
                    </div>
                    <p className={`text-xs ${draftCount > 0 ? "text-amber-700" : "text-text-muted"}`}>
                      {draftCount > 0 ? t("draftImpactWarning", { count: draftCount }) : t("draftImpactNone")}
                    </p>
                    <button
                      type="button"
                      onClick={() => { close(); handleUpdateOriginal(); }}
                      disabled={updateOriginal.isPending || !html.trim()}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-danger px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updateOriginal.isPending ? t("updating") : t("updateOriginal")}
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => { close(); resetConversation(); }}
                  disabled={isGenerating}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw size={15} aria-hidden="true" /> {t("newConversationKeepDraft")}
                </button>
                {history.length > 0 ? (
                  <div className="space-y-2 border-t border-border pt-4">
                    <h3 className="text-sm font-semibold text-text-primary">{t("historyLabel")}</h3>
                    <ul className="space-y-1.5">
                      {history.map((_, index) => {
                        const revisionIndex = history.length - index - 1;
                        return (
                          <li key={revisionIndex}>
                            <button
                              type="button"
                              onClick={() => { close(); restoreRevision(revisionIndex); }}
                              className="flex min-h-[36px] w-full items-center justify-between rounded-md border border-border px-2.5 text-left text-xs text-text-secondary transition hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              <span>{t("revisionNumber", { number: revisionIndex + 1 })}</span>
                              <span className="text-accent">{t("restoreRevision")}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </Popup>
        </div>
      </header>

      {refinement ? (
        <div className="border-b border-border bg-amber-500/5 px-4 py-2.5 sm:px-5">
          <p className="text-xs text-text-secondary">{t("refiningBase", { name: refinement.name })}</p>
          {refinement.warnings.length > 0 ? (
            <ul className="mt-1 space-y-1 text-xs text-amber-700" aria-label={t("warningsAria")}>
              {refinement.warnings.map((warning) => <li key={warning}>⚠ {localizeStudioWarning(warning)}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(240px,0.85fr)_minmax(320px,1.15fr)] lg:grid-cols-[minmax(0,1fr)_390px] lg:grid-rows-1" aria-busy={isGenerating}>
        <main className="flex min-h-0 min-w-0 flex-col bg-page">
          <form onSubmit={saveTemplate} className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <label htmlFor="ai-studio-template-name" className="sr-only">{t("nameLabel")}</label>
                <input
                  id="ai-studio-template-name"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  maxLength={120}
                  required
                  placeholder={t("namePlaceholder")}
                  className="min-h-[40px] w-full max-w-xl border-0 bg-transparent px-0 text-base font-semibold text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>{studioView === "preview" ? t("previewTitle") : t("htmlLabel")}</span>
                <button
                  type="button"
                  onClick={undoLastChange}
                  disabled={isAIStudioUndoDisabled({ isGenerating, historyLength: history.length, hasCandidate: candidate !== null })}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-text-secondary transition hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Undo2 size={14} aria-hidden="true" /> {t("undo")}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              {studioView === "html" ? (
                <section className="flex h-full min-h-[520px] flex-col rounded-xl border border-border bg-page-alt p-4" aria-labelledby="ai-studio-editor-title">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 id="ai-studio-editor-title" className="font-semibold text-text-primary">{t("editorTitle")}</h2>
                      <p className="mt-1 text-xs text-text-muted">{t("htmlSourceDescription")}</p>
                    </div>
                    <Code2 size={18} className="text-text-muted" aria-hidden="true" />
                  </div>
                  <label htmlFor="ai-studio-html" className="sr-only">{t("htmlLabel")}</label>
                  <textarea
                    id="ai-studio-html"
                    value={html}
                    onChange={(event) => setHtml(event.target.value)}
                    spellCheck={false}
                    placeholder={t("htmlPlaceholder")}
                    className="min-h-0 flex-1 resize-none rounded-lg border border-border bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </section>
              ) : (
                <section className="space-y-3" aria-labelledby="ai-studio-preview-title">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div>
                      <h2 id="ai-studio-preview-title" className="font-semibold text-text-primary">{t("previewTitle")}</h2>
                      <p className="mt-1 text-xs text-text-muted">{candidate ? t("candidatePreview") : t("syntheticValues")}</p>
                    </div>
                    <Monitor size={18} className="text-text-muted" aria-hidden="true" />
                  </div>
                  {previewError ? <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{previewError}</p> : null}
                  {!preview ? (
                    <p className="flex min-h-[520px] items-center justify-center rounded-xl border border-dashed border-border bg-page-alt p-6 text-center text-sm text-text-muted">{t("previewEmpty")}</p>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
                      <div role="group" aria-label={t("desktopPreviewTitle")}>
                        <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium text-text-muted"><Monitor size={13} aria-hidden="true" /> {t("desktop")}</p>
                        <ProposalHtmlPreview html={preview} title={t("desktopPreviewTitle")} className="h-[min(66vh,720px)]" />
                      </div>
                      <div role="group" aria-label={t("mobilePreviewTitle")} className="max-w-[390px]">
                        <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium text-text-muted"><Monitor size={13} aria-hidden="true" /> {t("mobile")}</p>
                        <ProposalHtmlPreview html={preview} title={t("mobilePreviewTitle")} className="h-[min(66vh,720px)]" />
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-page-alt px-4 py-3 sm:px-6">
              <p className="max-w-xl text-xs text-text-muted">{refinement ? t("saveAsNewHint") : t("saveHint")}</p>
              <button
                type="submit"
                disabled={createTemplate.isPending || !templateName.trim() || !html.trim()}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={15} aria-hidden="true" /> {createTemplate.isPending ? t("saving") : t("saveAsNew")}
              </button>
            </footer>
          </form>
        </main>

        <aside className="flex min-h-0 min-w-0 flex-col border-t border-border bg-page-alt lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent"><MessageCircle size={16} aria-hidden="true" /></span>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{t("chatTitle")}</h2>
                <p className="text-xs text-text-muted">{providerDisplayName(provider)} · {selectedModel?.id ?? model}</p>
              </div>
            </div>
            <span className="size-2 rounded-full bg-emerald-500" aria-label={t("connectedStatus")} title={t("connectedStatus")} />
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
            {sessionMessages.length === 0 && !candidate && !partial ? (
              <div className="flex min-h-full flex-col justify-center px-2 py-8 text-center">
                <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Sparkles size={20} aria-hidden="true" />
                </span>
                <p className="mt-4 text-base font-semibold text-text-primary">{t("chatEmptyTitle")}</p>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-text-muted">{refinement ? t("refinementBriefingPlaceholder") : t("briefingPlaceholder")}</p>
              </div>
            ) : null}
            {sessionMessages.map((sessionMessage, index) => (
              <article key={`${sessionMessage.role}-${index}`} className={sessionMessage.role === "user" ? "ml-auto max-w-[92%]" : "max-w-[94%]"}>
                {sessionMessage.role === "user" ? (
                  <div className="rounded-2xl border border-border bg-page-alt px-4 py-3 text-sm leading-relaxed text-text-primary shadow-sm">
                    {sessionMessage.content}
                  </div>
                ) : (
                  <div className="space-y-3 px-1 py-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-text-muted">
                      <Sparkles size={15} className="text-accent" aria-hidden="true" />
                      {t("thinkingFor", { seconds: 1 })}
                    </p>
                    <p className="text-[15px] font-medium leading-7 text-text-primary">{sessionMessage.content}</p>
                    <footer className="flex items-center justify-end gap-3 text-xs text-text-muted">
                      <span>{t("justNow")}</span>
                      <button type="button" onClick={() => copyChatMessage(sessionMessage.content)} aria-label={t("copyMessage")} className="rounded-md p-1 transition hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        <Copy size={15} aria-hidden="true" />
                      </button>
                    </footer>
                  </div>
                )}
              </article>
            ))}
            {partial ? (
              <div role="status" aria-live="polite" aria-label={t("streamingOutputAria")} className="space-y-3 px-1 py-1">
                <p className="flex items-center gap-2 text-sm font-medium text-accent"><Sparkles size={15} aria-hidden="true" /> {t("generating")}</p>
                <p className="text-[15px] leading-7 text-text-primary">{partial}</p>
              </div>
            ) : null}

            {candidate ? (
              <section className="space-y-3 rounded-xl border-2 border-accent/30 bg-accent/5 p-3.5" aria-labelledby="ai-studio-candidate-title">
                <div className="flex items-start gap-2">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                  <div>
                    <h2 ref={candidateTitleRef} tabIndex={-1} id="ai-studio-candidate-title" className="font-semibold text-text-primary">{t("candidateTitle")}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">{candidate.explanation}</p>
                  </div>
                </div>
                {candidate.warnings.length > 0 ? (
                  <ul className="space-y-1 text-xs text-amber-700" aria-label={t("warningsAria")}>
                    {candidate.warnings.map((warning) => <li key={warning}>⚠ {localizeStudioWarning(warning)}</li>)}
                  </ul>
                ) : null}
                {refinement && (candidate.variableDiff.added.length > 0 || candidate.variableDiff.removed.length > 0 || candidate.variableDiff.preserved.length > 0) ? (
                  <div className="space-y-2 rounded-lg border border-border bg-page p-3">
                    <h3 className="text-xs font-semibold text-text-primary">{t("variableDiffTitle")}</h3>
                    {candidate.variableDiff.added.length > 0 ? <p className="text-xs text-accent">{t("variablesAdded")}: {candidate.variableDiff.added.map((name) => `{{${name}}}`).join(", ")}</p> : null}
                    {candidate.variableDiff.removed.length > 0 ? <p className="text-xs text-amber-700">{t("variablesRemoved")}: {candidate.variableDiff.removed.map((name) => `{{${name}}}`).join(", ")}</p> : null}
                    {candidate.variableDiff.preserved.length > 0 ? <p className="text-xs text-text-muted">{t("variablesPreserved")}: {candidate.variableDiff.preserved.map((name) => `{{${name}}}`).join(", ")}</p> : null}
                  </div>
                ) : null}
                {candidate.customVariables.length > 0 ? (
                  <div className="rounded-lg border border-border bg-page p-3">
                    <h3 className="text-xs font-semibold text-text-primary">{t("customVariablesTitle")}</h3>
                    <ul className="mt-1 space-y-1 text-xs text-text-secondary">
                      {candidate.customVariables.map((variable) => <li key={variable.name}><code>{`{{${variable.name}}}`}</code> — {variable.description}</li>)}
                    </ul>
                    <p className="mt-2 text-xs text-text-muted">{t("customVariablesPending")}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyCandidate}
                    disabled={candidateActionDisabled}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check size={15} aria-hidden="true" /> {t("applyCandidate")}
                  </button>
                  <button
                    type="button"
                    onClick={undoLastChange}
                    disabled={isGenerating}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Undo2 size={15} aria-hidden="true" /> {t("discardCandidate")}
                  </button>
                </div>
              </section>
            ) : null}
            {error ? <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p> : null}
            {error && lastFailedMessage && !isGenerating ? (
              <button type="button" onClick={() => void runGeneration(lastFailedMessage)} className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <Sparkles size={15} aria-hidden="true" /> {t("retryGeneration")}
              </button>
            ) : null}
            <div ref={chatEndRef} aria-hidden="true" />
          </div>

          <form onSubmit={handleGenerate} aria-busy={isGenerating} className="shrink-0 border-t border-border bg-page p-3 sm:p-4">
            <div className="rounded-2xl border border-border bg-page-alt p-3 shadow-sm transition focus-within:border-accent/60 focus-within:shadow-md">
              <div className="flex items-start justify-between gap-3 px-1 text-xs text-text-muted">
                <span>{t("briefingHint", { count: message.length })}</span>
                <span className="text-right">{t("contextWindow", { count: sessionMessages.length, max: AI_STUDIO_MAX_RECENT_MESSAGES })}</span>
              </div>
              <label htmlFor="ai-studio-briefing" className="sr-only">{refinement ? t("refinementBriefingLabel") : t("briefingLabel")}</label>
              <textarea
                id="ai-studio-briefing"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={8000}
                rows={3}
                placeholder={t("chatComposerPlaceholder")}
                className="mt-2 min-h-[88px] w-full resize-none border-0 bg-transparent p-1 text-[15px] leading-7 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-0"
              />
              {attachedImages.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5 px-1 pb-2" aria-label={t("imageListAria")}>
                  {attachedImages.map((image) => (
                    <li key={image.id} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-page px-2 py-1 text-xs text-text-secondary">
                      <ImageIcon size={13} aria-hidden="true" className="shrink-0 text-text-muted" />
                      <span className="max-w-32 truncate">{image.fileName}</span>
                      <span className="shrink-0 text-[11px] text-text-muted">{imageFormatLabel(image.format)}</span>
                      <button type="button" onClick={() => handleRemoveImage(image.id)} aria-label={t("imageRemove", { name: image.fileName })} className="rounded p-0.5 text-text-muted hover:bg-bg-secondary hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Trash2 size={13} aria-hidden="true" /></button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <label className="relative min-w-0">
                    <span className="sr-only">{t("providerLabel")}</span>
                    <select value={provider} onChange={(event) => handleProviderChange(event.target.value)} disabled={isGenerating} className="h-8 max-w-[112px] appearance-none rounded-lg bg-bg-secondary px-2.5 pr-3 text-xs font-medium text-text-secondary outline-none transition hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50">
                      {config.connections.map((connection) => (
                        <option key={connection.id} value={connection.provider}>{providerDisplayName(connection.provider)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="relative min-w-0">
                    <span className="sr-only">{t("modelLabel")}</span>
                    <select value={model} onChange={(event) => setModel(event.target.value)} className="h-8 max-w-[112px] appearance-none rounded-lg bg-transparent px-1.5 text-xs text-text-muted outline-none transition hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent">
                      {selectedConnection.models.map((item) => (
                        <option key={item.id} value={item.id}>{item.id}</option>
                      ))}
                    </select>
                  </label>
                  {visionAvailable ? (
                    <label className="inline-flex min-h-[34px] cursor-pointer items-center justify-center rounded-lg px-2 text-text-muted transition hover:bg-bg-secondary hover:text-text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-accent" title={uploadingImage ? t("imageUploading") : t("imageAttach")}>
                      <Paperclip size={17} aria-hidden="true" />
                      <span className="sr-only">{uploadingImage ? t("imageUploading") : t("imageAttach")}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={handleAttachFiles} disabled={isGenerating || uploadingImage || attachedImages.length >= AI_STUDIO_MAX_IMAGES_PER_MESSAGE} aria-label={t("imageAttachAria")} />
                    </label>
                  ) : <span className="inline-flex items-center gap-1.5 px-2 text-xs text-text-muted"><EyeOff size={14} aria-hidden="true" /> {t("imageVisionBlocked")}</span>}
                  <span className="px-1 text-xs text-text-muted">{t("imageCount", { count: attachedImages.length })}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {selectedModel?.streaming ? <span className="sr-only">{t("streamingSupported")}</span> : null}
                  <button type="submit" aria-label={isGenerating ? t("generating") : t("generate")} disabled={isGenerating || uploadingImage || recordConsent.isPending || !message.trim()} className="inline-flex size-10 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50">
                    <Send size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            {attachedBlocked ? <p role="alert" className="mt-2 text-xs text-amber-700">{t("imageVisionSwitchWarning")}</p> : null}
            {imageError ? <p role="alert" className="mt-2 text-xs text-danger">{imageError}</p> : null}
            {justSwitchedProvider ? <p className="mt-2 text-xs text-text-muted">{t("providerSwitchContext")}</p> : null}
            {compactionState === "compacting" ? <p role="status" className="mt-2 text-xs font-medium text-accent">{t("contextCompacting")}</p> : null}
            {compactionState === "compacted" ? <p className="mt-2 text-xs font-medium text-accent">{t("contextCompacted")}</p> : null}
            {compactionState === "error" ? <p role="status" className="mt-2 text-xs font-medium text-amber-800">{t("contextCompactionError")}</p> : null}
            <span className="sr-only" role="status" aria-live="polite">{isGenerating ? t("generationStatus") : ""}</span>
          </form>
        </aside>
      </div>

      <Modal
        id="ai-studio-consent"
        open={consentOpen}
        onOpenChange={(open) => {
          setConsentOpen(open);
          if (!open) setConsentModalChecked(false);
        }}
        title={t("consentTitle")}
        description={t("consentDescription")}
        closeLabel={t("cancelAction")}
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-page-alt p-4 text-sm text-text-muted">
            <div>
              <p className="text-xl font-medium text-text-primary">{message.length}/8000</p>
              <p>{t("characterCountLabel")}</p>
            </div>
            <div>
              <p className="text-xl font-medium text-text-primary">{sessionMessages.length}/{AI_STUDIO_MAX_RECENT_MESSAGES}</p>
              <p>{t("contextMessagesLabel")}</p>
            </div>
          </div>
          <div className="flex items-start justify-between gap-3 text-sm text-text-muted">
            <p className="flex min-w-0 items-start gap-2 leading-6">
              <EyeOff size={16} className="mt-1 shrink-0" aria-hidden="true" />
              <span>{visionAvailable ? t("visionAvailable") : t("imageVisionBlocked")}</span>
            </p>
            <span className="shrink-0">{t("imageCount", { count: attachedImages.length })}</span>
          </div>
          <label htmlFor="ai-studio-consent-modal" className="flex items-start gap-3 text-sm leading-6 text-text-secondary">
            <input id="ai-studio-consent-modal" type="checkbox" checked={consentModalChecked} required aria-required="true" aria-describedby="ai-studio-consent-copy ai-studio-consent-version" onChange={(event) => setConsentModalChecked(event.target.checked)} className="mt-1 size-5 shrink-0 accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
            <span id="ai-studio-consent-copy">{t("consentText", { provider: providerDisplayName(provider) })}</span>
          </label>
          <p className="text-sm leading-6 text-text-muted">
            {t("consentLegalPrefix")} <Link href="/privacy" className="text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{t("consentPrivacyLink")}</Link> {t("consentLegalAnd")} <Link href="/terms" className="text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{t("consentTermsLink")}</Link>.
          </p>
          <p id="ai-studio-consent-version" className="text-xs text-text-muted">{t("consentVersion", { version: config.consentVersion })}</p>
          <p className="text-sm leading-6 text-text-muted">{t("imagePrivacyHint")}</p>
          {error ? <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p> : null}
          <button type="button" onClick={() => void acceptConsentAndGenerate()} disabled={!consentModalChecked || !message.trim() || recordConsent.isPending} className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-base font-semibold text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50">
            <Send size={18} aria-hidden="true" /> {recordConsent.isPending ? t("generating") : t("generate")}
          </button>
        </div>
      </Modal>

      <Modal
        id="ai-studio-protected-action"
        open={confirmation !== null}
        onOpenChange={(open) => { if (!open) closeConfirmation(); }}
        title={confirmation === "removeVariables" ? t("removeVariablesConfirmationTitle") : t("updateConfirmationTitle")}
        description={confirmation === "removeVariables" ? t("removeVariablesConfirmationDescription") : t("updateConfirmationDescription")}
        closeLabel={t("cancelAction")}
        size="sm"
      >
        <div className="space-y-4">
          {confirmation === "removeVariables" && candidate ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs font-semibold text-amber-800">{t("variablesRemoved")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {candidate.variableDiff.removed.map((name) => <code key={name} className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-800">{`{{${name}}}`}</code>)}
              </div>
            </div>
          ) : null}
          {confirmation === "updateOriginal" ? (
            <p className={`text-sm ${draftCount > 0 ? "text-amber-700" : "text-text-secondary"}`}>
              {draftCount > 0 ? t("draftImpactWarning", { count: draftCount }) : t("draftImpactNone")}
            </p>
          ) : null}
          <label className="flex items-start gap-3 rounded-lg border border-border bg-page p-3 text-sm text-text-secondary focus-within:outline-none focus-within:ring-2 focus-within:ring-accent">
            <input
              type="checkbox"
              checked={confirmation === "removeVariables" ? confirmRemoval : confirmUpdate}
              onChange={(event) => {
                if (confirmation === "removeVariables") {
                  setConfirmedRemovalCandidate(event.target.checked ? candidate : null);
                } else {
                  void handleConfirmUpdateChange(event.target.checked);
                }
              }}
              className="mt-1 size-4 shrink-0 accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <span>{confirmation === "removeVariables" ? t("confirmRemovedVariables") : t("updateConfirm")}</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-text-secondary">
            <input type="checkbox" checked={rememberConfirmation} onChange={(event) => setRememberConfirmation(event.target.checked)} className="mt-1 size-4 shrink-0 accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
            <span>{t("rememberConfirmation")}</span>
          </label>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={closeConfirmation} className="inline-flex min-h-[42px] items-center rounded-md border border-border px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{t("cancelAction")}</button>
            <button type="button" onClick={confirmProtectedAction} disabled={!protectedActionReady || refreshingDraftCount || updateOriginal.isPending} className="inline-flex min-h-[42px] items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"><Check size={15} aria-hidden="true" /> {t("confirmAction")}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
