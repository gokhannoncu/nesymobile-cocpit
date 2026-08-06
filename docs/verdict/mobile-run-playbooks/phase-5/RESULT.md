# Phase M5 RESULT — Correlation, Clock, Recovery Observation + Bridge Lifecycle

```yaml
runPlayId: verdict-mobile-phase-5-run-play
phase: "5"
phaseName: "Correlation, Clock, Recovery Observation + Bridge Lifecycle"
resultState: COMPLETED
createdAt: "2026-08-06 03:58:00 +03"
startedAt: "2026-08-06 22:28:00 +03"
completedAt: "2026-08-06 22:40:00 +03"
lastUpdatedAt: "2026-08-06 22:40:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:b81631396044cab7f83f6b6efea2f47ff4b4bda4b177b2d7a2ad705535b660b2"
runPlayFile: "docs/verdict/mobile-run-playbooks/phase-5/RUN_PLAY.md"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-5/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-4c/RESULT.md"
phase6Readiness: "READY_WITH_EXTERNAL_BLOCKERS"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
```

## 1. Executive result

Phase M5 device/SDK correlation + recovery observation surface is **COMPLETED**
(unit + protocol evidence). Cockpit Phase 5 remains COMPLETED. Lab DUT correlation/
cancel smoke and Bridge handshake flakiness remain external for M6+.

```text
CHECKPOINT M5: COMPLETED (phase6Readiness = READY_WITH_EXTERNAL_BLOCKERS)
Correlation: EventAttributes + data merge (WAL envelope unchanged)
Clock: Bridge ping clockDomain=CLOCK_BOOTTIME + bootCount + calibration flag
Recovery: nesy.recovery.{queue,delivery,payment,fiscal,restore} allowlisted
Lifecycle: cancel_request / alreadyTerminal / no auto-retry (M3 + M5 ping markers)
DUT: not run (CP3-DUT / B-12)
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M5` |
| Current step | `5.6` |
| Current state | `CLOSED_READY_WITH_EXTERNAL` |
| Last successful step | `5.6` |
| Last attempted step | `5.6` |
| Last update | `2026-08-06 22:40:00 +03` |
| Recovery instruction | `M5 closed for unit surface. Start M6. DUT correlation/cancel smoke remains external.` |

## 3. Precondition gate

| Gate | Required | Current evidence |
|---|---|---|
| RUN_PLAY exists | yes | `PASS` |
| Master plan digest | verified at close | `PASS` (`pnpm verdict:verify-master-plan`) |
| Cockpit Phase 5 | COMPLETED | `PASS` (`run-playbooks/phase-5/RESULT.md`) |
| M3 + M4B (+ M4C) | COMPLETED | `PASS` |
| Mobile repo available | yes | `PASS` |
| Can start now? | — | started / closed |

## 4. Inherited / known blockers

| ID | Severity | Description | Owner | Status |
|---|---|---|---|---|
| B-12 | MEDIUM | Bridge smoke handshake flaky on production device back-to-back runs | Mobile/Bridge | `OPEN` |
| B-13 | MEDIUM | Device missing wait_any / cancel_request / capabilities | Mobile/Bridge | `CLOSED` (protocol + fake-host; M3/M4C) |
| CP3-DUT | HIGH/EXTERNAL | Lab userdebug/eng DUT required for mutation acceptance | Device owner | `OPEN_EXTERNAL` |
| CP0_SECURITY_MATRIX | MEDIUM/EXTERNAL | Remaining API matrix / performance baselines | Mobile | `OPEN_EXTERNAL` |
| FIXTURE_LOCK | LOW | M4C fixture submodule SHA pin not bumped | Mobile+Cockpit | `OPEN` (inherited) |

## 5. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 5.0 Playbook oluşturma | `DONE` | scaffold |
| 5.1 M3/M4B/M4C + Cockpit Phase 5 gate | `DONE` | CP5 COMPLETED; M3/M4B/M4C COMPLETED |
| 5.2 Correlation metadata | `DONE` | `EventAttributes` fields → `mergeCorrelationData`; `nesy.binding.correlation`; scanner stamp |
| 5.3 monoTs / clock markers | `DONE` | Bridge `ping` `clockDomain`/`bootCount`/`calibrationValidUntilReboot`; envelope `monoTs` |
| 5.4 Recovery observation queries | `DONE` | five `nesy.recovery.*` allowlisted projections |
| 5.5 Bridge cancel/unknown-effect | `DONE` | existing `ProtocolV1WaitAnyTest` cancel/alreadyTerminal/no auto-retry + ping markers |
| 5.6 Verification + M6 handoff | `DONE` | unit suites PASS; DUT deferred |

## 6. Changed files

### NesyMobile

| File | Change | Reason |
|---|---|---|
| `verdict-api/.../EventAttributes.kt` | correlation fields + `CorrelationKeys` | M5 metadata without envelope widen |
| `verdict-core/.../EventMapping.kt` | `mergeCorrelationData` | fold into `data` |
| `verdict-core/.../VerdictEngineTest.kt` | correlation merge tests | evidence |
| `verdict-bridge/.../ProtocolV1.kt` | ping clock markers + `bootCount` | CLOCK_BOOTTIME contract |
| `verdict-bridge/.../BridgeAccessibilityService.kt` | Settings.Global.BOOT_COUNT | device boot marker |
| `verdict-bridge/.../ProtocolV1WaitAnyTest.kt` | ping clock test | evidence |
| `app/.../NesyCorrelationContext.kt` | **new** process-local stamp | host enrichment |
| `app/.../NesyAppAdapterManifest.kt` | recovery refs + correlation op | allowlist |
| `app/.../NesyAppAdapterQueryCapability.kt` | recovery projections | observation |
| `app/.../NesyAppAdapterCommands.kt` | `nesy.binding.correlation` + emit stamp | wiring |
| `app/.../FiscalInvoiceDataDao.kt` | count/listRecent | fiscal recovery |
| `app/src/test/.../NesyCorrelationContextTest.kt` | **new** | evidence |
| `app/src/test/.../NesyAppAdapterManifestTest.kt` | recovery allowlist | evidence |
| `docs/m5-host-vs-app-fields.md` | **new** | host vs app field matrix |

### Cockpit (playbooks only)

| File | Change |
|---|---|
| `docs/verdict/mobile-run-playbooks/phase-5/RESULT.md` | this file |
| `docs/verdict/mobile-run-playbooks/phase-5/RUN_PLAY.md` | recovery state |
| `docs/verdict/mobile-run-playbooks/PROGRESS.md` | board |
| `docs/verdict/mobile-run-playbooks/README.md` | phase map |
| `docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md` | Mobile table + digest |

## 7. Verification results

| Check | Result | Notes |
|---|---|---|
| `pnpm verdict:verify-master-plan` | `PASS` | digest at close |
| `:verdict-core:testDebugUnitTest` — `VerdictEngineTest` | `PASS` | correlation merge |
| `verdict-bridge :app:testDebugUnitTest` — `ProtocolV1WaitAnyTest` | `PASS` | ping + cancel suite |
| `:app:testTstrsDebugUnitTest` — Manifest/Correlation/M4c | `PASS` | adapter surface |
| Device DUT cancel/correlation smoke | `SKIPPED` | CP3-DUT / B-12 |

## 8. Skipped / deferred

- Full product-path stamping of every `Automation*Helper` emit (mechanism + scanner path wired; broader stamp is M7)
- DUT reboot calibration invalidation live demo
- `contract-fixtures.lock` bump (inherited M4C)

## 9. Next phase handoff

```text
phase6Readiness: READY_WITH_EXTERNAL_BLOCKERS
Next: M6 Inspector destek (dump/screenshot redaction)
External still open: CP3-DUT, B-12 Bridge smoke flaky
Do not flip Cockpit faz-* YAML from this Mobile close.
```
