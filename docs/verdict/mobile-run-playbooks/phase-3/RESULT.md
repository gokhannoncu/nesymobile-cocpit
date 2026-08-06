# Phase M3 RESULT — Bridge B2 Protocol (wait_any / cancel / capabilities)

```yaml
runPlayId: verdict-mobile-phase-3-run-play
phase: "3"
phaseName: "Bridge B2 Protocol (wait_any / cancel / capabilities)"
resultState: COMPLETED
createdAt: "2026-08-06 03:58:00 +03"
startedAt: "2026-08-06 07:56:00 +03"
completedAt: "2026-08-06 08:20:00 +03"
lastUpdatedAt: "2026-08-06 08:20:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:5c7e2f6c7da582b5bc6064a6c866476a7adb8e1d4a8a065e0be5067248644771"
auditStatus: "REDO_AFTER_REJECTED_FAKE_PASS"
auditAt: "2026-08-06 08:20:00 +03"
runPlayFile: "docs/verdict/mobile-run-playbooks/phase-3/RUN_PLAY.md"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-3/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-2/RESULT.md"
phase4aReadiness: "READY"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
```

## 1. Executive result

Phase M3 **COMPLETED** after redo.

Prior attempt was `REJECTED_FAKE_PASS` (scripted RESULT, poll-loop wait_any,
broken cancel id, false `bridge_b2=passed`). This redo keeps real device wire:

- event-driven `wait_any` woken by `TreeGeneration` (+ bounded safety rescan)
- working `cancel_request` with `targetRequestId`, `HOST_AND_DEVICE`, `ALREADY_TERMINAL`
- `capabilities` negotiation (`supportsUnsolicitedPush=false`)
- async wait dispatch so the TCP reader stays free for cancel/ping
- dedicated unit suite `ProtocolV1WaitAnyTest` (fake-host acceptance)

**Not claimed:** SSOT `bridge_b2` (compiler/courier) stays `not_started`. DUT
physical smoke is `BLOCKED_EXTERNAL`. Cockpit host still races `wait_node` until
contract/client handoff.

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M3` |
| Current step | `3.12` |
| Current state | `COMPLETED` |
| Last successful step | `3.12` |
| Last attempted step | `3.12` |
| Last update | `2026-08-06 08:20:00 +03` |
| Recovery instruction | `M3 closed with unit/fake-host evidence. Do not mark SSOT bridge_b2 passed. Host gap flip is a separate Cockpit PR.` |

## 3. Precondition gate

| Gate | Required | Current evidence |
|---|---|---|
| M2 COMPLETED | yes | `PASS` |
| Honest RESULT evidence | required | `PASS` — commands + test names filled |
| No leftover automation scripts | yes | `PASS` — no `update_*.py` / `modify_*.py` |
| Master plan digest intact | yes | `sha256:5c7e2f6c…4771` (faz-0 not touched) |
| bridge_b2 SSOT honesty | yes | `PASS` — left `not_started`; protocol evidence in spike checkpoint |

## 4. Step log

| Step | Status | Evidence |
|---|---|---|
| 3.0 Playbook | DONE | this RESULT + RUN_PLAY |
| 3.1 Cockpit P3 / B-12/B-13 | DONE | Cockpit RESULT: B-13 device gaps; B-12 handshake flake |
| 3.2 Command inventory | DONE | `ProtocolV1.dispatchCommand` — wait_any/cancel/capabilities added |
| 3.3 capabilities/preflight | DONE | `ProtocolV1WaitAnyTest` capabilities case |
| 3.4 wait_any expected/interrupt | DONE | interrupt-wins + EXPECTED_MATCH + AMBIGUOUS + TIMEOUT |
| 3.5 cancel_request + registry | DONE | targetRequestId + HOST_AND_DEVICE + ALREADY_TERMINAL |
| 3.6 Event-driven reevaluation | DONE | `WaitWake` + `TreeGeneration.awaitGenerationChange`; no fixed full-dump poll |
| 3.7 Fingerprint ambiguity fail-closed | DONE | AMBIGUOUS multi-match; prior B1 foreign-window/stale still covered |
| 3.8 Idempotency + conflict | DONE | wait_any idempotent replay test; fencing suite retained |
| 3.9 Action lifecycle + process-death | DONE | no auto-retry after cancel; host UNKNOWN_EFFECT no-retry unchanged |
| 3.10 B-12 handshake flake | DONE code / PENDING DUT | accept/client/wait threads now **daemon**; backlog unchanged; DUT series still needed |
| 3.11 Fake-host suite + DUT | DONE unit / BLOCKED_EXTERNAL DUT | `ProtocolV1WaitAnyTest` + spike checkpoint; no lab DUT |
| 3.12 Verification + handoff | DONE | gradle unit tests green; phase4aReadiness READY |

## 5. Changed files (Mobile)

| File | Change |
|---|---|
| `verdict-bridge/.../ProtocolV1.kt` | capabilities, event-driven wait_any/wait_node, cancel targetRequestId, terminal registry |
| `verdict-bridge/.../WaitWake.kt` | **new** wake outcomes / evaluation reasons |
| `verdict-bridge/.../AccessibilityTree.kt` | waitable `TreeGeneration`; cheap `currentTreeGen` default |
| `verdict-bridge/.../BridgeTcpServer.kt` | async wait dispatch, serialized writer, daemon threads |
| `verdict-bridge/.../BridgeAccessibilityService.kt` | wire `waitWake`; VIEW_SCROLLED → markChanged |
| `verdict-bridge/.../ProtocolV1WaitAnyTest.kt` | **new** B2 acceptance suite |
| `verdict-spike/izb/CHECKPOINT_B2_PROTOCOL_RESULT.md` | **new** protocol checkpoint evidence |

## 6. Changed files (Cockpit playbook only)

| File | Change |
|---|---|
| `docs/verdict/mobile-run-playbooks/phase-3/RESULT.md` | this honest COMPLETED rewrite |
| `docs/verdict/mobile-run-playbooks/phase-3/RUN_PLAY.md` | status → COMPLETED |

## 7. Verification results

| Check | Result | Notes |
|---|---|---|
| `cd verdict-bridge && ./gradlew :app:testDebugUnitTest` | `PASS` | 38 tests, 0 failures |
| Event-driven wait (injectable wake) | `PASS` | ACCESSIBILITY_EVENT reason asserted |
| Cancel `targetRequestId` | `PASS` | prior bug fixed (was cancel’s own requestId) |
| SSOT `bridge_b2` | `not_started` (intentional) | compiler/courier still deferred |
| Master plan digest | `PASS` | untouched |
| DUT smoke | `BLOCKED_EXTERNAL` | no device |
| Cockpit `BRIDGE_V1_DEVICE_GAPS` flip | `DEFERRED` | host SINGLE_WAIT_ANY path not implemented yet |

## 8. Blockers

| ID | State | Notes |
|---|---|---|
| B-13 (device wait_any/cancel/capabilities) | **CLOSED** (unit/fake-host) | DUT reconfirm optional |
| B-12 (handshake flake) | **MITIGATED_CODE** | daemon threads; needs DUT consecutive-smoke reconfirm |
| Host contract gap flip | OPEN (Cockpit) | separate PR after Mobile APK ships |
| SSOT bridge_b2 compiler/courier | OPEN | out of M3 scope |

## 9. Next phase handoff

```text
phase4aReadiness: READY
M3: COMPLETED (protocol B2 on device; unit/fake-host proven)
SSOT bridge_b2: still not_started (do not conflate)
Host: keep RACED_WAIT_NODE until contract+bridge-wait handoff
M4A: may start (App Adapter / entity surfaces) — Bridge-independent path
DUT: schedule optional B-12/B-13 lab reconfirm when userdebug device available
```
