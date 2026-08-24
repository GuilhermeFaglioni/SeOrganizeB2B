import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("AI Studio #171 UI seams", () => {
  it("enters from proposal templates and offers New template before future refinement", () => {
    const list = read("src/components/financial/proposals/proposal-templates-list.tsx");
    const page = read("src/components/financial/proposals/ai-studio.tsx");
    expect(list).toContain("/financial/proposals/templates/ai-studio");
    expect(list).toContain("financial.proposals.generateWithAi");
    expect(page).toContain("newTemplateTitle");
    expect(page).toContain("refineTemplateTitle");
  });

  it("exposes desktop/mobile preview, manual edit, apply and undo controls", () => {
    const page = read("src/components/financial/proposals/ai-studio.tsx");
    expect(page).toContain("/api/ai/studio/generate");
    expect(page).toContain("/api/ai/studio/preview");
    expect(page).toContain("application/x-ndjson");
    expect(page).toContain("applyCandidate");
    expect(page).toContain("undoLastChange");
    expect(page).toContain("desktop");
    expect(page).toContain("mobile");
    expect(existsSync(resolve(root, "src/app/(authenticated)/financial/proposals/templates/ai-studio/page.tsx"))).toBe(true);
  });

  it("gives AI Studio a dedicated viewport shell with the main sidebar and no financial tabs", () => {
    const appLayout = read("src/components/layout/app-layout.tsx");
    const financialLayout = read("src/app/(authenticated)/financial/layout.tsx");
    const sidebar = read("src/components/layout/sidebar.tsx");
    expect(appLayout).toContain('pathname === "/financial/proposals/templates/ai-studio"');
    expect(appLayout).toContain('data-balsa="ai-studio-shell"');
    expect(appLayout).toContain("h-[100dvh]");
    expect(appLayout).toContain("<Sidebar");
    expect(appLayout).toContain('data-testid="ai-studio-menu-trigger"');
    expect(financialLayout).toContain("!isAIStudio && <FinancialTabs />");
    expect(financialLayout).toContain("overflow-hidden");
    expect(sidebar).toContain('href: "/financial/proposals/templates/ai-studio"');
    expect(sidebar).toContain('testId: "nav-ai-studio"');
  });
});

describe("AI Studio #173 refinement UI seams", () => {
  const page = () => read("src/components/financial/proposals/ai-studio.tsx");

  it("opens a refinement session from the workspace template list", () => {
    const source = page();
    expect(source).toContain('setMode("refine")');
    expect(source).toContain("/api/ai/studio/refine/");
    expect(source).toContain("useProposalTemplates");
    expect(source).toContain("RefineTemplatePicker");
  });

  it("starts the refinement session without a prior transcript", () => {
    const source = page();
     expect(source).toContain('useState<AIStudioSessionMessage[]>([])');
    expect(source).toContain("useState<string | null>(null)");
    expect(source).toContain("useState(refinement?.html ?? \"\")");
  });

  it("sends the sanitized base HTML with every refinement turn", () => {
    const source = page();
    expect(source).toContain("baseHtml: html.trim() ? html : null");
  });

  it("shows the variable diff and requires confirmation for removals", () => {
    const source = page();
    expect(source).toContain("variableDiffTitle");
    expect(source).toContain("variablesAdded");
    expect(source).toContain("variablesRemoved");
    expect(source).toContain("confirmRemovedVariables");
    expect(source).toContain("candidate.variableDiff.removed.length");
    expect(source).toContain("applyCandidate");
    expect(source).toContain("undoLastChange");
  });

  it("keeps save-as-new as the default and gates the explicit original update", () => {
    const source = page();
    expect(source).toContain("saveAsNew");
    expect(source).toContain("updateOriginalTitle");
    expect(source).toContain("confirmUpdate");
    expect(source).toContain("draftImpactWarning");
    expect(source).toContain("confirmed: true");
    expect(source).toContain("handleConfirmUpdateChange");
  });

  it("warns before leaving an unsaved refinement session", () => {
    const source = page();
    expect(source).toContain("exitConfirm");
    expect(source).toContain("window.confirm");
    expect(source).toContain("const dirty =");
  });

  it("serves the refinement base and update through dedicated routes", () => {
    expect(existsSync(resolve(root, "src/app/api/ai/studio/refine/[templateId]/route.ts"))).toBe(true);
    const route = read("src/app/api/ai/studio/refine/[templateId]/route.ts");
    expect(route).toContain("getAIStudioRefinementBase");
    expect(route).toContain("updateRefinedTemplate");
    expect(route).toContain("requireAIStudioAccess");
  });
});

describe("AI Studio #172 vision UI seams", () => {
  const page = () => read("src/components/financial/proposals/ai-studio.tsx");
  const pt = () => read("messages/pt-BR.json");
  const en = () => read("messages/en.json");

  it("uploads images through a dedicated multipart route and sends their ids at generation", () => {
    const source = page();
    expect(source).toContain("/api/ai/studio/images");
    expect(source).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(source).toContain("imageIds: attachedImages.map((image) => image.id)");
    expect(source).toContain('form.append("imageFiles"');
    expect(source).toContain("attachedImageFilesRef");
    expect(source).toContain("AI_STUDIO_MAX_IMAGES_PER_MESSAGE");
  });

  it("gates attachments on the selected model's vision capability", () => {
    const source = page();
    expect(source).toContain("visionAvailable");
    expect(source).toContain("attachedBlocked");
    expect(source).toContain("imageVisionRequired");
    expect(source).toContain("item.vision");
    expect(source).toContain("new FormData()");
  });

  it("resets provider context before switching and blocks generation on a non-vision model", () => {
    const source = page();
    expect(source).toContain("if (attachedBlocked) { setError(t(\"imageVisionRequired\")); return; }");
    expect(source).toContain("handleProviderChange");
    expect(source).toContain("imageVisionSwitchWarning");
    expect(source).toContain("setProvider(nextProvider as typeof provider)");
    const handlerStart = source.indexOf("function handleProviderChange");
    const handlerEnd = source.indexOf("\n  async function readGenerationResponse", handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);
    expect(handler).toContain("switchAIStudioProviderContext<Candidate>({");
    expect(handler).toContain("setSessionMessages(freshContext.sessionMessages)");
    expect(handler).toContain("setSessionSummary(freshContext.sessionSummary)");
    expect(handler).toContain("setSessionSnapshot(null)");
    expect(handler).toContain("setCandidate(freshContext.candidate)");
  });

  it("releases temporary images when the conversation resets or the user leaves", () => {
    const source = page();
    expect(source).toContain("cleanupAIStudioSession");
    expect(source).toContain("setAttachedImages([])");
    expect(source).toContain("imageErrorExpired");
    expect(source).toContain("generationConsumedImages");
  });

  it("localizes attachment errors and privacy notes in both locales", () => {
    const source = page();
    expect(source).toContain("localizedImageError");
    expect(source).toContain("imageErrorTooLarge");
    expect(source).toContain("imageErrorUnsupportedFormat");
    expect(source).toContain("imagePrivacyHint");
    expect(source).toContain("imageVisionBlocked");
    expect(source).toContain("imageListAria");
    expect(source).toContain("imageRemove");
    expect(pt()).toContain('"imageTitle": "Referências visuais"');
    expect(en()).toContain('"imageTitle": "Visual references"');
  });

  it("makes consent explicitly cover image processing and bumps the disclosure version", () => {
    const contract = read("src/lib/ai/studio-contract.ts");
    expect(contract).toContain("ai-studio-provider-disclosure-v2");
    expect(pt()).toContain("das imagens anexadas e, quando aplicável");
    expect(en()).toContain("attached images and, when applicable");
  });

  it("serves the image upload, list and release lifecycle through a dedicated route", () => {
    expect(existsSync(resolve(root, "src/app/api/ai/studio/images/route.ts"))).toBe(true);
    const route = read("src/app/api/ai/studio/images/route.ts");
    expect(route).toContain("attachAIStudioImage");
    expect(route).toContain("listAIStudioImages");
    expect(route).toContain("discardAIStudioImage");
    expect(route).toContain("clearAIStudioImages");
    expect(route).toContain("requireAIStudioAccess");
  });

  it("passes imageIds from the generate route into the service", () => {
    const route = read("src/app/api/ai/studio/generate/route.ts");
    expect(route).toContain("imageIds: body.imageIds");
  });
});

describe("AI Studio #174 integration wiring", () => {
  it("keeps TemplateStudio connected to the tested lifecycle seams", () => {
    const source = read("src/components/financial/proposals/ai-studio.tsx");

     expect(source).toContain("createAIStudioPagehideHandler(createCleanupInput())");
    expect(source).toContain("handleAIStudioExitClick(exitEvent");
    expect(source).toContain("recoverAIStudioContext<Candidate>({");
    expect(source).toContain("isAIStudioCandidateActionDisabled({");
    expect(source).toContain("disabled={candidateActionDisabled}");
    expect(source).toContain("isAIStudioUndoDisabled({ isGenerating, historyLength: history.length, hasCandidate: candidate !== null })");
    expect(source).toContain("releaseForNavigation: (onReleased)");
    expect(source).toContain("isAIStudioRemovalConfirmed(candidate, confirmedRemovalCandidate)");
     expect(source).toContain("navigateAfterAIStudioCommit({");
     expect(source).toContain("releaseAIStudioRouterGuard");
  });

  it("routes shared shell exits through the global programmatic guard", () => {
    const files = [
      ["src/components/layout/app-layout.tsx", "pushWithAIStudioGuard"],
      ["src/components/notifications/notification-center.tsx", "pushWithAIStudioGuard"],
      ["src/components/billing/upgrade-banner.tsx", "pushWithAIStudioGuard"],
      ["src/components/quick-capture/quick-capture-dialog.tsx", "pushWithAIStudioGuard"],
      ["src/components/auth/auth-gate.tsx", "replaceWithAIStudioGuard"],
      ["src/components/layout/module-gate.tsx", "replaceWithAIStudioGuard"],
      ["src/app/(authenticated)/financial/layout.tsx", "replaceWithAIStudioGuard"],
    ] as const;

    for (const [path, seam] of files) expect(read(path)).toContain(seam);
  });

  it("keeps the global bridge active when switching providers with dirty work", () => {
    const source = read("src/components/financial/proposals/ai-studio.tsx");
    const handlerStart = source.indexOf("function handleProviderChange");
    const handlerEnd = source.indexOf("async function readGenerationResponse", handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(source).toContain("const dirty = isAIStudioDirty({");
    expect(handler).toContain("leaveSession();");
    expect(handler).toContain("switchAIStudioProviderContext<Candidate>({");
    expect(handler).not.toContain("releaseRouterGuard");
    expect(source).toContain("if (options.releaseRouterGuard) releaseAIStudioRouterGuard();");
  });

  it("keeps a mounted module child available for the guarded redirect effect", () => {
    const source = read("src/components/layout/module-gate.tsx");
    expect(source).toContain("const hasRenderedChildren = useRef(false)");
    expect(source).toContain("setRedirecting(replaceWithAIStudioGuard");
    expect(source).toContain("shouldPreserveAIStudioParentChildren");
  });
});

describe("AI Studio #176 hardening UI seams", () => {
  it("shows versioned blocking consent with public legal links", () => {
    const source = read("src/components/financial/proposals/ai-studio.tsx");
    const http = read("src/lib/ai/studio-http.ts");
    expect(source).toContain('href="/privacy"');
    expect(source).toContain('href="/terms"');
    expect(source).toContain("ai-studio-consent-version");
    expect(source).toContain("config.consentVersion");
    expect(source).toContain("required aria-required=\"true\"");
    expect(source).toContain("if (!consentChecked && !options.consentRecorded)");
    expect(source).toContain("acceptConsentAndGenerate");
    expect(source).toContain("consentOpen");
    expect(source).toContain('id="ai-studio-consent-modal"');
    expect(http).toContain("CONSENT_REQUIRED: 428");
  });

  it("covers accessible loading, streaming, error, focus, sanitization and responsive preview states", () => {
    const source = read("src/components/financial/proposals/ai-studio.tsx");
    const preview = read("src/components/financial/proposals/proposal-html-preview.tsx");
    const pt = read("messages/pt-BR.json");
    const en = read("messages/en.json");

    expect(source).toContain("aria-live=\"polite\"");
    expect(source).toContain('role="status"');
    expect(source).toContain('role="alert"');
    expect(source).toContain("candidateTitleRef.current?.focus()");
    expect(source).toContain("errorRef.current?.focus()");
    expect(source).toContain("invalidOutput");
    expect(source).toContain("sanitizationWarning");
    expect(source).toContain('t("operationFailed")');
    expect(source).toContain("localizedStudioError");
    expect(source).toContain("setPreviewError(localizedStudioError");
    expect(source).toContain("setError(localizedStudioError(updateError");
    expect(source).not.toContain("payload.error?.message ?? fallbackMessage");
    expect(source).not.toContain("attachError.message");
    expect(source).not.toContain("event.error?.message");
    expect(read("src/lib/ai/studio-http.ts")).not.toContain("message: error.message");
    expect(source).not.toContain("Não foi possível concluir a operação.");
    expect(source).toContain("desktopPreviewTitle");
    expect(source).toContain("mobilePreviewTitle");
    expect(source).toContain('title={t("desktopPreviewTitle")} className="h-[min(66vh,720px)]"');
    expect(source).toContain('title={t("mobilePreviewTitle")} className="h-[min(66vh,720px)]"');
    expect(source).toContain("overflow-y-auto p-4");
    expect(source).toContain("chatEndRef");
    expect(source).toContain('t("thinkingFor", { seconds: 1 })');
    expect(source).toContain('t("chatComposerPlaceholder")');
    expect(source).toContain("grid-rows-[minmax(0,1fr)_minmax(0,1fr)]");
    expect(source).toContain("min-w-0 flex-1 flex-wrap");
    expect(source).toContain('title={t("imageVisionBlocked")}');
    expect(preview).toContain("title = \"Preview\"");
    expect(pt).toContain('"generationStatus"');
    expect(en).toContain('"generationStatus"');
    expect(pt).toContain('"invalidOutput"');
    expect(en).toContain('"invalidOutput"');
  });
});
