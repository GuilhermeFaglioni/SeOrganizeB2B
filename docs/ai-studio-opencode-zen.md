# OpenCode Zen provider

The AI Studio integration uses OpenCode Zen's documented OpenAI-compatible endpoint for the current model family that is served at `/v1/chat/completions`.

## Configuration

Set `OPENCODE_API_BASE_URL` to the URL prefix before `/v1`. The default is:

```text
https://opencode.ai/zen
```

The OpenCode Zen API key is entered in `/settings/ai`, validated server-side and stored encrypted. It is never returned to the browser, usage events or logs.

## Supported surface

- Request: `POST /v1/chat/completions` with `Authorization: Bearer <key>`.
- Non-streaming response: OpenAI-compatible `choices[0].message.content` and optional `usage`.
- Streaming response: OpenAI-compatible SSE `choices[0].delta.content` events.
- Streaming: enabled for every model exposed by this adapter.
- Vision: disabled for every model because the Zen endpoint documentation does not guarantee image input for this model family.
- Structured output: the adapter does not send `response_format`; AI Studio requests JSON in the prompt and validates the complete provider response before use.

The catalog includes current, non-deprecated paid models served through the OpenAI-compatible chat-completions endpoint. Free models are excluded because Zen documents different retention or training policies for some free endpoints. Models served through Responses, Anthropic, or Google endpoints are also excluded. The server filters this controlled catalog using the model list visible to the connected Zen key.

Zen's `GET /v1/models` endpoint is publicly readable and is used only to discover key-scoped model availability. It cannot prove that a key is valid. Connecting or re-validating a Zen key sends a minimal one-token request to the selected model through `POST /v1/chat/completions`; this may count against Zen billing or limits, as with any provider request.

## Official references

- [OpenCode Zen documentation](https://opencode.ai/docs/zen/)
- [OpenCode Zen model catalog](https://opencode.ai/zen/v1/models)
- [OpenCode Zen OpenAI-compatible route](https://github.com/anomalyco/opencode/blob/dev/packages/console/app/src/routes/zen/v1/chat/completions.ts)
