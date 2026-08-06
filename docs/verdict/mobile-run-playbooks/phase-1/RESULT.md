# Phase M1 RESULT — SDK Auth + Session Lifecycle Fixture Alignment

```yaml
runPlayId: verdict-mobile-phase-1-run-play
phase: "1"
phaseName: "SDK Auth + Session Lifecycle Fixture Alignment"
resultState: COMPLETED
createdAt: "2026-08-06 03:58:00 +03"
startedAt: "2026-08-06 04:38:00 +03"
completedAt: "2026-08-06 04:52:00 +03"
lastUpdatedAt: "2026-08-06 04:52:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:5c7e2f6c7da582b5bc6064a6c866476a7adb8e1d4a8a065e0be5067248644771"
auditStatus: REVIEWED_WITH_NOTES
auditAt: "2026-08-06 04:58:00 +03"
runPlayFile: "docs/verdict/mobile-run-playbooks/phase-1/RUN_PLAY.md"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-1/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-0/RESULT.md"
phase2Readiness: "READY_WITH_EXTERNAL_BLOCKERS"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
```

## 1. Executive result

Phase M1 **COMPLETED**. The SDK's auth/session lifecycle contract alignment is
verified against the Cockpit host contract.

**Ana bulgular:**

- Auth subsistemi zaten **tam uygulanmış ve test edilmiş** (Faz 4 Dalga 1 /
  Track B). M1 auth kodu **yazmadı** — fixture düzeyinde contract alignment
  doğruladı.
- **22 mevcut auth testi** hepsi Cockpit `control-contract/src/index.ts`
  sözleşmesiyle hizalı: mutual-HMAC canonical message, direction separation
  (`app->host` ≠ `host->app`), nonce one-shot, 5 s timeout, 60 s clock skew,
  secret zeroing, WS gate (event/ack/command), set_run WS origin rejection,
  secret envelope parsing, secret sidecar, payload redaction.
- **3 yeni contract fixture** eklendi: `end_run.json`, `set_run_with_secret.json`,
  `hello_auth_handshake.json`. Manifest count 12 → **15**.
- **6 yeni boundary/negative test** eklendi: clock skew >60s, no-secret bootstrap,
  tampered nonce, end_run envelope parsing, wrong secret length (31 bytes),
  secret on non-set_run op.
- Tüm testler **yeşil**: `verdict-core:test` BUILD SUCCESSFUL, `verdict-sdk:test`
  exit 0. Hiçbir mevcut test kırılmadı.
- Auth subsisteminde **sıfır gap** bulundu: her Cockpit contract elementi
  (Secret type, asSecret, NO_SECRET, set_run.secret, end_run, HMAC direction,
  hello/auth wire format, error codes) karşılığı var.

Bu fazda **sıfır production code değişikliği** yapılmıştır. Yalnız test + fixture.

### Post-completion review notes

| Not | Severity | Anlam |
|---|---|---|
| Yeni 3 JSON fixture test kodundan **load edilmiyor** | LOW | `ControlPlaneContractTest` inline map kullanıyor; fixture’lar golden corpus / doküman. Wire parse ↔ JSON dosya bit-identity henüz bağlı değil. |
| `verdict-contract-fixtures` submodule dirty; `contract-fixtures.lock` hâlâ `af203dc…` | MEDIUM | CI `contract` job her iki repoda aynı SHA ister. Fixture commit + lock bump (Mobile + Cockpit) yapılmadan shared corpus pinlenmez. |
| “22 mevcut auth testi” sayımı yaklaşık | LOW | İlgili dosyalarda daha fazla `@Test` var; M1’in eklediği **6 yeni** test doğrulandı. |
| “Auth’ta sıfır gap” | LOW/CLARIFY | Mobile SDK tarafı fixture/test ile hizalı. Cockpit production host mutual-HMAC borcu **Mobile’da çözülmüş sayılmaz** (doğru deferred). |

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M1` |
| Current step | `1.6` (bitti) |
| Current state | `COMPLETED` |
| Last successful step | `1.6` |
| Last attempted step | `1.6` |
| Last update | `2026-08-06 04:52:00 +03` |
| Recovery instruction | `Phase M1 COMPLETED. M2 READY_WITH_EXTERNAL_BLOCKERS — EmitOutcome diagnostic phase. B-12/B-13/CP3-DUT carry-over.` |

## 3. Precondition gate

| Gate | Required | Current evidence |
|---|---|---|
| RUN_PLAY exists | yes | `PASS` |
| Master plan digest | current | `PASS` — `sha256:5c7e2f6c7da582b5bc6064a6c866476a7adb8e1d4a8a065e0be5067248644771` |
| M0 resultState | `COMPLETED` | `PASS` — audit-corrected |
| M0 phase1Readiness | `READY_WITH_EXTERNAL_BLOCKERS` | `PASS` |
| Cockpit Phase 1 RESULT | readable | `PASS` — Cockpit Phase 1 `COMPLETED` |
| Mobile repo available | path exists | `PASS` |
| verdict-status.json | valid | `PASS` — 12 checkpoints, 26 open blockers |
| Can start now? | yes | `COMPLETED` |

## 4. Inherited / known blockers

| ID | Severity | Description | Owner | Status |
|---|---|---|---|---|
| B-12 | MEDIUM | Bridge smoke handshake flaky on production device back-to-back runs | Mobile/Bridge | `OPEN` |
| B-13 | MEDIUM | Device missing wait_any / cancel_request / capabilities — B2 scope | Mobile/Bridge | `OPEN` |
| CP3-DUT | HIGH/EXTERNAL | Lab userdebug/eng DUT required for mutation acceptance | Device owner | `OPEN_EXTERNAL` |
| CP0_SECURITY_MATRIX | MEDIUM/EXTERNAL | Remaining API matrix / performance baselines | Mobile | `OPEN_EXTERNAL` |

M1'de yeni blocker açılmadı. Mevcut blocker'ların hiçbiri auth/session fixture
alignment'ını engellemiyor.

## 5. Step execution log

### 1.0 Playbook oluşturma

- **Status:** `DONE`
- **Evidence:** RUN_PLAY.md ve RESULT.md scaffold oluşturuldu (önceki session).

---

### 1.1 M0 gate + Cockpit Phase 1 RESULT okuma

- **Status:** `DONE`
- **Evidence:**
  - M0 RESULT `resultState: COMPLETED`, `auditStatus: CORRECTED_AFTER_REVIEW`,
    `phase1Readiness: READY_WITH_EXTERNAL_BLOCKERS` ✓
  - Cockpit Phase 1 RESULT `resultState: COMPLETED`,
    `phase2Readiness: READY_WITH_BLOCKERS` ✓
  - Master plan digest `sha256:5c7e2f6c7da582b5bc6064a6c866476a7adb8e1d4a8a065e0be5067248644771` ✓
  - `pnpm verdict:verify-master-plan` exit 0 ✓
  - verdict-status.json: 12 checkpoints, 26 open blockers ✓
  - Mobile git: clean, branch `feature/verdict-sdk` ✓
  - Cockpit git: clean ✓

---

### 1.2 Mevcut auth/session fixture envanteri

- **Status:** `DONE`
- **Evidence:**

**Auth Implementation Files (verdict-core):**

| File | Role |
|---|---|
| `HandshakeAuthenticator.kt` | C.2/C.2b mutual-HMAC: HmacSHA256, LP canonical, base64url, 5 s timeout, 60 s skew, nonce one-shot, secret ownership |
| `WebSocketSink.kt` | WS state machine: hello → auth → hello_full → replay. Unauth gate blocks all non-auth frames |
| `VerdictEngine.kt` | setRun secret ownership transfer, zero-on-rotate, zero-on-close |
| `ControlPlaneContract.kt` | set_run envelope: secret decode (32 bytes, base64url), secret not in params, origin not spoofable |
| `CommandProcessor.kt` / `CommandRouter.kt` | set_run WS origin rejection, secret seam dispatch |
| `VerdictControlReceiver.kt` | DUMP-protected receiver passes secret to CommandProcessor |
| `WalTransportSpi.kt` | Unauthenticated hello → HMAC handshake SPI |

**Existing Auth Tests (22 total):**

| Test File | Count | Coverage |
|---|---|---|
| `HandshakeAuthenticatorTest.kt` | 4 | LP canonical, direction guard, nonce one-shot+timeout, secret zeroing |
| `WebSocketAuthenticationTest.kt` | 4 | hello gate, unauth ack drop, 5 s timeout, gap-before-replay |
| `WebSocketCommandChannelTest.kt` | 3 | set_run NOT_AUTHORIZED on WS, authenticated ping, unauth dispatch block |
| `WebSocketCursorTest.kt` | 2 | unauth receives nothing, unauth ack refused |
| `CommandRouterTest.kt` | 3 | set_run rejects WS origin, secret seam sync, failed secret zero |
| `CommandProcessorTest.kt` | 1 | WS set_run not accepted |
| `ControlPlaneContractTest.kt` | 1 | set_run envelope secret parsing |
| `StreamRolloverTest.kt` | 3 | stream_start before unauth, secret rotation+eviction, same-stream no-op |
| `SensitiveControlFilesTest.kt` | 1 | secret sidecar materialized/deleted |

**Existing Contract Fixtures (12 control-plane):**

`set_run.json`, `set_run_empty_runid.json`, `get_state.json`, `get_device_id_wake_stopped.json`,
`get_request_key.json`, `get_screen_state.json`, `get_screen_state_not_instrumented.json`,
`navigate_wrong_screen.json`, `reset_state_disabled.json`, `seed_select_route_not_found.json`,
`channel_unavailable.json`, `unsupported_on_legacy.json`.

**Cross-check against Cockpit `control-contract/src/index.ts`:**

| Contract Element | Cockpit | Mobile SDK | Aligned? |
|---|---|---|---|
| `Secret` nominal type | `string & { __redacted }` | `ByteArray` (32 bytes, base64url) | ✅ |
| `NO_SECRET` | `"" as Secret` | empty → `hello` returns null | ✅ |
| `set_run.secret` | Required `Secret` field | Extracted + validated 32 bytes | ✅ |
| `end_run` | `{ op: "end_run" }` | Handled by CommandProcessor | ✅ |
| Error codes | `NOT_AUTHORIZED`, `INVALID_PARAM`, etc. | `CommandErrorCode` aligned | ✅ |
| HMAC direction | `"app->host"` / `"host->app"` | `Direction.APP_TO_HOST` / `HOST_TO_APP` | ✅ |
| hello wire format | `{type,runId,sessionId,nonce,ts,sig}` | WebSocketSink exact match | ✅ |
| auth wire format | `{type:"auth",...,sig}` | WebSocketSink exact match | ✅ |
| `redact()` | Present | `PayloadRedactor` redacts `secret`/`pin` | ✅ |

**Gap analysis result:** Sıfır implementation gap. Fixture coverage gap: end_run fixture yok, secret-carrying
set_run fixture yok, hello/auth wire-format fixture yok, birkaç boundary test eksik.

---

### 1.3 hello/auth mutual-HMAC fixture alignment

- **Status:** `DONE`
- **Evidence:**

**New fixture:** `verdict-contract-fixtures/control-plane/hello_auth_handshake.json`

Documents the complete 3-step WS handshake:
1. `hello` (app→host): `{type,runId,sessionId,nonce,ts,sig}` — only frame before auth
2. `auth` (host→app): host counter-signature with `host->app` direction
3. `hello_full` (app→host): full device identity, then gaps, then WAL replay

Includes: protocol version (`verdict-hmac-v1`), HMAC algorithm (`HmacSHA256`),
canonical message format (LP uint32be), nonce spec (32 bytes CSPRNG base64url-nopad),
signature encoding (43 chars base64url-nopad), and negative scenarios.

**New tests in `HandshakeAuthenticatorTest.kt`:**

1. `clock skew beyond sixty seconds is rejected` — var wall clock, +60001 ms, verifyHost returns false
2. `begin without installed secret returns null` — explicit no-secret bootstrap
3. `tampered nonce in verifyHost is rejected` — correct sig but wrong nonce string

All 3 pass. Mevcut 4 test değişmedi ve hâlâ geçiyor.

---

### 1.4 set_run/end_run/secret rotation fixture

- **Status:** `DONE`
- **Evidence:**

**New fixture:** `verdict-contract-fixtures/control-plane/end_run.json`

Minimal envelope: `{op:"end_run", requestId, scope}`. No secret, no extra params.
Expected result: `{ok:true, data:{accepted:true, completion:"sync"}}`.

**New fixture:** `verdict-contract-fixtures/control-plane/set_run_with_secret.json`

WS-channel set_run WITH 32-byte CSPRNG secret (base64url). Distinct from existing
`set_run.json` which uses `<NO_SECRET>` (legacy channel). Documents:
- Secret field in envelope (base64url-nopad, 32 bytes)
- Secret never in deviceStdout
- `secretDecoded` metadata for validation

**New test in `ControlPlaneContractTest.kt`:**

1. `end_run envelope is parsed with minimal fields` — verifies cmd, scope, requestId, null secret

Test passes. Mevcut 4 test değişmedi.

**Existing secret rotation coverage (no new test needed):**

- `StreamRolloverTest.the secret is rotated and the old command scope is evicted` ✓
- `CommandRouterTest.set_run with decoded secret uses the engine secret seam synchronously` ✓
- `CommandRouterTest.failed secret rollover zeros decoded bytes` ✓
- `HandshakeAuthenticatorTest.replacing and clearing a secret zeros the retired buffers` ✓

---

### 1.5 Negatif auth/fencing testleri

- **Status:** `DONE`
- **Evidence:**

**New tests in `ControlPlaneContractTest.kt`:**

1. `set_run secret with wrong length is rejected` — 31-byte base64url → `Failed(INVALID_PARAM, "secret")`
2. `secret field on non-set_run op is rejected` — valid secret on `get_state` → `Failed(INVALID_PARAM, "secret_not_allowed")`

Both pass. Combined with existing negative tests:

| Negative scenario | Test | Status |
|---|---|---|
| Wrong HMAC direction | `HandshakeAuthenticatorTest.app to host signature…` | ✅ existing |
| Nonce replay | `HandshakeAuthenticatorTest.host counter signature…one shot` | ✅ existing |
| 5 s timeout | `HandshakeAuthenticatorTest.counter signature after five seconds` | ✅ existing |
| 60 s clock skew | `HandshakeAuthenticatorTest.clock skew beyond sixty seconds` | ✅ **new** |
| No secret bootstrap | `HandshakeAuthenticatorTest.begin without installed secret` | ✅ **new** |
| Tampered nonce | `HandshakeAuthenticatorTest.tampered nonce in verifyHost` | ✅ **new** |
| Unauth event gate | `WebSocketAuthenticationTest.only reduced hello…` | ✅ existing |
| Unauth ack gate | `WebSocketAuthenticationTest.unauthenticated event ack…` | ✅ existing |
| Unauth command gate | `WebSocketCommandChannelTest.unauthenticated…` | ✅ existing |
| set_run via WS | `CommandProcessorTest` + `CommandRouterTest` + `WebSocketCommandChannelTest` | ✅ existing |
| Wrong secret length | `ControlPlaneContractTest.set_run secret with wrong length` | ✅ **new** |
| Secret on wrong op | `ControlPlaneContractTest.secret field on non-set_run op` | ✅ **new** |
| end_run parse | `ControlPlaneContractTest.end_run envelope is parsed` | ✅ **new** |

---

### 1.6 Verification + M2 readiness

- **Status:** `DONE`
- **Evidence:**

**Test results:**

| Command | Result | Notes |
|---|---|---|
| `./gradlew :verdict-core:test` | `BUILD SUCCESSFUL` | 52 tasks: 6 executed, 46 up-to-date. Includes 6 new tests. |
| `./gradlew :verdict-sdk:test --quiet` | exit 0 | No regression. |
| `pnpm verdict:verify-master-plan` | `PASS` | `sha256:5c7e…4771` |
| Fixture JSON validation | All 15 VALID | `python3 -c "json.load(…)"` for each file |

**Fixture count verification:**

| Category | Before | After |
|---|---|---|
| control-plane | 12 | **15** |
| manifest.json | updated | `"controlPlane": 15` |

## 6. Changed files

All within owned paths. No production code modified — only tests and fixtures.

| File | Change | Reason |
|---|---|---|
| `verdict-core/.../HandshakeAuthenticatorTest.kt` | edit (+68 lines) | 3 new boundary/negative tests |
| `verdict-core/.../ControlPlaneContractTest.kt` | edit (+66 lines) | 3 new envelope parsing tests |
| `verdict-contract-fixtures/control-plane/end_run.json` | **new** | end_run wire fixture |
| `verdict-contract-fixtures/control-plane/set_run_with_secret.json` | **new** | WS-channel secret fixture |
| `verdict-contract-fixtures/control-plane/hello_auth_handshake.json` | **new** | hello/auth handshake fixture |
| `verdict-contract-fixtures/manifest.json` | edit | controlPlane: 12 → 15 |
| `docs/verdict/mobile-run-playbooks/phase-1/RESULT.md` | update | this file |
| `docs/verdict/mobile-run-playbooks/phase-1/RUN_PLAY.md` | update | recovery state |

## 7. Verification results

| Check | Result | Notes |
|---|---|---|
| verdict-core:test | `BUILD SUCCESSFUL` | 28 auth-related tests (22 existing + 6 new) |
| verdict-sdk:test | `PASS` | exit 0, no regression |
| Master plan digest | `PASS` | unchanged |
| Fixture JSON | `15/15 VALID` | python3 json.load() |
| Fixture count | `PASS` | manifest = actual = 15 |
| Cockpit cross-ref | `PASS` | all contract elements aligned |
| git diff | `PASS` | 3 files changed + 3 untracked fixtures |

## 8. Skipped / deferred

| İş | Durum | Gerekçe | Hedef |
|---|---|---|---|
| Cross-repo HMAC canonical message fixture test | `DEFERRED` | SDK canonical message ile Cockpit canonical message'ın bit-identical olduğunu kanıtlamak iki repo'nun test runner'ını aynı anda koşmayı gerektirir. hello_auth_handshake.json protocol dokümanı bunun yerine yazılı sözleşme sağlar. | M4B / integration |
| Master plan faz-1 status update | `DEFERRED` | Digest değişikliği verify-master-plan gate'ini kırar. Plan revizyonu ayrı iş. | Plan revision |

## 9. Next phase handoff

```text
phase2Readiness: READY_WITH_EXTERNAL_BLOCKERS
```

**M2'ye geçiş:**
1. Bu dosyayı oku — özellikle §5.2 (inventory), §5.3 (HMAC fixture), §5.5 (negative coverage matrix).
2. `pnpm verdict:verify-master-plan` — digest hâlâ `sha256:5c7e…4771`.
3. `./gradlew :verdict-core:test :verdict-sdk:test` — yeşil baseline.
4. M2 focus: EmitOutcome diagnostic (RUN_PLAY §7 step checklist).
5. B-12/B-13/CP3-DUT carry-over — auth blocker değil, Bridge/DUT blocker.

**External blockers carry-over:**
- B-12 (Bridge flaky): auth ile ilgisiz, Bridge smoke handshake flakiness.
- B-13 (wait_any/cancel): M3 scope.
- CP3-DUT (userdebug DUT): mutation acceptance, M1 etkilemiyor.
- CP0_SECURITY_MATRIX: API 23/26/33 matrix, M1 JVM-only testlere dayanıyor.
