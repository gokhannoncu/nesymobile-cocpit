# HTTP body capture — SDK wire contract (design, not yet implemented)

Status: **SDK IMPLEMENTED** (`NesyMobile`), cockpit side not started. The five
open decisions were approved on 2026-09-02 and are recorded in §10 with their
answers. Two things changed during implementation and this document was
corrected to match the code, not the other way round — see §12.

Scope: what the device is allowed to capture, how it is redacted, how it is cut
to size, how it reaches the cockpit, and how long it lives. UI design for the
Network tab is deliberately out of scope — it is written after this contract is
agreed.

---

## 1. What exists today

The SDK captures HTTP **metadata only**, and that is a deliberate, documented
position, not an omission:

- `verdict-transport-okhttp/.../NetworkCapture.kt` — class doc: request and
  response bodies "are never read, copied or wrapped here". It emits
  `HTTP_CALL` with exactly `method`, `host`, `path`, `code`, `bytes_out`,
  `bytes_in` (+ optional `query_keys`) and envelope `durationMs`.
- `verdict-api-okhttp/.../VerdictOkHttp.kt` — the interceptor records
  `method` + `url`; the `EventListener` records OkHttp's own byte counters
  (`requestBodyEnd` / `responseBodyEnd`). Neither touches a body stream.
- `sanitizeNetworkUrl` masks numeric path segments to `{id}` and, by default
  (`NetworkUrlPolicy.includeQueryKeys = false`), drops query **key names** as
  well — because a name like `impersonate_user` already leaks.

Observed reality for run `run_9b47f41e-…`: 33 `HTTP_CALL` rows, payload shape

```json
{"method":"POST","host":"nesy-staging-mobile-api.cityexpress.rs",
 "path":"/Auth/LoginDevice/","code":"200","bytes_out":"216","bytes_in":"1042"}
```

No headers, no bodies, and envelope `requestId` is null on every one of them.
`HTTP_RESPONSE_RECEIVED` and `HTTP_REQUEST_COMPLETED` are accepted by
`apps/api/src/services/run-telemetry-read-model.ts:157` but are never emitted by
the SDK.

## 2. Constraints this design must respect

These are measured, not assumed.

| # | Constraint | Source | Consequence |
|---|---|---|---|
| C1 | Every event today travels as **one logcat line**: `NESY_TEST_EVENT\|{json}` | `verdict-core/.../Sinks.kt` (`LogcatSink`); all 17 228 inbox rows carry a `NESY_…` prefixed `raw`, none carry `WS\|` | Android's logd truncates a log record around 4 KB. Longest line ever observed: **896 chars**. A body must be chunked or truncated to fit; it cannot be assumed to arrive whole. |
| C2 | Wire `data` is a **flat `Map<String, String?>`** | `EventAttributes` doc; `isStringRecord` in `test-event-bridge.ts` | A captured body is a *string* value, never a nested JSON object. |
| C3 | WAL frame cap is **1 MiB** | `WalFrame.MAX_PAYLOAD = 1 shl 20` | Not the binding limit; C1 is. |
| C4 | The wire-name set is **frozen at 49 names** and pinned across both repos | `verdict-contract-fixtures/manifest.json`; `contract-fixtures.lock` (`sha=af203dc5…`) | A new event name is a dual-repo fixture round, both PRs in the same cycle with `Pairs-With:`. The line parser itself is name-agnostic, so nothing rejects the name at ingest — but CI's `contract` job compares the two locks. |
| C5 | Envelope version is `v1`/`v2`, v2 **only adds optional fields** | `parseTestEventLine` | Additive keys are safe. Removing or retyping an existing key is not. |
| C6 | `verdict_inbox.payload` stores the parsed JSON **and** a verbatim `raw` copy of the same line | observed rows | Every captured body is persisted **twice**. Storage estimates must be doubled. |
| C7 | Redaction keys already exist and are shared with the control plane | `verdict-core/.../PayloadRedactor.kt` — `secret, pin, password, token, cookie, authorization, pan, cvv, iban`, matched as a lowercase **substring** | Reuse this list; do not fork a second one. |
| C8 | Raw-evidence gating already exists on the cockpit | `apps/web/src/lib/verdict-runtime/rbac.ts` — `verdict:evidence:raw`, `verdict-admin`, `security-reviewer` | Bodies are raw evidence and must sit behind this, not beside it. |

## 3. Correlation: the one change to `HTTP_CALL`

A body event is worthless if it cannot be joined to its call. The envelope
already carries `requestId`, the read model already parses it
(`safeIdentifier(payload.requestId)`), and it is **always null today**.

> **Decision 1.** `NetworkCallState` mints a per-call opaque id (128-bit
> random, hex, no request data in it) and `emitOnce` passes it as
> `EventAttributes.requestId`. `HTTP_CALL`'s `data` map is unchanged.

This is the cheapest possible seam: no new envelope field, no new `data` key,
the cockpit read model needs no change to start seeing it, and joining is a
plain equality on `requestId`. It does require a fixture round (C4) because the
pinned `HTTP_CALL` sample gains a populated optional field.

## 4. New wire name: `HTTP_BODY_CAPTURED`

One name, one direction per event, one chunk per event.

> **Decision 2.** Bodies are a **separate event**, never extra keys on
> `HTTP_CALL`. Reasons: `HTTP_CALL` stays inside C1's line budget and its
> pinned fixture stays byte-comparable; a body that is dropped, truncated or
> budget-denied does not cost the metrics event; and a deployment that ingests
> `HTTP_CALL` but not bodies is a valid, non-degraded deployment.

`data` keys (all values are strings, per C2):

| Key | Values | Notes |
|---|---|---|
| `direction` | `REQUEST` \| `RESPONSE` | required |
| `content_type` | e.g. `application/json` | media type only, parameters stripped |
| `original_bytes` | decimal | size **before** truncation; `-1` when unknown (chunked/streamed) |
| `captured_bytes` | decimal | size actually emitted across all chunks |
| `truncated` | `true` \| `false` | |
| `chunk_index` | `0`-based | |
| `chunk_count` | total chunks for this direction | |
| `encoding` | `utf8` | only value in v1; see Decision 5 |
| `body` | the chunk | already redacted (§5) and size-capped (§6) |
| `omitted_reason` | see below | present **only** when `body` is absent |

Envelope: `requestId` = the `HTTP_CALL`'s id (§3), `screen` and `spanId` as
usual. The event is emitted **after** the matching `HTTP_CALL`, so a consumer
that sees a body first must tolerate the call arriving later.

`omitted_reason` vocabulary — an omission is always *stated*, never silent:

`POLICY_DISABLED`, `HOST_NOT_ALLOWLISTED`, `CONTENT_TYPE_NOT_TEXTUAL`,
`BODY_TOO_LARGE`, `RUN_BUDGET_EXHAUSTED`, `NOT_REDACTABLE`, `STREAMING_BODY`,
`CAPTURE_FAILED`.

> **Decision 3.** When capture is on for a call but the body is not emitted, the
> SDK still emits `HTTP_BODY_CAPTURED` carrying only `direction` and
> `omitted_reason`. "We chose not to capture this" and "we captured nothing"
> must be distinguishable in the cockpit; the existing telemetry vocabulary
> already draws this line as `NOT_MEASURED`.

## 5. Redaction

> **Decision 4.** Redaction happens **on the device, before the event is
> emitted**. Nothing unredacted is written to the WAL, logcat, or the wire. The
> cockpit performs no redaction — it cannot, because by then the value has
> already left the phone.

Rules, in order:

1. **Headers are not captured in v1.** Not even an allowlist. `Authorization`
   and `Cookie` are the obvious hazards, but bearer tokens routinely appear in
   bespoke headers, and an allowlist that is wrong once is wrong permanently.
   Revisit only with a concrete need.
2. **JSON bodies** are parsed, walked, and every key matching
   `PayloadRedactor.isRedactedKey` (C7) is replaced with `***REDACTED***`,
   recursively, including inside arrays. The redacted tree is then re-serialised
   — so what ships is *provably* the walked tree, not the original text with
   substitutions.
3. **`application/x-www-form-urlencoded`** is decoded to pairs and the same key
   rule applies.
4. **Everything else textual** (`text/*`, XML) cannot be key-redacted with any
   confidence. It is omitted with `NOT_REDACTABLE`. A tempting middle ground —
   regex-scrubbing free text — is rejected: a regex that misses once has leaked
   a credential to a database that is not built to hold one.
5. **Non-textual** content types are omitted with `CONTENT_TYPE_NOT_TEXTUAL`.
   No base64 of images or protobuf in v1.
6. The domain field allowlist is **additive to** C7, never a replacement:
   Nesy-specific keys observed in this app's traffic (`deviceId`, `imei`,
   `phone`, `gsm`, `tckn`, `barcode` if judged personal) are appended to the
   shared list in `PayloadRedactor` so the control plane inherits them too.

> **Decision 5.** `encoding` is `utf8` and only `utf8` in v1. Bytes that are not
> valid UTF-8 mean the body was not textual, which rule 5 already omitted.

## 6. Size, chunking and budgets

Numbers are proposals sized against C1's measured 896-char ceiling:

| Knob | Proposed default | Why |
|---|---|---|
| `maxBodyBytes` (per direction, after redaction) | **8 192** | Covers Nesy's real payloads — the largest response in the sampled run was 1 042 B — with headroom, and stays far under C3. |
| `maxChunkBytes` (per event) | **2 048** | JSON-escaped and prefixed, a 2 KB chunk lands near 2.5–3 KB on the line, inside logd's ~4 KB record with margin. |
| `maxChunksPerBody` | **4** | 4 × 2 048 = `maxBodyBytes`. Beyond it: truncate, do not spill. |
| `maxBodyEventsPerRun` | **200** | ~33 calls/run today; 200 tolerates a chatty run without unbounded growth. |
| `maxBodyBytesPerRun` | **512 KiB** | Doubled by C6 to ~1 MiB of stored rows per run. This is the number to argue about before shipping. |

**A body over `maxBodyBytes` is omitted, not truncated.** Redaction requires a
parse and a truncated JSON document does not parse, so a body cut to fit could
only ever ship unredacted. The order is therefore fixed: read whole, parse,
redact, re-serialise, and only then cap. The adapter is handed
`maxBodyBytes + 1` as its read budget precisely so "exactly at the limit" stays
distinguishable from "larger than the limit"; the latter reports
`BODY_TOO_LARGE`.

`truncated=true` therefore means only one thing: redaction *grew* the document
past the cap (`***REDACTED***` is longer than a short value). That cut is safe
because it lands on text that has already been masked.

When a run-level budget is hit, every subsequent capture emits
`RUN_BUDGET_EXHAUSTED` (§4) rather than falling silent.

## 7. Where capture is allowed to run

> **Decision 6.** Body capture is **off by default**, opt-in per run, and
> refuses to arm on a production application id.

- New `NetworkBodyPolicy` in `verdict-api/.../VerdictConfig.kt`, next to the
  existing `NetworkUrlPolicy`: `enabled = false`, `captureRequest`,
  `captureResponse`, `hostAllowlist` (empty = capture nothing), `pathAllowlist`
  (empty = all paths of an allowlisted host), the §6 limits, and the additive
  redaction keys.
- Bound through `NetworkObserverCapability.bindNetworkUrlPolicy`'s sibling —
  one new default-bodied method, so existing observers stay source-compatible.
- **Build-variant hard gate, as an allowlist:** the policy arms only on an
  application id that ends in `test` (`.test`, `.rstest`, `.metest`, …) or is
  exactly `com.arasdigital.nesymobiledev`. Everything else is forced to
  `enabled = false` with a logged warning.

  This was originally specified as a *denylist* of production ids
  (`com.arasdigital.nesymobileprod*`) and that specification was wrong:
  `app/build.gradle`'s `defaultConfig` carries `com.arasdigital.nesymobile`,
  which does not match that prefix, so a production variant would have walked
  straight through the gate. An allowlist fails in the harmless direction — a
  variant nobody added is disarmed, costing evidence on a test device rather
  than leaking real courier bodies. Configuration is a runtime value and runtime
  values get copied between environments; the gate must not be the configuration
  itself.
- The host allowlist starting value is the staging API host only:
  `nesy-staging-mobile-api.cityexpress.rs`.

## 8. Where the body is read (OkHttp mechanics)

`EventListener` has no access to body content, so capture cannot live where the
byte counters live.

- **Response**: application-level `Interceptor`, `response.peekBody(limit)`.
  `peekBody` copies from the buffered source and leaves the real body
  untouched — the one supported way to read without consuming.
- **Request**: `request.body` written into a `okio.Buffer` and read back, capped
  at the same limit. A body reporting `isOneShot()` or `isDuplex()` is **not**
  read; it is omitted with `STREAMING_BODY`.
- Everything stays inside `runCatching`, matching the existing rule in
  `NetworkCapture.kt` and `emitOnce`: **diagnostics must never change the HTTP
  result**. A capture failure omits with `CAPTURE_FAILED` and the call proceeds.
- Cost is a byte copy plus a JSON parse per captured call, bounded by
  `maxBodyBytes`. It runs on the caller thread, so the 8 KiB cap is also a
  latency cap.

## 9. What the cockpit side will need (contract only)

Listed so the SDK is not built against an unknown consumer; the implementation
is a separate step.

1. `run-telemetry-read-model.ts` gains an `httpBodies` section: group
   `HTTP_BODY_CAPTURED` by `requestId` + `direction`, order by `chunk_index`,
   concatenate, and surface `truncated` / `omitted_reason` as first-class fields
   rather than folding them away.
2. `RunTelemetryHttpCall` gains `requestId`-joined body refs — it already
   carries the `requestId` field, unused, in
   `apps/web/src/lib/verdict-runtime/types.ts:103`.
3. Bodies are served **only** when `canReadRawEvidence` passes (C8); everyone
   else sees the call row with the body slot marked as permission-gated, not
   missing.
4. Retention: `verdict_inbox` has no TTL today. Before any body lands there, a
   purge policy for `HTTP_BODY_CAPTURED` rows (proposal: 30 days, and immediate
   purge on run delete) needs to exist — including the duplicated `raw` copy
   (C6).

## 10. Decisions taken (approved 2026-09-02)

1. **`maxBodyBytesPerRun` = 512 KiB.** Measured against 773 stored runs and
   17 301 events (14 MB, ~18 KB/run): realistic capture is ~40 KB/run, ~80 KB
   on disk after C6, so the cap carries ~13x headroom. It is a backstop for a
   runaway run, not a daily constraint — which is what keeps runs comparable to
   each other.
2. **`waybill` / `barcode` are not redacted.** A DB read settled it: real
   waybills (`11333042800798`) and real addresses
   (`KNEZA MILOSA ,11000 ,BEOGRAD ,RS`) already flow unmasked today in
   `data.waybill_numbers` and `data.first_address`. Masking the correlation key
   inside bodies while it stays visible one field over would buy no privacy and
   cost the feature its purpose. `RedactionKeys.NETWORK_BODY` documents the
   omission explicitly so it reads as a decision, not an oversight.
   *Separately*: `first_address` in today's metadata deserves its own review,
   independent of this feature.
3. **Retention: bodies 14 days, metadata 90 days, both purged on run delete.**
   The two serve different jobs — metadata is trend (months), bodies are
   debugging (days). The cockpit must render an expired body as `EXPIRED`, never
   as `NOT_MEASURED`: "we measured it and no longer keep it" and "we never
   measured it" are different claims.
4. **Bodies are evidence only; oracles may not assert on them.** Asserting would
   bind the verdict to data that is optional, budgeted, redacted, capped and
   absent in production — the same test would then produce different verdicts in
   different environments, which is exactly the determinism that makes today's
   verdicts worth anything. If field-level assertions are ever wanted, they get
   their own mechanism: targeted, single-field, uncapped, outside this budget.
5. **The WS transport is not promoted for this.** Zero of 17 301 stored events
   have ever arrived through it. Building bodies on it would mean a failure
   could be the capture or the transport with no way to tell them apart. Bodies
   ship over logcat with chunking; when WS is proven on its own, dropping
   chunking becomes a one-line policy change.

## 11. Rollout order

1. ~~Agree the open decisions.~~ **Done** — see §10.
2. ~~`NesyMobile`: `requestId` on `HTTP_CALL` (§3) + `NetworkBodyPolicy` (§7) +
   capture and redaction (§5, §8) + unit tests.~~ **Done** — 28 new unit tests
   (`NetworkBodyCaptureTest` 20, `VerdictOkHttpBodyTest` 5, `NetworkBodyGateTest`
   3; 51 green across the four modules),
   including assertions that a known secret ships masked, that an oversized body
   is refused rather than shipped, that peeking a response leaves the caller's
   own body intact, and that every application id in `app/build.gradle` lands on
   the correct side of the gate.
3. ~~`verdict-contract-fixtures`: add the body fixtures and the
   populated-`requestId` `HTTP_CALL` sample.~~ **Done, except the lock.** Four
   fixtures under a new `sdk__` prefix — `sdk__http_call`,
   `sdk__http_body_captured`, `sdk__http_body_chunk`, `sdk__http_body_omitted` —
   verified byte-for-byte by `LogcatSinkCorpusTest` and consumed by five new
   assertions in `contract-fixtures.test.ts`.

   The prefix is the point: `event__` means "one of the 49 frozen A.4.2 names"
   and both sides assert that count. `HTTP_CALL` was never in the 49 — it
   reaches the cockpit through the A.5 passthrough guarantee — so filing body
   capture under `event__` would have redefined "frozen" to mean "whatever we
   have shipped so far". `sdk__` gives these events pinned bytes without
   touching the frozen set, and a fixture that lands under `event__` by habit
   now fails the count assertion on both sides.

   **Still open (C4):** `contract-fixtures.lock` in both repos. It cannot move
   until the fixture repo commit exists, and committing is the user's call.
   Note that the lock is *already* stale independently of this work: both repos
   pin `af203dc5…` while both checkouts sit on `0fc2a9d…`.
4. `NesyMobileCocpit`: read-model section, RBAC gate, retention job (§9).
5. Network tab UI — designed against the shipped contract, not before it.

## 12. Corrections made during implementation

Both were specification errors caught by writing the code and reading the app's
own build file. They are recorded rather than quietly fixed, because each one
read as safe and was not.

1. **Truncation could not coexist with redaction** (§6). The original design had
   bodies suffix-truncated to fit and separately redacted. Redaction needs a
   parse; a truncated JSON document does not parse. Implemented as
   omit-if-oversized instead.
2. **The environment gate was a denylist that missed the default variant** (§7).
   `app/build.gradle`'s `defaultConfig` uses `com.arasdigital.nesymobile`, which
   the specified `com.arasdigital.nesymobileprod*` prefix does not match.
   Inverted to an allowlist of test ids, with a test that enumerates every
   application id in `app/build.gradle` on the correct side.

One behaviour differs from what §4 predicted, harmlessly: body events are
emitted from the interceptor, which runs *before* `EventListener.callEnd` emits
`HTTP_CALL`. Bodies therefore usually arrive **before** their call rather than
after. The read model must join on `requestId` and tolerate either order, which
§9.1 already required.
