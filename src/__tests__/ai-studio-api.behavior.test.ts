import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  denyFor: vi.fn(),
  getTenantContext: vi.fn(),
  checkFeature: vi.fn(),
  getAIStudioConfig: vi.fn(),
  getAIStudioMaxRequestBytes: vi.fn(),
  recordAIStudioConsent: vi.fn(),
  generateTemplateCandidate: vi.fn(),
  renderAIStudioSyntheticPreview: vi.fn(),
  getAIStudioRefinementBase: vi.fn(),
  updateRefinedTemplate: vi.fn(),
  attachAIStudioImage: vi.fn(),
  listAIStudioImages: vi.fn(),
  discardAIStudioImage: vi.fn(),
  clearAIStudioImages: vi.fn(),
  discardAIStudioSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/authz/authz", () => ({ denyFor: mocks.denyFor }));
vi.mock("@/lib/authz/tenant-context", () => ({ getTenantContext: mocks.getTenantContext }));
vi.mock("@/lib/features", () => ({ checkFeature: mocks.checkFeature }));
vi.mock("@/lib/ai/studio-service", () => ({
  getAIStudioConfig: mocks.getAIStudioConfig,
  getAIStudioMaxRequestBytes: mocks.getAIStudioMaxRequestBytes,
  recordAIStudioConsent: mocks.recordAIStudioConsent,
  generateTemplateCandidate: mocks.generateTemplateCandidate,
  renderAIStudioSyntheticPreview: mocks.renderAIStudioSyntheticPreview,
  getAIStudioRefinementBase: mocks.getAIStudioRefinementBase,
  updateRefinedTemplate: mocks.updateRefinedTemplate,
  attachAIStudioImage: mocks.attachAIStudioImage,
  listAIStudioImages: mocks.listAIStudioImages,
  discardAIStudioImage: mocks.discardAIStudioImage,
  clearAIStudioImages: mocks.clearAIStudioImages,
  discardAIStudioSession: mocks.discardAIStudioSession,
  AIStudioError: class AIStudioError extends Error {
    code: string;
    detailCode?: string;
    constructor(code: string, message: string, options?: { detailCode?: string }) {
      super(message);
      this.code = code;
      this.detailCode = options?.detailCode;
    }
  },
}));

import { GET as configGET } from "../app/api/ai/studio/config/route";
import { POST as consentPOST } from "../app/api/ai/studio/consent/route";
import { POST as generatePOST } from "../app/api/ai/studio/generate/route";
import { POST as previewPOST } from "../app/api/ai/studio/preview/route";
import { GET as refineGET, POST as refinePOST } from "../app/api/ai/studio/refine/[templateId]/route";
import { DELETE as imagesDELETE, GET as imagesGET, POST as imagesPOST } from "../app/api/ai/studio/images/route";
import { DELETE as sessionDELETE } from "../app/api/ai/studio/session/route";
import { AIStudioError } from "../lib/ai/studio-service";

const request = (url: string, body: unknown, method = "POST") => new NextRequest(url, {
  method,
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
});

describe("AI Studio API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getUser.mockResolvedValue({ id: "user-1" });
    mocks.denyFor.mockResolvedValue(null);
    mocks.getTenantContext.mockResolvedValue({ tenantId: "tenant-1" });
    mocks.checkFeature.mockResolvedValue(true);
    mocks.getAIStudioConfig.mockResolvedValue({ enabled: true, connections: [], consents: {} });
    mocks.getAIStudioMaxRequestBytes.mockReturnValue(240_000);
    mocks.recordAIStudioConsent.mockResolvedValue({ provider: "openai", version: "v1" });
    mocks.generateTemplateCandidate.mockResolvedValue({ requestId: "req-1", candidate: { html: "<p>ok</p>" } });
    mocks.renderAIStudioSyntheticPreview.mockReturnValue({ html: "<p>Cliente Exemplo</p>", warnings: [] });
  });

  it("returns unauthorized without a user", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await configGET())?.status).toBe(401);
  });

  it("requires both template management and AI generation permissions", async () => {
    mocks.denyFor.mockResolvedValueOnce(null).mockResolvedValueOnce(NextResponse.json({ data: null, error: { code: "FORBIDDEN" } }, { status: 403 }));
    const response = await configGET();
    expect(response?.status).toBe(403);
    expect(mocks.denyFor).toHaveBeenNthCalledWith(2, "user-1", "financial.proposals.generateWithAi");
    expect(mocks.getAIStudioConfig).not.toHaveBeenCalled();
  });

  it("returns provider/model configuration without secrets", async () => {
    const response = await configGET();
    expect(response?.status).toBe(200);
    expect(mocks.getAIStudioConfig).toHaveBeenCalledWith("tenant-1");
  });

  it("records explicit versioned consent before generation", async () => {
    const response = await consentPOST(request("http://x/api/ai/studio/consent", { accepted: true, provider: "openai", version: "v1" }));
    expect(response?.status).toBe(201);
    expect(mocks.recordAIStudioConsent).toHaveBeenCalledWith({ tenantId: "tenant-1", actorId: "user-1", provider: "openai", version: "v1" });
  });

  it("blocks consent-less generation preconditions with 428", async () => {
    const response = await consentPOST(request("http://x/api/ai/studio/consent", { provider: "openai", version: "v1" }));
    expect(response?.status).toBe(428);
    expect(mocks.recordAIStudioConsent).not.toHaveBeenCalled();
  });

  it("passes the tenant and actor boundary into generation", async () => {
    const response = await generatePOST(request("http://x/api/ai/studio/generate", { provider: "openai", model: "gpt-4o", message: "Briefing", consentVersion: "v1" }));
    expect(response?.status).toBe(200);
    expect(mocks.generateTemplateCandidate).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-1", actorId: "user-1", message: "Briefing" }));
  });

  it("passes multipart image bytes directly into generation", async () => {
    const form = new FormData();
    form.append("provider", "openai");
    form.append("model", "gpt-4o");
    form.append("message", "Briefing com imagem");
    form.append("consentVersion", "v1");
    form.append("stream", "false");
    form.append("recentMessages", "[]");
    form.append("sessionSummary", "null");
    form.append("imageIds", JSON.stringify(["img-1"]));
    form.append("imageFiles", new File([new Uint8Array([1, 2, 3])], "ref.png", { type: "image/png" }));

    const response = await generatePOST(
      new NextRequest("http://x/api/ai/studio/generate", { method: "POST", body: form }),
    );

    expect(response?.status).toBe(200);
    expect(mocks.generateTemplateCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        actorId: "user-1",
        message: "Briefing com imagem",
        imageIds: ["img-1"],
        imageFiles: [expect.objectContaining({ name: "ref.png", contentType: "image/png" })],
      }),
    );
    expect(mocks.generateTemplateCandidate.mock.calls[0][0].imageFiles[0].data).toEqual(
      Buffer.from([1, 2, 3]),
    );
  });

  it("passes the ephemeral context snapshot to generation without adding a history endpoint", async () => {
    const ephemeral = {
      sessionId: "session-1",
      sessionSnapshot: "v1.encrypted-session-snapshot",
      recentMessages: [{ role: "assistant", content: "A paleta foi definida." }],
      sessionSummary: { focus: "Paleta azul", decisions: ["Usar paleta azul"], pending: ["Revisar rodapé"], variables: [] },
      baseHtml: "<section>Rascunho atual</section>",
    };
    const response = await generatePOST(request("http://x/api/ai/studio/generate", {
      provider: "openai",
      message: "Continue.",
      consentVersion: "v1",
      ...ephemeral,
    }));

    expect(response?.status).toBe(200);
    expect(mocks.generateTemplateCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", actorId: "user-1", ...ephemeral }),
    );
  });

  it("renders preview from synthetic data through the server seam", async () => {
    const response = await previewPOST(request("http://x/api/ai/studio/preview", { html: "<p>{{cliente.nome}}</p>" }));
    expect(response?.status).toBe(200);
    expect(mocks.renderAIStudioSyntheticPreview).toHaveBeenCalledWith("<p>{{cliente.nome}}</p>", "pt-BR");
  });

  it("loads the refinement base for the current tenant only", async () => {
    mocks.getAIStudioRefinementBase.mockResolvedValue({ id: "template-1", name: "Base", html: "<p>ok</p>", warnings: [], draftCount: 0 });
    const response = await refineGET(new NextRequest("http://x/api/ai/studio/refine/template-1"), { params: Promise.resolve({ templateId: "template-1" }) });
    expect(response?.status).toBe(200);
    expect(mocks.getAIStudioRefinementBase).toHaveBeenCalledWith("tenant-1", "template-1");
  });

  it("denies the refinement base without AI permissions", async () => {
    mocks.denyFor.mockResolvedValueOnce(NextResponse.json({ data: null, error: { code: "FORBIDDEN" } }, { status: 403 }));
    const response = await refineGET(new NextRequest("http://x/api/ai/studio/refine/template-1"), { params: Promise.resolve({ templateId: "template-1" }) });
    expect(response?.status).toBe(403);
    expect(mocks.getAIStudioRefinementBase).not.toHaveBeenCalled();
  });

  it("updates the original only with explicit confirmation", async () => {
    mocks.updateRefinedTemplate.mockResolvedValue({ template: { id: "template-1", name: "Base", html: "<p>novo</p>" }, warnings: [], draftCount: 3 });
    const response = await refinePOST(
      request("http://x/api/ai/studio/refine/template-1", { html: "<p>novo</p>", confirmed: true }),
      { params: Promise.resolve({ templateId: "template-1" }) },
    );
    expect(response?.status).toBe(200);
    expect(mocks.updateRefinedTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", actorId: "user-1", templateId: "template-1", html: "<p>novo</p>", confirmed: true }),
    );
  });

  it("maps a missing update confirmation to a precondition response", async () => {
    mocks.updateRefinedTemplate.mockRejectedValue(new AIStudioError("UPDATE_CONFIRMATION_REQUIRED", "Confirme a atualização."));
    const response = await refinePOST(
      request("http://x/api/ai/studio/refine/template-1", { html: "<p>novo</p>", confirmed: false }),
      { params: Promise.resolve({ templateId: "template-1" }) },
    );
    expect(response?.status).toBe(428);
  });

  it("maps a missing refinement template to 404", async () => {
    mocks.getAIStudioRefinementBase.mockRejectedValue(new AIStudioError("TEMPLATE_NOT_FOUND", "Não encontrado."));
    const response = await refineGET(new NextRequest("http://x/api/ai/studio/refine/missing"), { params: Promise.resolve({ templateId: "missing" }) });
    expect(response?.status).toBe(404);
  });

  it("maps a payload-limited continuing session to 413", async () => {
    mocks.generateTemplateCandidate.mockRejectedValue(new AIStudioError("PAYLOAD_LIMITED", "Contexto excedeu o limite."));
    const response = await generatePOST(request("http://x/api/ai/studio/generate", {
      provider: "openai",
      message: "Continue.",
      consentVersion: "v1",
      recentMessages: [{ role: "user", content: "Contexto longo." }],
      sessionSummary: { focus: "Resumo.", decisions: [], pending: [], variables: [] },
    }));
    expect(response?.status).toBe(413);
    const payload = await response?.json();
    expect(payload.error).toMatchObject({ code: "PAYLOAD_LIMITED" });
  });

  it.each([
    ["CONSENT_REQUIRED", 428],
    ["RATE_LIMITED", 429],
    ["PAYLOAD_LIMITED", 413],
  ] as const)("preserves the HTTP status for a streaming %s failure", async (code, status) => {
    mocks.generateTemplateCandidate.mockRejectedValue(new AIStudioError(code, "Generation blocked."));

    const response = await generatePOST(request("http://x/api/ai/studio/generate", {
      provider: "openai",
      model: "gpt-4o",
      message: "Briefing",
      consentVersion: "v1",
      stream: true,
    }));

    expect(response?.status).toBe(status);
    expect((await response?.json()).error).toMatchObject({ code });
  });

  it("keeps a started stream at 200 and emits a localized error event after a delta", async () => {
    mocks.generateTemplateCandidate.mockImplementation(async (_input, hooks) => {
      hooks?.onPartial?.("partial");
      throw new AIStudioError("PROVIDER_ERROR", "Provider detail must not reach the client.");
    });

    const response = await generatePOST(request("http://x/api/ai/studio/generate", {
      provider: "openai",
      model: "gpt-4o",
      message: "Briefing",
      consentVersion: "v1",
      stream: true,
    }));

    expect(response?.status).toBe(200);
    const events = (await response!.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type: string; text?: string; error?: { code?: string } });
    expect(events[0]).toEqual({ type: "delta", text: "partial" });
    expect(events[1]).toMatchObject({ type: "error", error: { code: "PROVIDER_ERROR" } });
    expect(JSON.stringify(events)).not.toContain("Provider detail must not reach the client.");
  });

  it("rejects an oversized JSON request before the service boundary", async () => {
    const response = await generatePOST(request("http://x/api/ai/studio/generate", {
      provider: "openai",
      message: "x".repeat(240_001),
      consentVersion: "v1",
    }));

    expect(response?.status).toBe(413);
    expect(mocks.generateTemplateCandidate).not.toHaveBeenCalled();
  });

  it("rejects an oversized recent-message list at the HTTP boundary", async () => {
    const response = await generatePOST(request("http://x/api/ai/studio/generate", {
      provider: "openai",
      message: "Continue.",
      consentVersion: "v1",
      recentMessages: Array.from({ length: 9 }, (_, index) => ({
        role: "user",
        content: `turn-${index}`,
      })),
    }));

    expect(response?.status).toBe(413);
    expect(mocks.generateTemplateCandidate).not.toHaveBeenCalled();
  });

  it("passes a multipart image upload to the attach seam within the tenant and actor boundary", async () => {
    mocks.attachAIStudioImage.mockResolvedValue({ id: "img-1", fileName: "ref.png", format: "png", width: 120, height: 90, sizeBytes: 4 });

    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "ref.png", { type: "image/png" }));
    const response = await imagesPOST(new NextRequest("http://x/api/ai/studio/images", { method: "POST", body: form }));

    expect(response?.status).toBe(201);
    expect(mocks.attachAIStudioImage).toHaveBeenCalledWith(
      "tenant-1",
      "user-1",
      expect.objectContaining({ name: "ref.png", contentType: "image/png" }),
    );
    expect(mocks.attachAIStudioImage.mock.calls[0][2].data).toEqual(Buffer.from([1, 2, 3]));
  });

  it("rejects an image upload without a file", async () => {
    const form = new FormData();
    const response = await imagesPOST(new NextRequest("http://x/api/ai/studio/images", { method: "POST", body: form }));
    expect(response?.status).toBe(422);
    expect(mocks.attachAIStudioImage).not.toHaveBeenCalled();
  });

  it("rejects an oversized image before buffering it for the service", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "ref.png", { type: "image/png" }));
    const response = await imagesPOST(new NextRequest("http://x/api/ai/studio/images", { method: "POST", body: form }));

    expect(response?.status).toBe(422);
    const payload = await response?.json();
    expect(payload.error).toMatchObject({ code: "IMAGE_VALIDATION_ERROR", detailCode: "TOO_LARGE" });
    expect(mocks.attachAIStudioImage).not.toHaveBeenCalled();
  });

  it("maps validation failures to 422 with a localized detail code", async () => {
    mocks.attachAIStudioImage.mockRejectedValue(new AIStudioError("IMAGE_VALIDATION_ERROR", "Formato inválido.", { detailCode: "UNSUPPORTED_FORMAT" }));
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1])], "ref.svg", { type: "image/svg+xml" }));
    const response = await imagesPOST(new NextRequest("http://x/api/ai/studio/images", { method: "POST", body: form }));

    expect(response?.status).toBe(422);
    const payload = await response?.json();
    expect(payload.error).toMatchObject({ code: "IMAGE_VALIDATION_ERROR", detailCode: "UNSUPPORTED_FORMAT" });
  });

  it("lists the current temporary references without exposing bytes", async () => {
    mocks.listAIStudioImages.mockReturnValue([{ id: "img-1", fileName: "ref.png", format: "png", width: 120, height: 90, sizeBytes: 4 }]);
    const response = await imagesGET();
    expect(response?.status).toBe(200);
    expect(mocks.listAIStudioImages).toHaveBeenCalledWith("tenant-1", "user-1");
    const payload = await response?.json();
    expect(payload.data[0]).toMatchObject({ id: "img-1", fileName: "ref.png" });
    expect(JSON.stringify(payload)).not.toContain("Buffer");
  });

  it("releases the listed image ids through the discard seam", async () => {
    const response = await imagesDELETE(
      new NextRequest("http://x/api/ai/studio/images", {
        method: "DELETE",
        body: JSON.stringify({ imageIds: ["img-1", "img-2"] }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response?.status).toBe(200);
    expect(mocks.discardAIStudioImage).toHaveBeenCalledWith("tenant-1", "user-1", "img-1");
    expect(mocks.discardAIStudioImage).toHaveBeenCalledWith("tenant-1", "user-1", "img-2");
  });

  it("clears all temporary images when leaving the session", async () => {
    const response = await imagesDELETE(new NextRequest("http://x/api/ai/studio/images", { method: "DELETE" }));
    expect(response?.status).toBe(200);
    expect(mocks.clearAIStudioImages).toHaveBeenCalledWith("tenant-1", "user-1");
    expect(mocks.discardAIStudioImage).not.toHaveBeenCalled();
  });

  it("discards the ephemeral session snapshot at the API boundary", async () => {
    const response = await sessionDELETE(new NextRequest("http://x/api/ai/studio/session", {
      method: "DELETE",
      body: JSON.stringify({ sessionId: "session-1" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response?.status).toBe(200);
    expect(mocks.discardAIStudioSession).toHaveBeenCalledWith("tenant-1", "user-1", "session-1");
  });
});
