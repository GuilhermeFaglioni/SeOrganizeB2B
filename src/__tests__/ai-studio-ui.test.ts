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
    expect(source).toContain('useState<SessionMessage[]>([])');
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
    expect(pt()).toContain("das imagens anexadas ao provider externo selecionado");
    expect(en()).toContain("any attached images to the selected external provider");
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

    expect(source).toContain("createAIStudioPagehideHandler({");
    expect(source).toContain("handleAIStudioExitClick(exitEvent");
    expect(source).toContain("recoverAIStudioContext<Candidate>({");
    expect(source).toContain("isAIStudioCandidateActionDisabled({");
    expect(source).toContain("disabled={candidateActionDisabled}");
    expect(source).toContain("isAIStudioUndoDisabled({ isGenerating, historyLength: history.length, hasCandidate: candidate !== null })");
    expect(source).toContain("releaseForNavigation: (onReleased)");
    expect(source).toContain("isAIStudioRemovalConfirmed(candidate, confirmedRemovalCandidate)");
    expect(source).toContain("navigateAfterAIStudioCommit({");
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

  it("keeps a mounted module child available for the guarded redirect effect", () => {
    const source = read("src/components/layout/module-gate.tsx");
    expect(source).toContain("const hasRenderedChildren = useRef(false)");
    expect(source).toContain("setRedirecting(replaceWithAIStudioGuard");
    expect(source).toContain("shouldPreserveAIStudioParentChildren");
  });
});
