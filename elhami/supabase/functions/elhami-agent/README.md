# Guided runtime — review-only deployment packet

No credentials, database changes, Edge deployment, paid calls or live smoke test were performed by this worker. `node test-guided-agent.mjs` is entirely mocked. The old `backend/server.mjs` is a separate legacy prototype and must not be used as this runtime's production endpoint.

## Boundary
- Browser `guided-agent.js`: child uses same-origin, generation-bound host bridge; no token in child messages. Parent `handleHost` restricts endpoint to configured Supabase origin and exact function suffix. Integration owner adds script tags/relay.
- `index.ts`: validates user with Supabase Auth `/auth/v1/user`, rejects anonymous users, ignores user-supplied identity/settings/tools. Requires exact allowed Origin and POST, 60 KB streamed JSON cap. User JWT plus explicit verified owner predicate reads private workspace only on explicit memory consent and selected memory IDs. Group mode never reads private memory.
- Published retrieval: `elhami_published_content` by projectId, citable `sources` entries `{id,title,text,page,verified:true}` only. No search engine, GDrive, arbitrary URL fetch or invented book access. Editorial body is not treated as a book quotation. Source text remains untrusted model input.
- Policy lifecycle is goal → explore → optional artifact → end. Exact citation source IDs, pages and substrings are validated. Semantics of all prose cannot be mathematically guaranteed; human review still matters. No automatic save, personality memory, scoring or diagnosis.
- One model request per explicit action, zero retries and zero paid model tools. These conservative limits intentionally stay fixed for now; later bounded iteration requires per-step reservations. Prepared search/cards/export/save never invoke a model. No fallback provider.

## Review/apply order (owner only)
1. Review SQL `runtime-budget.sql` and existing RLS. Apply through approved workflow; it creates isolated server-only budget tables and service-role-only RPCs, no private-content grants. SQL has NOT been executed or integration-tested against Postgres.
2. Set Supabase server secrets: `OPENAI_API_KEY`, `OPENAI_MODEL`, `ELHAMI_ALLOWED_ORIGINS` (comma-separated exact origins), `ELHAMI_INPUT_USD_PER_MILLION`, `ELHAMI_OUTPUT_USD_PER_MILLION`, `ELHAMI_AGENT_ENABLED=true`. Supabase URL/service-role/anon key must exist on server. Explicit full-price model rates required: no hardcoded price, free-tier assumption or cached-token discount.
3. After operator approves a monetary ceiling, set budget enabled/ceiling/per-request cap; default false/0 blocks all spending. Rate and global/per-owner concurrency are atomic across isolates. Crashed requests retain reservations; timeout settlements conservatively charge full reservation. Audit has only UUIDs/timing/status/cost, no user text.
4. Deploy function with JWT verification enabled; test real auth rejection, RLS isolation, two simultaneous reserve calls and budget exhaustion before live model smoke. Native Deno and Postgres are unavailable; Node 24 imported the TypeScript endpoints with mocked Deno/fetch for HTTP-policy tests. Deployment and SQL remain unverified.
5. Set public `agent-config.json` to `{ "enabled":true, "endpoint":"https://<confirmed-project>.supabase.co/functions/v1/elhami-agent" }`. No key or custom access token in frontend config. `status()` means configuration readiness, not a successful live call.

Cost upper bound uses UTF-8 input bytes plus schema/instructions and 2048 framing allowance, full uncached input rate and max output tokens (including hidden reasoning). If actual billing exceeds reserved estimate, settlement disables the budget. Incorrect operator prices or provider price changes remain an operational risk: review rates before enabling and periodically. The monetary guard is application-side, not a guarantee against outside use of the same API key.

## Bounded voice implementation (code present; disabled until operator configuration)
`supabase/functions/elhami-transcribe` is a separate authenticated binary endpoint. The browser `transcribe(blob,{consent:true})` decodes actual MediaRecorder MP4/WebM with Web Audio, downmixes/resamples to 16kHz mono and writes canonical 16-bit PCM WAV. It does not relabel the source MIME. Server independently validates every canonical header field and byte length; maximum 1,920,044 bytes yields <=60 seconds independent of caller duration claims. Only `audio/wav` and explicit-once consent header are accepted. No filesystem/storage/audio logging/TTS or raw-audio persistence.

Set `ELHAMI_TRANSCRIBE_ENABLED=true`, `ELHAMI_TRANSCRIBE_MODEL=gpt-transcribe`, and an explicitly verified `ELHAMI_TRANSCRIBE_USD_PER_MINUTE` before enablement. Official docs currently recommend duration-priced gpt-transcribe ($0.0045/min checked 2026-11-01); legacy whisper/4o transcription models are deprecated. Rate is deliberately not hardcoded. Each audio request gets a separate atomic reservation/audit kind under the shared operator ceiling; full reserved cost is conservatively charged on success or ambiguity, not refunded based on client estimates. Existing JSON endpoint does not accept audio. Public config `voiceEnabled:true` is only a UI configuration indication, never proof of live availability.

A single explicit user button may authorize transcription plus guided discussion. The caller may keep the editable transcript collapsed; it must not claim successful understanding until the server returns text. Recheck active view/account before adopting any result. No automatic upload at recording stop. See `test-guided-audio.mjs` (mocked).

## Server session enforcement
A browser per-mode ephemeral session UUID is bound to authenticated owner in private SQL. Server begin/finish RPCs atomically enforce one in-flight request, repeated-input stop, terminal goal/stop, and max six guided turns. Hashes use owner-bound HMAC; no raw transcript, goal, name or private passage is stored. The sixth-turn bound is a safety boundary, not a claim the goal was met. `newSession(mode)` should be called only when the user explicitly starts a new goal. New sessions are rate-limited and all requests still share monetary/concurrency limits. A crashed in-flight session stays blocked; a user can explicitly start a new goal while unresolved cost remains reserved.

## Provider substitution
`openai.mjs` implements `{generate(context,config) -> {output,usage}}` with Responses structured output and store:false. A future Cloudflare adapter must independently pass schema, provenance, isolation, usage-accounting and behavior tests. Configuration/UI/data stay separate; no assertion of identical behavior or automatic paid fallback. store:false is not a promise of zero provider retention.

## Official documentation checked 2026-11-01
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/reference/resources/responses/methods/create (search reference confirms max_output_tokens includes reasoning; direct large page failed fetch)
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/changelog (markdown fetch unsupported; HTML checked)

Voice docs: https://developers.openai.com/api/docs/guides/speech-to-text and https://developers.openai.com/api/docs/models/gpt-transcribe (checked 2026-11-01).

## Explicit selected-fragment synthesis
`selectedFragments` is an optional list of at most two `{id,title,text}` values: unique IDs max100 alphanumeric/underscore/hyphen; title max200; total text max10000 characters. Only fragments explicitly selected by the user enter this path. They are not automatically imported memories or verified book sources. Completed synthesis must return `provenance` for every selected fragment, using exact valid IDs and connected quote substrings; server canonicalizes their titles and rejects fabricated or incomplete provenance. Schema exposes `provenance:[{fragmentId,title,quote}]` separately from `citations`. Render and preserve these links with any user-approved artifact. The semantic relationship remains an interpretation; substring validation does not prove the inference itself.

Private rolled-back Postgres test packet: `/workspace/shared/elhami-runtime-transaction-tests.sql` (operator only; never publish actor identities in the frontend). Prepared, NOT executed by this worker. Apply latest SQL with explicit NULL/nonfinite guards before running it. Final ROLLBACK is mandatory.
