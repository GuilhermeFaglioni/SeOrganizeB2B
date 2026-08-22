import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

import { anthropicProvider } from "../lib/ai/providers/anthropic";
import { openaiProvider } from "../lib/ai/providers/openai";
import {
  getAIProvider,
  listAIProviders,
} from "../lib/ai/providers";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("AI provider OAuth capability gating (#175)", () => {
  it("declares OAuth as a known but unsupported method for both providers with a safe reasonKey", () => {
    expect(openaiProvider.authMethods).toEqual(["api_key"]);
    expect(anthropicProvider.authMethods).toEqual(["api_key"]);
    // oauth must be explicit so the UI/catalog can reason about availability
    expect(openaiProvider.oauth).toMatchObject({
      status: "unsupported",
      reasonKey: "oauthUnavailableOAuthConditionNotMet",
    });
    expect(anthropicProvider.oauth).toMatchObject({
      status: "unsupported",
      reasonKey: "oauthUnavailableOAuthConditionNotMet",
    });
    expect(openaiProvider.authMethods).not.toContain("oauth");
    expect(anthropicProvider.authMethods).not.toContain("oauth");
  });

  it("lists no provider as OAuth-available in June 2026 (no official third-party OAuth to the API)", () => {
    expect(
      listAIProviders().every((p) => !p.authMethods.includes("oauth" as unknown as never)),
    ).toBe(true);
    expect(listAIProviders().every((p) => p.oauth.status === "unsupported")).toBe(true);
    // Avoid accidental fallthrough: unsupported providers must map to a known i18n key
    expect(openaiProvider.oauth.reasonKey).toBe("oauthUnavailableOAuthConditionNotMet");
    expect(anthropicProvider.oauth.reasonKey).toBe("oauthUnavailableOAuthConditionNotMet");
  });

  it("registry lookups still resolve both providers (gating does not break discovery)", () => {
    expect(getAIProvider("openai")).toBeDefined();
    expect(getAIProvider("anthropic")).toBeDefined();
    expect(listAIProviders().map((p) => p.id)).toEqual(
      expect.arrayContaining(["openai", "anthropic"]),
    );
  });

  it("renders OAuth state as informative only — no password, cookie, cache or first-party token collection surfaces", () => {
    const aiConnections = read("src/components/settings/ai-connections.tsx");
    // There must be no input of type password or file used for OAuth,
    // and no mention of password/cookie/cache/token-first-party collection.
    // The only password input in the file is the API key input.
    expect(aiConnections).toMatch(/type="password"/);
    // OAuth state must be derived from provider.authMethods/oauth
    expect(aiConnections).toContain('authMethods.includes("oauth")');
    expect(aiConnections).toContain("oauthUnavailable");
    // No OAuth callback, token exchange, PKCE, or cookie handling code in this component
    expect(aiConnections).not.toContain("oauth/callback");
    expect(aiConnections).not.toContain("code_verifier");
    expect(aiConnections).not.toContain("code_challenge");
    expect(aiConnections).not.toContain("refresh_token");
    expect(aiConnections).not.toContain("document.cookie");
  });

  it("localizes the OAuth unavailable state in both locales without adding OAuth secrets", () => {
    const pt = read("messages/pt-BR.json");
    const en = read("messages/en.json");
    expect(pt).toContain('"oauthUnavailableOAuthConditionNotMet"');
    expect(en).toContain('"oauthUnavailableOAuthConditionNotMet"');
    expect(pt).toContain('"oauthUnavailableTitle"');
    expect(en).toContain('"oauthUnavailableTitle"');
    expect(pt).toContain('"oauthNoCollectionNotice"');
    expect(en).toContain('"oauthNoCollectionNotice"');
    // The notice must say not to collect passwords/cookies/tokens
    expect(pt).toContain("Não colete senhas");
    expect(en).toContain("Do not collect passwords");
  });
});
