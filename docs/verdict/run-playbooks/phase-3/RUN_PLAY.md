# Phase 3 RUN_PLAY — Bridge Host Client ve Device Preflight

```yaml
runPlayId: verdict-cockpit-phase-3-run-play
phase: 3
phaseName: "Bridge Host Client ve Device Preflight"
status: IMPLEMENTATION_COMPLETE
recoveryState: CP3_BLOCKED_PRODUCTION_DUT
createdAt: "2026-08-05 06:32:00 +03"
startedAt: "2026-08-05 07:05:00 +03"
completedAt: "2026-08-05 10:05:00 +03"
lastUpdatedAt: "2026-08-05 10:05:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
previousPhaseResult: "docs/verdict/run-playbooks/phase-2b/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-3/RESULT.md"
phase2Readiness: "COMPLETED"
phase2bReadiness: "COMPLETED"
phase3Readiness: "IMPLEMENTATION_COMPLETE"
blockingPreflight:
  - id: "B-8"
    status: "OPEN_NON_BLOCKING"
    meaning: "Repo-wide lint hâlâ ESLint v9 flat-config borcu nedeniyle blocking gate değil."
  - id: "CP0_EXTERNAL_DUT"
    status: "OPEN_EXTERNAL"
    meaning: "Fiziksel cihaz/SSOT kapıları repo içinde otomatik kapanmaz; CP3 gerçek DUT acceptance için cihaz gerekir."
```

## 1. Şu an hangi kısımdayız?

Phase 0, Phase 1, Phase 2 ve Phase 2B tamamlandı.

```text
Phase 0: COMPLETED / baseline çıkarıldı
Phase 1: COMPLETED / typecheck + CI gate
Phase 2: COMPLETED / durable event runtime + waitEvent
Phase 2B: COMPLETED / B-10 Prisma baseline migration repair
Current: Phase 3 READY_TO_START
Next executable phase: Bridge Host Client ve Device Preflight
```

Phase 3'e geçilebilir. Kalan repo-içi blocking migration/typecheck/test borcu yoktur.
Kalan borçlar:

```text
B-8: repo-wide lint non-blocking
CP0_EXTERNAL_DUT: fiziksel cihaz/SSOT acceptance external
```

## 1.1 AI agent'a verilecek başlangıç metni

Başka bir AI agent'a Phase 3'ü yaptırırken aşağıdaki metin tek başına başlangıç
komutu olarak verilebilir. Agent yine de repo içindeki `RUN_PLAY.md`, `RESULT.md`,
master plan ve ilgili kod dosyalarını okuyarak çalışmalıdır.

```text
Verdict Cockpit Phase 3'ü uygula.

Önce şu dosyayı oku:
docs/verdict/run-playbooks/phase-3/RUN_PLAY.md

Sonra şu dosyayı oku ve çalışma durumunu IN_PROGRESS olarak güncelle:
docs/verdict/run-playbooks/phase-3/RESULT.md

Bu fazın hedefi Bridge Host Client ve Device Preflight altyapısını kurmaktır.
Bridge protocol contract, typed Bridge client, fake TCP Bridge test harness,
DeviceWorker entegrasyonu, dynamic host port lease, device command admission,
TargetFingerprint/action lifecycle, wait_any ve cancel_request foundation
uygulanacak.

Başlamadan önce mutlaka:
- pnpm verdict:verify-master-plan
- git status --short
- pnpm typecheck
- pnpm test
komutlarını çalıştır.

Kurallar:
- Owned paths dışına çıkma.
- Mobile repo'ya yazma.
- Bridge/Core içine Nesy veya başka domain business type sokma.
- OPEN_STOP, APPROVE_TOUR, COURIER_LOGIN, STOP, PARCEL, TOUR gibi kavramlar
  bridge contract/client içinde bulunamaz.
- wait_any hot path full accessibility dump veya fixed polling yapamaz.
- register_watch/unsolicited push bu fazda yok; ilk B2 request-response kalacak.
- Sabit koordinat action/workflow kabul edilmez.
- Ambiguous/stale target hiçbir fiziksel action uygulamadan fail eder.
- Action response loss UNKNOWN_EFFECT üretir; wait socket loss WAIT_CONNECTION_LOST
  üretir.
- Gerçek DUT yoksa CP3 COMPLETED yazma; DUT_UNAVAILABLE external blocker olarak
  RESULT.md içine yaz.

Kapanışta RESULT.md dosyasına changed files, commands, test evidence, acceptance
durumu, blocker listesi ve Phase 4A readiness kararını yaz. Son doğrulamada en az:
- pnpm verdict:verify-master-plan
- pnpm typecheck
- pnpm test
- git diff --check
- git diff --cached --check
çalıştır.
```

Bu fazın kapanışı iki seviyeli değerlendirilir:

```text
Implementation acceptance
  → fake bridge, contract, client, preflight, unit/integration tests

Checkpoint 3 full acceptance
  → gerçek DUT üzerinde command set + wait_any/cancel + device preflight smoke
```

Gerçek cihaz yoksa Phase 3 kodu tamamlanabilir ama CP3 `COMPLETED` yazılamaz;
`READY_WITH_EXTERNAL_DUT_BLOCKER` veya `BLOCKED_EXTERNAL_DUT` olarak kapanır.

## 2. Amaç

Phase 3'ün amacı Cockpit'in Verdict Accessibility Bridge protocol v1 ile typed,
güvenli ve deterministik konuşmasını sağlamaktır:

```text
Bridge Contract
  → versioned command/result schemas

Bridge Client
  → NDJSON TCP, pending request map, timeout, cancellation, reconnect semantics

Device Gate
  → Bridge APK/version/hash/accessibility/capability/ping preflight

Device Command Admission
  → CONTROL / OBSERVATION / WAIT / MUTATION lane limits

UiWaitPlan foundation
  → request-response wait_any + cancel_request
```

Bu faz, WorkflowIR v2 veya Domain Pack fazı değildir. Bridge business kavram bilmez.
`OPEN_STOP`, `APPROVE_TOUR`, `COURIER_LOGIN`, `STOP`, `PARCEL`, `TOUR` gibi kavramlar
Bridge contract veya client'a giremez.

## 3. Neden bu sırada?

WorkflowIR v2 ve BridgeFlowCompiler ileride UI action primitive'lerine plan üretecek.
Eğer Bridge client/action/wait semantics kanıtlanmadan compiler yazılırsa:

- compiler yanlış primitive'e göre şekillenir,
- stale tree veya ambiguous selector sessiz tap üretir,
- long wait socket reader'ı bloke eder ve cancel okunamaz,
- action response kaybı exactly-once varsayılır,
- active run ile Inspector aynı cihazda paralel mutation yapar,
- production device üzerinde Act Mode yanlışlıkla açılabilir.

Bu yüzden önce Bridge host temeli ve device preflight doğrulanır.

## 4. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `3` |
| Current step | `3.13` (bitti) |
| Current state | `IMPLEMENTATION_COMPLETE_CP3_BLOCKED_PRODUCTION_DUT` |
| Last successful step | `3.13` |
| Last attempted step | `3.13` |
| Last update | `2026-08-05 10:05:00 +03` |
| Recovery instruction | `Phase 3 implementation TAMAM ve gerçek cihazda parite kanıtlı (20/20 read-only smoke). typecheck 11/11, test 505 passed / 38 skipped. CP3 full acceptance BLOCKED: bağlı cihaz production (ro.build.type=user), jest enjeksiyonu politika gereği reddedildi — lab cihaz (userdebug/eng) gerekiyor. Kod tarafında açık iş yok. Detay RESULT.md §1/§15/§19.` |

Step sonuçları başlangıçta:

| Step | Sonuç |
|---|---|
| 3.0 Playbook oluşturma | `DONE` |
| 3.1 Preflight ve inherited blocker check | `DONE` |
| 3.2 Existing Bridge/ADB/DeviceWorker baseline | `DONE` |
| 3.3 Bridge protocol contract package | `DONE` |
| 3.4 Fake TCP Bridge server harness | `DONE` |
| 3.5 BridgeClient runtime | `DONE` |
| 3.6 Device gate ve port lease store | `DONE` |
| 3.7 Device Command Admission scheduler | `DONE` |
| 3.8 TargetFingerprint/action lifecycle contract | `DONE` |
| 3.9 wait_any/cancel_request foundation | `DONE` |
| 3.10 DeviceWorker integration | `DONE` |
| 3.11 Artifact/screenshot/redaction | `DONE` |
| 3.12 Real DUT smoke script/gate | `PARTIAL` — 20/20 read-only PASS, mutation adımları production deny ile SKIP |
| 3.13 Verification/result/handoff | `DONE` |

## 5. Phase 3 scope

Phase 3 şunları kapsar:

1. Master plan v1.1.3 digest doğrulama.
2. Phase 2B result ve B-10 kapanışını doğrulama.
3. Mevcut ADB/logcat/DeviceWorker/Control Channel baseline envanteri.
4. `packages/bridge-contract` oluşturma veya mevcut contract alanına Bridge protocol
   v1 tiplerini ekleme.
5. `packages/bridge-client` oluşturma veya API içinde bounded typed Bridge client
   service'i kurma.
6. NDJSON incremental parser: partial/multi-line/malformed/oversized frame testleri.
7. Handshake, protocol mismatch, capability manifest ve unknown additive field
   toleransı.
8. Command/result discriminated union:
   `dump`, `find/resolve`, `tap/activate`, `input`, `swipe`, `back`, `screenshot`,
   `wait_node`, `wait_any`, `cancel_request`, `ping/capabilities`.
9. `TargetFingerprint`, stable `rowKey`, optional `rowIndexHint`, nodeRef/treeGen/
   bounds/window/collection model.
10. Action lifecycle transition: accepted, dispatched, gestureStarted,
    gestureCompleted, observed, terminal/unknown-effect/failure.
11. `dispatchGesture` primary ve allowlisted `performAction` method evidence.
12. `wait_any` request/response, expected/interrupt race, ambiguity/timeout/cancel,
    stableForMs/deadline/priority/candidate limits.
13. `cancel_request` aynı socket'te reader'ı bloke etmeden çalışır.
14. İlk B2'de `register_watch`/unsolicited push yoktur; parser fail-closed.
15. Device preflight:
    lab allowlist, production deny, APK installed, version/hash/protocol,
    accessibility enabled, port forward, ping/capability, battery/freecess/foreground
    diagnostics.
16. Device Command Admission:
    CONTROL priority, bounded OBSERVATION, separate heavy observation quota, WAIT
    cancellable worker, single MUTATION lane, Inspector takeover denial.
17. Fake bridge server testleri ve mümkünse real DUT smoke script.
18. Screenshot artifact decode/path/redaction guard.

## 6. Kapsam dışı

Phase 3'te aşağıdakiler yapılmaz:

- WorkflowIR v2 production implementation.
- Domain Pack implementation veya Nesy semantic node üretimi.
- BridgeFlowCompiler.
- BridgeFlowExecutor/Oracle v2 cutover.
- Cockpit UI route migration.
- Maestro sökümü.
- Mobile Bridge APK içinde büyük behavior değişikliği.
- SDK mutual-HMAC işine geri dönmek.
- Remote backend action / Nesy tur onayı implementation.

Mobile repo değişikliği gerekiyorsa bu Phase 3'ün normal scope'u değildir. Önce
fixture/contract mismatch kanıtı RESULT'a yazılır; sonra Mobile owner veya ayrı
mobile work package gerekir.

## 7. Owned paths

Phase 3 agent'ı aşağıdaki alanlarda değişiklik yapabilir:

```text
docs/verdict/run-playbooks/phase-3/RUN_PLAY.md
docs/verdict/run-playbooks/phase-3/RESULT.md
packages/bridge-contract/**
packages/bridge-client/**
apps/api/src/services/bridge-*.ts
apps/api/src/services/bridge-*.test.ts
apps/api/src/services/fake-bridge-*.ts
apps/api/src/services/fake-bridge-*.test.ts
apps/api/src/services/device-worker.ts
apps/api/src/services/device-*.ts
apps/api/src/services/device-*.test.ts
apps/api/src/plugins/adb-bridge.ts
apps/api/src/routes/bridge-*.routes.ts
apps/api/src/routes/device-*.routes.ts
packages/db/prisma/schema.prisma
packages/db/prisma/migrations/**
packages/control-contract/src/**
packages/control-channels/src/**
.github/workflows/**
scripts/**
```

DB migration yalnız action lifecycle/device gate/admission persistence için gerçekten
gerekiyorsa yapılır. Sırf geçici test state'i için Prisma schema büyütülmez.

## 8. Read-only context paths

Başlamadan önce okunacak dosyalar:

```text
docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md
docs/verdict/run-playbooks/README.md
docs/verdict/run-playbooks/phase-2/RESULT.md
docs/verdict/run-playbooks/phase-2b/RESULT.md
docs/verdict/run-playbooks/phase-3/RUN_PLAY.md
docs/verdict/run-playbooks/phase-3/RESULT.md
package.json
pnpm-workspace.yaml
turbo.json
apps/api/package.json
apps/api/tsconfig.json
apps/api/src/services/device-worker.ts
apps/api/src/plugins/adb-bridge.ts
packages/control-contract/src/index.ts
packages/control-channels/src/index.ts
packages/control-channels/src/node-executor.ts
packages/db/prisma/schema.prisma
```

Mobile Bridge reference read-only:

```text
/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/
```

Önce `rg --files` ile Bridge APK/protocol dosyaları bulunur. Mobile repo'ya yazılmaz.

## 9. Ön koşullar

Phase 3 başlamadan önce:

1. `pnpm verdict:verify-master-plan` PASS olmalı.
2. `pnpm typecheck` PASS olmalı.
3. `pnpm test` PASS olmalı.
4. `pnpm --filter @nesy/db exec prisma migrate deploy` disposable Postgres üzerinde
   çalışabilir olmalı veya Phase 2B result kanıtı geçerli olmalı.
5. Worktree temiz veya mevcut değişiklikler açıkça bu faza ait olmalı.
6. B-8 lint borcu non-blocking olarak kaydedilmeli.
7. Gerçek DUT yoksa en başta `DUT_UNAVAILABLE` olarak result'a yazılmalı; fake bridge
   work devam edebilir.

## 10. Work package sırası

### 3.1 Preflight ve inherited blocker check

Komutlar:

```bash
pnpm verdict:verify-master-plan
git status --short
git branch --show-current
pnpm typecheck
pnpm test
pnpm --filter @nesy/db exec prisma migrate status
```

Acceptance:

- Master digest v1.1.3 doğru.
- Phase 2B RESULT `COMPLETED`.
- B-10 `CLOSED`.
- Worktree durumu result'a yazıldı.

### 3.2 Existing Bridge/ADB/DeviceWorker baseline

Okunacak dosyalar:

```text
apps/api/src/services/device-worker.ts
apps/api/src/plugins/adb-bridge.ts
apps/api/src/services/test-event-bridge.ts
apps/api/src/services/courier-device-identity.ts
apps/api/src/services/device-courier-auth.ts
packages/control-channels/src/**
packages/control-contract/src/**
```

Mobile repo'da aranacaklar:

```bash
rg -n "Bridge|Accessibility|9876|wait_node|wait_any|dump|screenshot|dispatchGesture|performAction" "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
```

Acceptance:

- Existing host/device gap listesi RESULT'a yazıldı.
- Hangi contract Mobile'da var, hangisi host'ta eksik net.
- Phase 3 implementation planı mevcut kodu gereksiz rewrite etmeden nereye bağlanacağını
  gösteriyor.

### 3.3 Bridge protocol contract package

Hedef:

```text
packages/bridge-contract
```

Alternatif: mevcut package yapısı bunu kaldırmıyorsa `packages/control-contract` içinde
geçici `bridge-*` contract dosyası; ama RESULT'ta neden ayrı package oluşturulmadığı
yazılır.

Minimum contract:

```text
BridgeProtocolVersion
BridgeCommandEnvelope
BridgeResultEnvelope
BridgeErrorCode
BridgeCapabilityManifest
DumpScope
Selector
TargetFingerprint
TargetResolutionEvidence
BridgeActionLifecycle
BridgeActionResult
UiPredicate
UiWaitPlan
UiWaitTarget
UiInterruptTarget
WaitAnyRequest
WaitAnyResult
CancelRequest
CancelResult
DeviceCommandAdmissionEnvelope
```

Acceptance:

- Schema tests/fuzz/property tests var.
- Unknown additive field toleransı testli.
- Oversized frame/payload rejection testli.
- Domain business type yok.

### 3.4 Fake TCP Bridge server harness

Hedef:

- Deterministik fake Bridge server.
- NDJSON partial frame, multi-frame, malformed, oversized, delayed response,
  duplicate terminal, out-of-order result ve socket close senaryoları.
- `wait_any` long-running job ve `cancel_request` race testleri.

Acceptance:

- Fake server client testleri gerçek TCP üzerinden koşuyor.
- Reader loop long wait sırasında cancel frame okuyabiliyor.

### 3.5 BridgeClient runtime

Minimum:

- TCP lifecycle.
- Handshake/ping/capability.
- Incremental NDJSON parser.
- Pending request map.
- Timeout/AbortSignal.
- Same requestId idempotent retry.
- Different payload same requestId conflict.
- Connection loss:
  - mutation/action in-flight ise `UNKNOWN_EFFECT`;
  - wait in-flight ise `WAIT_CONNECTION_LOST`;
  - read-only ise retry policy.
- Redacted logging/metrics.

Acceptance:

- Unit/fake TCP integration tests.
- No hanging pending request after socket close.
- Serialized writer no interleaved NDJSON.

### 3.6 Device gate ve port lease store

Minimum:

- Lab allowlist.
- Production deny.
- Bridge APK installed/version/hash/protocol check.
- Accessibility service enabled check.
- Device `9876` bind/listen/ping check.
- Per-device dynamic host port allocator.
- `adb forward --no-rebind`.
- Stale forward/lease cleanup.
- Capability snapshot persistence/read model.
- Battery/freecess/foreground diagnostics.

Acceptance:

- Fake ADB tests.
- Port collision tests.
- Production deny fail-closed.
- Device preflight DTO exact failure reason/action önerisi taşıyor.

### 3.7 Device Command Admission scheduler

Lanes:

```text
CONTROL      cancel_request, emergency abort, heartbeat
OBSERVATION  dump/find/screenshot metadata-level light reads
WAIT         wait_any/wait_node cancellable workers
MUTATION     tap/input/swipe/back/activate; single lane
HEAVY_OBS    full diagnostic screenshot/dump artifact; bounded quota
```

Acceptance:

- Aynı cihazda iki mutation paralel değil.
- CONTROL cancel starvation yok.
- Long WAIT mutation lane'i tutmuyor.
- Active run sırasında Inspector Act fail-closed veya explicit takeover audit.
- Mutation sonrası stale read/nodeRef invalidation + wait immediate reevaluation.

### 3.8 TargetFingerprint/action lifecycle contract

Acceptance:

- `rowIndexHint` tek başına kalıcı target değil.
- Stable `rowKey` + fingerprint strength policy.
- Ambiguous selector tap yapmıyor.
- Stale tree action yapmadan reddediliyor.
- Action lifecycle terminal state'e kadar persisted veya test-visible.
- Gesture start/end device monotonic marker, requestId, target fingerprint evidence var.
- Manual-touch contamination injected interval'dan ayrı evidence.

### 3.9 wait_any/cancel_request foundation

Acceptance:

- Expected ve interrupt tek bounded wait içinde yarışıyor.
- Initial evaluation event beklemeden çalışıyor.
- Accessibility event-driven reevaluation var.
- Event gelmezse adaptive scoped safety rescan var.
- Full-tree polling yok; hot path full dump payload yok.
- `cancel_request` aynı socket'te terminal cancel sonucu üretiyor.
- `register_watch`/unsolicited push negative test var.
- Response küçük typed payload; candidate limit var.

### 3.10 DeviceWorker integration

Acceptance:

- DeviceWorker BridgeDeviceManager veya eşdeğer typed host client kullanıyor.
- ADB/logcat mevcut runtime korunuyor.
- Bridge unavailable ise explicit preflight failure, silent fallback yok.
- Dispose socket/forward/wait cleanup yapıyor.

### 3.11 Artifact/screenshot/redaction

Acceptance:

- Screenshot decode ve artifact path.
- Sensitive log redaction.
- Failure artifact ile normal success hot path ayrımı.
- Artifact size/retention placeholder veya policy ref.

### 3.12 Real DUT smoke script/gate

Gerçek cihaz varsa:

```text
scoped dump
find/resolve
tap/activate
input
swipe
back
screenshot
wait_node
wait_any expected
wait_any interrupt
cancel_request race
ambiguity/stale-tree
production deny
```

Gerçek cihaz yoksa:

- `RESULT.md` içinde `DUT_UNAVAILABLE` yaz.
- Fake bridge acceptance tamamlanabilir.
- CP3 `COMPLETED` değil, `READY_WITH_EXTERNAL_DUT_BLOCKER` olur.

### 3.13 Verification/result/handoff

Kapanış komutları:

```bash
pnpm verdict:verify-master-plan
pnpm typecheck
pnpm test
pnpm --filter @nesy/api typecheck
pnpm --filter @nesy/api test
pnpm --filter @nesy/bridge-contract typecheck
pnpm --filter @nesy/bridge-contract test
pnpm --filter @nesy/bridge-client typecheck
pnpm --filter @nesy/bridge-client test
git diff --check
git diff --cached --check
```

Paketler farklı adla açıldıysa komutlar result'ta güncellenir.

## 11. Expected file changes

Beklenen değişiklikler:

```text
packages/bridge-contract/**
packages/bridge-client/**
apps/api/src/services/bridge-*.ts
apps/api/src/services/fake-bridge-*.ts
apps/api/src/services/device-worker.ts
apps/api/src/plugins/adb-bridge.ts
apps/api/src/routes/bridge-*.routes.ts
apps/api/src/services/*.test.ts
docs/verdict/run-playbooks/phase-3/RUN_PLAY.md
docs/verdict/run-playbooks/phase-3/RESULT.md
```

Olası değişiklikler:

```text
pnpm-workspace.yaml
package.json
turbo.json
packages/db/prisma/**
.github/workflows/**
scripts/**
```

## 12. Acceptance criteria

Phase 3 implementation ancak şu kriterlerle tamamlanabilir:

1. Protocol fixture parity yeşil.
2. Partial/multiple/malformed/oversized NDJSON frame testleri yeşil.
3. Handshake/capability/protocol mismatch fail-fast.
4. Same requestId same payload idempotent; different payload conflict.
5. Scoped dump eksikse full dump fallback yok.
6. Ambiguous selector action uygulamıyor.
7. Stale tree action uygulamıyor.
8. `rowIndexHint` tek başına target identity değil.
9. Action lifecycle terminal state üretiyor.
10. Response loss action için `UNKNOWN_EFFECT`, wait için `WAIT_CONNECTION_LOST`.
11. Fixed coordinate workflow/action rejection.
12. Screenshot artifact oluşuyor; sensitive log yok.
13. Multi-device dynamic host port lease.
14. Production device Act Mode deny.
15. `wait_any` capability handshake + expected/interrupt/cancel smoke.
16. Long wait reader loop bloke etmiyor.
17. wait response full dump taşımıyor.
18. Initial evaluation event beklemiyor.
19. Scoped safety rescan bounded.
20. No global fixed full-tree polling.
21. Single mutation lane; control starvation yok.
22. Active-run Inspector Act denial/takeover audit.
23. `register_watch`/unsolicited push ilk B2'de yok.
24. Typecheck/test green.
25. Real DUT smoke green veya explicit `DUT_UNAVAILABLE` external blocker.

## 13. Rollback ve recovery notları

- Yeni paket eklenirse workspace metadata dikkatli güncellenir.
- DB migration varsa additive olur; destructive migration yok.
- Fake bridge testleri real DUT acceptance yerine geçmez.
- Device port forward cleanup idempotent olmalı.
- Bridge unavailable olduğunda Maestro fallback veya ADB tap fallback eklenmez.
- Manual touch contamination product failure değil, interaction origin/evaluation
  failure olarak ayrılmalıdır.

## 14. Agent çalışma kuralları

Bu fazı alan AI agent:

1. Master plan v1.1.3 digest doğrulamadan edit yapmaz.
2. Phase 2B B-10 kapanışını okur.
3. Bridge protocol'a domain business kavram sokmaz.
4. Mobile repo'yu yazmaz.
5. `as any`, kör `!`, test skip veya tsconfig gevşetmesi kullanmaz.
6. Full dump'u wait hot path'e sokmaz.
7. `register_watch`/unsolicited push eklemez; ilk B2 request-response kalır.
8. Device action fallback olarak sabit koordinat kullanmaz.
9. Gerçek DUT yoksa bunu açık external blocker yapar.
10. Kapanışta verification komutlarını ve RESULT evidence'ını yazar.

## 15. Agent'a verilecek uzun semantic prompt

```text
Sen Verdict Cockpit Phase 3 — Bridge Host Client ve Device Preflight agent'ısın.
Görevin master plan v1.1.3 kapsamındaki Bridge contract/client/device gate fazını
uygulamak.

Önce şu dosyaları oku:
- docs/verdict/run-playbooks/phase-3/RUN_PLAY.md
- docs/verdict/run-playbooks/phase-3/RESULT.md
- docs/verdict/run-playbooks/phase-2b/RESULT.md
- docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md içindeki FAZ 3, D.3,
  D.4 ve D.6D bölümleri
- apps/api/src/services/device-worker.ts
- apps/api/src/plugins/adb-bridge.ts
- packages/control-contract/src/index.ts
- packages/control-channels/src/index.ts

Başlamadan önce:
- pnpm verdict:verify-master-plan
- git status --short
- pnpm typecheck
- pnpm test
komutlarını çalıştır ve RESULT.md'i IN_PROGRESS yap.

Ana hedef:
Cockpit'in Verdict Accessibility Bridge protocol v1 ile typed ve güvenli konuşmasını
sağla. Contract, client, fake TCP bridge test harness, device preflight, dynamic host
port forwarding, command admission scheduler, TargetFingerprint/action lifecycle ve
wait_any/cancel_request foundation kur.

Önemli kurallar:
- Bridge ve Core domain bilmez: OPEN_STOP, APPROVE_TOUR, COURIER_LOGIN, STOP, PARCEL,
  TOUR gibi kavramlar bridge contract'a giremez.
- İlk B2 persistent register_watch/unsolicited push değildir. wait_any request-response
  ve cancel_request aynı socket'te çalışır.
- wait_any hot path full dump/polling yapamaz. Initial evaluation + event-driven
  reevaluation + bounded scoped safety rescan modeli kullanılmalı.
- Long wait socket reader'ı bloke edemez; cancel_request okunabilmeli.
- Action response kaybında exactly-once varsayma; UNKNOWN_EFFECT üret.
- wait socket loss için WAIT_CONNECTION_LOST ayrı olmalı.
- Sabit koordinat action/workflow kabul edilmez.
- Same requestId same payload idempotent; different payload conflict.
- Ambiguous/stale target action uygulamadan fail eder.
- Device Command Admission tek mutation lane ve control priority sağlar.
- Production device Act Mode fail-closed reddedilir.

Gerçek DUT varsa smoke script çalıştır:
dump/find/tap/input/swipe/back/screenshot/wait_node/wait_any/cancel/ambiguity/stale-tree.
Gerçek DUT yoksa fake bridge acceptance tamamlanabilir ama CP3 COMPLETED yazma;
DUT_UNAVAILABLE external blocker yaz.

Kapanışta:
- RESULT.md içinde changed files, commands, acceptance, blockers ve Phase 4A readiness
  kararını yaz.
- pnpm verdict:verify-master-plan
- pnpm typecheck
- pnpm test
- paket bazlı bridge contract/client typecheck/test
- git diff --check
- git diff --cached --check
çalıştır.
```

## 16. Agent'a verilecek kısa komut

```text
Bu repo içinde docs/verdict/run-playbooks/phase-3/RUN_PLAY.md dosyasını oku ve Phase 3'ü uygula.
Önce docs/verdict/run-playbooks/phase-3/RESULT.md dosyasını IN_PROGRESS yap, recovery state'i güncelle, sonra RUN_PLAY sırasıyla ilerle.
Owned paths dışına çıkma. Bridge/Core'a domain business type sokma. Gerçek DUT yoksa CP3 COMPLETED yazma; external blocker olarak belirt.
```
