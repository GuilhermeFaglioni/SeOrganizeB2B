import { afterEach, describe, expect, it, vi } from "vitest";
import { openaiProvider } from "../lib/ai/providers/openai";
import { anthropicProvider } from "../lib/ai/providers/anthropic";
import type { AIProvider } from "../lib/ai/provider-contract";
import type { AIStudioImageAsset } from "../lib/ai/studio-contract";

function generateStructured(provider: AIProvider) {
  const fn = provider.generateStructured;
  if (!fn) throw new Error("provider has no generateStructured");
  return fn;
}

const pngAsset: AIStudioImageAsset = {
  id: "img-1",
  fileName: "referencia.png",
  format: "png",
  width: 100,
  height: 100,
  sizeBytes: 4,
  data: Buffer.from("abcd"),
};

const jpegAsset: AIStudioImageAsset = {
  id: "img-2",
  fileName: "referencia.jpg",
  format: "jpeg",
  width: 200,
  height: 150,
  sizeBytes: 4,
  data: Buffer.from("efgh"),
};

function stubFetch(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("OpenAI vision generation body", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends attached images as base64 data URIs inside the user message", async () => {
    const fetchMock = stubFetch({
      choices: [{ message: { content: '{"html":"<p>ok</p>"}' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3 },
    });

    await generateStructured(openaiProvider)("sk-test", {
      model: "gpt-4o",
      systemPrompt: "sys",
      userPrompt: "Use a referência.",
      maxOutputTokens: 6000,
      images: [pngAsset, jpegAsset],
    });

    const body = requestBody(fetchMock);
    expect(body.model).toBe("gpt-4o");
    const userMessage = (body.messages as Array<Record<string, unknown>>)[1];
    const content = userMessage.content as Array<Record<string, unknown>>;
    expect(Array.isArray(content)).toBe(true);
    expect(content[0]).toEqual({ type: "text", text: "Use a referência." });
    expect(content[1]).toMatchObject({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${pngAsset.data.toString("base64")}` },
    });
    expect(content[2]).toMatchObject({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${jpegAsset.data.toString("base64")}` },
    });
  });

  it("keeps the user prompt as plain text when no images are attached", async () => {
    const fetchMock = stubFetch({
      choices: [{ message: { content: '{"html":"<p>ok</p>"}' } }],
    });

    await generateStructured(openaiProvider)("sk-test", {
      model: "gpt-4o",
      systemPrompt: "sys",
      userPrompt: "Sem imagem.",
      maxOutputTokens: 6000,
    });

    const body = requestBody(fetchMock);
    const userMessage = (body.messages as Array<Record<string, unknown>>)[1];
    expect(userMessage.content).toBe("Sem imagem.");
  });
});

describe("Anthropic vision generation body", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends attached images as base64 image blocks with matching media types", async () => {
    const fetchMock = stubFetch({
      content: [{ type: "text", text: '{"html":"<p>ok</p>"}' }],
      usage: { input_tokens: 5, output_tokens: 3 },
    });

    await generateStructured(anthropicProvider)("sk-ant-test", {
      model: "claude-sonnet-4-5",
      systemPrompt: "sys",
      userPrompt: "Use a referência.",
      maxOutputTokens: 6000,
      images: [pngAsset, jpegAsset],
    });

    const body = requestBody(fetchMock);
    expect(body.model).toBe("claude-sonnet-4-5");
    const content = (body.messages as Array<{ content: unknown }>)[0].content as Array<Record<string, unknown>>;
    expect(Array.isArray(content)).toBe(true);
    expect(content[0]).toEqual({ type: "text", text: "Use a referência." });
    expect(content[1]).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: pngAsset.data.toString("base64") },
    });
    expect(content[2]).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: jpegAsset.data.toString("base64") },
    });
  });

  it("keeps the user content as plain text when no images are attached", async () => {
    const fetchMock = stubFetch({
      content: [{ type: "text", text: '{"html":"<p>ok</p>"}' }],
    });

    await generateStructured(anthropicProvider)("sk-ant-test", {
      model: "claude-sonnet-4-5",
      systemPrompt: "sys",
      userPrompt: "Sem imagem.",
      maxOutputTokens: 6000,
    });

    const body = requestBody(fetchMock);
    const content = (body.messages as Array<{ content: unknown }>)[0].content;
    expect(content).toBe("Sem imagem.");
  });
});