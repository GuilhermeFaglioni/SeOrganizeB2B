# AI Studio Codex and Claude OAuth findings

Investigation date: 2026-08-23.

The AI Studio does **not** implement OAuth for Codex or Claude. The current provider catalog keeps `authMethods: ["api_key"]` and marks OAuth as `unsupported`. No browser callback, PKCE exchange, session-token import or private endpoint is used.

## Decision

There is no documented public third-party OAuth client flow that this web application can use to obtain a user credential for the OpenAI API/Codex or Claude API. The official documentation describes OAuth-like browser sign-in for first-party clients and workload-specific token exchanges, but does not provide the client registration, redirect contract, scopes and token lifecycle needed for a general third-party AI Studio integration.

## Codex and OpenAI

OpenAI's Codex authentication documentation lists **Sign in with ChatGPT** and **API key** authentication. Sign in with ChatGPT is described for the ChatGPT desktop app, Codex CLI and IDE extension. It is not documented as a third-party OAuth client for an application calling the OpenAI API.

OpenAI also documents **Codex access tokens** for trusted Business/Enterprise local workflows, including Codex CLI and app-server automation. The same documentation explicitly directs general OpenAI API calls to Platform API keys. A Codex access token therefore must not be accepted as an OpenAI API key by this integration.

OpenAI **Workload Identity Federation** is a separate enterprise/beta flow for a Codex process. It exchanges a runtime-managed OIDC or SPIFFE assertion through a configured federation rule and is consumed by Codex on the trusted workload. It is not a user OAuth connection for this web app, and the AI Studio does not collect identity-token files or federation assertions.

### Credentials accepted by this AI Studio

- OpenAI Platform API key, sent server-side to the OpenAI API adapter and stored encrypted.
- OpenCode Zen/Go API keys, through their existing separate adapters.

### Credentials not accepted

- ChatGPT browser sessions or **Sign in with ChatGPT** credentials.
- `~/.codex/auth.json`, OS keychain entries or copied Codex session tokens.
- Codex access tokens, unless OpenAI documents them as valid credentials for the general API endpoint used by this adapter. Current official guidance limits them to trusted Codex CLI/app-server workflows.
- OpenAI workload identity files, OIDC assertions or private Codex endpoints.

## Claude and Anthropic

Claude Code documentation describes first-party Claude.ai/Console login, `claude setup-token` for Claude Code scripts, and cloud/provider authentication. Those credentials are documented for Claude Code or its official tooling, not as a public OAuth client contract for an unrelated web application.

The Claude API authentication documentation lists **Console API keys**, **Workload Identity Federation** and **App Attest**. WIF exchanges an IdP-issued JWT at `POST /v1/oauth/token` for a short-lived API token; it requires an Anthropic organization, service account, federation issuer/rule and a trusted workload identity. App Attest is limited to registered iOS/macOS apps. Neither is the user-facing OAuth flow requested for this web application.

### Credentials accepted by this AI Studio

- Anthropic Claude Console API key, sent with `x-api-key` from the server and stored encrypted.
- A future WIF integration could be considered only as a separately specified server-workload feature after the required Anthropic organization, service account, federation rule and runtime IdP are provisioned. It is not enabled by this change.

### Credentials not accepted

- Claude.ai or Claude Code browser login sessions.
- `CLAUDE_CODE_OAUTH_TOKEN` or a token printed by `claude setup-token` as a substitute for a Claude Console API key.
- `ant` CLI profile files, Claude Code credential files, cookies or copied session tokens.
- Private Claude Code endpoints or reverse-engineered token exchanges.
- App Attest credentials, because AI Studio is a web/server application rather than a registered iOS/macOS app.

## What would unblock OAuth

The provider would need to publish a supported third-party application integration with a client registration process, authorized redirect URIs, documented authorization and token endpoints, scopes, PKCE/state requirements, refresh/revocation semantics, and permission to use the resulting credential for the target model API. Until that contract exists, the UI shows OAuth as unavailable and directs users to the provider API key path.

## Official sources

### OpenAI/Codex

- [Codex authentication](https://developers.openai.com/codex/auth/)
- [Codex access tokens](https://developers.openai.com/codex/enterprise/access-tokens/)
- [Codex workload identity federation](https://developers.openai.com/codex/enterprise/workload-identity/)
- [OpenAI API authentication](https://platform.openai.com/docs/api-reference/authentication)

### Anthropic/Claude

- [Claude Code authentication](https://code.claude.com/docs/en/authentication)
- [Claude API authentication](https://platform.claude.com/docs/en/manage-claude/authentication)
- [Claude API overview](https://platform.claude.com/docs/en/api/overview)
- [Claude Workload Identity Federation](https://platform.claude.com/docs/en/manage-claude/workload-identity-federation)
- [Claude CLI authentication](https://platform.claude.com/docs/en/cli-sdks-libraries/cli/authentication)
- [Claude App Attest](https://platform.claude.com/docs/en/manage-claude/app-attest)
