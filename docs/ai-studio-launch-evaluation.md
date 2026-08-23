# AI Studio launch evaluation and runbook

This checklist is the reproducible manual evaluation for issue #176. Run it in a disposable workspace with a test OpenAI or Anthropic API Key, synthetic proposal data and no real client information.

## Setup

1. Enable the `financial.proposals` module for the workspace.
2. Connect official provider API Keys for both OpenAI and Anthropic in `/settings/ai` and validate both connections so the provider-switch scenario is executable.
3. Confirm the provider connection is tenant-scoped and that no secret is visible in the browser or `/api/ai/studio/config` response.
4. Open `/financial/proposals/templates/ai-studio` in `pt-BR`, then repeat the relevant checks in `en`.
5. Record the consent version shown in the AI Studio disclosure and confirm that `/privacy` and `/terms` open in the same locale.
6. Confirm image generation submits the browser-held files as multipart `imageFiles`; correctness must not depend on the process-local upload map across serverless invocations.

## Acceptance criteria matrix

| #176 AC | Evidence and verification |
| --- | --- |
| 1. Legal disclosures | `LegalPage` renders AI Studio sections in `legal.privacy` and `legal.terms` for OpenAI, Anthropic, API Key/OAuth, ephemeral processing, telemetry and costs. |
| 2. Consent | The AI Studio checkbox is required, links to `/privacy` and `/terms`, displays `consentVersion`, and the API maps missing consent to `428`. |
| 3. States | Exercise loading, streaming, provider/model absence, no directive, vision restriction, limits, invalid output, provider errors and sanitization warnings. |
| 4. Accessibility | Use keyboard-only navigation, verify visible focus, labels, live status, alerts and named desktop/mobile preview frames. |
| 5. i18n | Repeat the UI checks in `pt-BR` and `en`; Portuguese is the primary launch copy and locale keys remain in parity. |
| 6. Automated tests | Run the AI Studio behavior, API, vision, UI, i18n, OAuth, RLS and regression test files together. |
| 7. Existing flows | Run manual template editor, preview, draft proposal and sent/accepted snapshot regressions before launch. |
| 8. Manual evaluation | Complete every scenario in Core scenarios, including directive, variables, locale, images, provider switch, reset, out-of-scope and invalid output. |
| 9. Usage privacy | Inspect usage rows and retention behavior; prompts, HTML, images, transcript and secrets must be absent, with a 90-day cutoff. |
| 10. Kill switch | Set `AI_STUDIO_KILL_SWITCH=true`; new generations fail while reading, editing and existing templates continue to work. |
| 11. Eligibility | Verify every eligible workspace can use the feature through permissions and module gating without a provider allowlist. |
| 12. OAuth limitation | Confirm both providers expose API Key as the launch path and OAuth only when official third-party support is actually available. |

## Evidence Snapshot

This snapshot records automated evidence for the current working-tree evaluation. It is not a substitute for the browser scenarios below.

| Check | Evidence | Result |
| --- | --- | --- |
| Revision and synthetic tenant | `ec55175`, synthetic tenant `tenant-1`; working-tree changes are uncommitted | Recorded |
| Automated gates | `npm test` (181 files, 1865 passed, 8 skipped), `npx tsc --noEmit`, `npm run lint`, production build and `git diff --check` | Pass |
| Providers and locales | OpenAI/Anthropic provider tests plus `pt-BR`/`en` i18n and UI tests | Pass |
| Serverless image transport | UI retains `File` objects and sends `multipart imageFiles` to generation; backend validates bytes without requiring the process-local map | Pass |
| Kill switch | `ai-studio-service.behavior.test.ts` sets `AI_STUDIO_KILL_SWITCH=true` and verifies generation stops before the provider | Pass |
| Retention scheduler | `GET /api/cron/ai-studio-retention` invokes cleanup for every workspace; service test includes active and cancelled/deleted workspace records | Pass |
| Runtime RLS | `tenant-isolation-rls.test.ts` exercises policies for all five AI Studio tables when a database is available | Pending local database (`127.0.0.1:54322` unavailable) |
| OAuth/API Key limitation | Both provider contracts expose API Key at launch; OAuth remains unavailable without official third-party support | Pass |
| Browser/manual scenarios | Core scenarios, screenshots and deployment checks | Blocked until disposable authenticated environment is provided |

## Core scenarios

1. **New template**: describe a proposal, generate a candidate, observe streaming when supported, review warnings, apply it, edit the HTML, preview desktop/mobile synthetic values, save as new, and verify the original template was not changed.
2. **Refine**: choose an existing workspace template, generate a refinement, inspect added/removed/preserved variables, confirm removal when required, save as new, then separately test the explicit original update and draft impact warning.
3. **Directive**: configure a workspace directive, start a session, verify the session snapshot notice, change the directive, and verify the active session keeps its original snapshot.
4. **Override resistance**: ask the provider to add scripts, forms, external images, acceptance controls or client facts; verify the result is sanitized, warnings are visible and the public shell rules remain intact.
5. **Custom variables**: request a custom placeholder, verify it is declared and shown as pending, then save and render with synthetic values.
6. **Locale**: repeat new and refine flows in `pt-BR` and `en`; verify loading, errors, consent, provider, image, preview and save states are localized.
7. **Images**: attach valid PNG/JPEG/WebP references to a vision model, verify generation submits the browser-held files as multipart `imageFiles`, generate, verify references disappear after generation, test the 5 MB, three-image, wrong MIME, mismatched signature and oversized-dimension errors, then switch to a non-vision model and confirm generation is blocked.
8. **Provider switch**: attach a reference and create a draft, switch provider, verify transcript and images are not transferred, and verify the current HTML draft remains.
9. **Reset and exit**: reset the conversation, navigate away with unsaved work, use browser back/forward, refresh or close the tab, and verify the candidate, session snapshot and temporary images are discarded without changing saved templates.
10. **Out of scope**: use a briefing containing real client data, passwords, cookies or session tokens; verify the UI warning is clear and do not send the test request.
11. **Invalid output**: use a provider test double that returns empty HTML, unsafe HTML, malformed JSON or undeclared variables; verify the last valid draft remains and the error is actionable.

## Operational checks

1. Activate the kill switch with `AI_STUDIO_KILL_SWITCH=true`, reload AI Studio and verify new generations are disabled while saved templates remain available. Restore the variable afterward.
2. Inspect `ai_studio_usage_events` after success and failure. Confirm it contains only workspace/operator/provider/model/request metadata, sizes, latency, status, error category and optional token counts; it must not contain prompts, HTML, transcript, image bytes, image names or secrets.
3. Invoke `GET /api/cron/ai-studio-retention` with the deployment cron secret and verify the retention service deletes events older than 90 days for every workspace, including inactive workspaces, while retaining newer events.
4. Verify a workspace cannot read or mutate another workspace's provider connections, connection audits, directive, consent or usage rows, including through a direct database connection with no tenant GUC.
5. Verify rate limiting returns `429` with `Retry-After`, payload limits return `413`, provider failures do not trigger fallback, and API Key secrets never appear in logs or responses.
6. Verify all eligible workspaces can use AI Studio without a provider allowlist; unsupported OAuth remains visibly documented as unavailable rather than offering a fake flow.

## Launch runbook

### Before enabling

1. Run the full test, typecheck, lint and production build gates.
2. Apply the existing AI Studio migrations and confirm RLS policies for provider connections, connection audits, workspace directives, usage events and consents.
3. Confirm `AI_SECRET_ENCRYPTION_KEY` is a valid 32-byte base64 key and that provider API Keys are never returned by config, logs or error payloads.
4. Use only synthetic data and a disposable workspace for the manual checklist.
5. Configure `CRON_SECRET` for the scheduled retention route and confirm the Vercel cron entry is enabled.

### During the evaluation

1. Record revision, locale, workspace, provider, model and result for every scenario.
2. Stop immediately if any prompt, HTML, image bytes, transcript, secret or real client data appears in telemetry or evidence.
3. Stop immediately if a provider failure falls back to another provider, a cross-workspace read succeeds, or an unsanitized candidate reaches preview or persistence.

### Rollback

1. Set `AI_STUDIO_KILL_SWITCH=true` and verify the disabled state.
2. Keep existing template read, edit, preview and proposal snapshot paths available.
3. Preserve failure evidence without API Keys or generated content, then restore the environment only after the incident is understood.

## Evidence

Record the date, locale, provider/model, workspace identifier, build revision and pass/fail result for each scenario. Attach screenshots only when they contain synthetic data. Remove API Keys and any generated HTML from the evidence.
