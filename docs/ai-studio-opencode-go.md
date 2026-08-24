# OpenCode Go provider

The AI Studio integration exposes OpenCode Go as a separate provider from OpenCode Zen. Both use the same OpenCode API key, but each connection is stored and selected independently by plan.

## Configuration and limits

Set `OPENCODE_GO_API_BASE_URL` to the URL prefix before `/v1`. The default is:

```text
https://opencode.ai/zen/go
```

OpenCode Go is a subscription with documented limits of `$12` per 5 hours, `$30` per week and `$60` per month. Connecting or re-validating a key sends one minimal authenticated completion and may consume Go quota. The key is sent only from the server, stored encrypted and omitted from browser responses, telemetry and logs.

## Supported surface

- Request: `POST /v1/chat/completions` with `Authorization: Bearer <key>`.
- Non-streaming response: OpenAI-compatible `choices[0].message.content` and optional `usage`.
- Streaming response: OpenAI-compatible SSE `choices[0].delta.content` events.
- Models: `glm-5.3`, `glm-5.2`, `glm-5.1`, `kimi-k3`, `kimi-k2.7-code`, `kimi-k2.6`, `deepseek-v4-pro`, `deepseek-v4-flash`, `mimo-v2.5`, `mimo-v2.5-pro` and `hy3`.
- Streaming: enabled for every listed model.
- Vision: disabled. `deepseek-v4-flash-vision-exp` is intentionally excluded until image input is covered by an explicit request test.
- Structured output: the adapter does not send `response_format`; AI Studio requests JSON in the prompt and validates the complete response before use.

Responses and Anthropic models are intentionally outside this catalog. Free endpoints and the training-enabled `muse-spark-1.2-contributor` model are excluded. The paid chat-compatible models listed above are documented as not used for training.

The server filters this controlled catalog using `GET /v1/models` before displaying a connected Go plan. The endpoint is used for availability discovery; the minimal authenticated completion is the authoritative key check. OpenCode error payloads are parsed so account credits, plan limits and model errors are not mislabeled as invalid API keys.

## Official references

- [OpenCode Go documentation](https://opencode.ai/docs/go/)
- [OpenCode Go model catalog](https://opencode.ai/zen/go/v1/models)
- [OpenCode Go OpenAI-compatible route](https://github.com/anomalyco/opencode/blob/dev/packages/console/app/src/routes/zen/go/v1/chat/completions.ts)
