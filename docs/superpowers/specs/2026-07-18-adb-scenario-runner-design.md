# ADB Scenario Runner — Real Execution + Chaos Receiver

**Date:** 2026-07-18  
**Status:** Approved for implementation  
**Apps:** NesyMobileCocpit (`/debug-view/adb-scenarios`) + NESY.Courier.Mobile (test flavors)

## Problem

The ADB Scenario Runner UI is mock-only: Run advances fake steps on a timer.
Device selection already uses real ADB, but scenario commands target fictional
packages (`com.nesy.mobile*`) and broadcasts that do not exist on Courier Mobile.
Hard field situations (token expiry, schedule date skew, shipment restart,
forced offline) cannot be driven deterministically.

## Goals

1. Replace mock execution with an **allowlisted** scenario executor on the Cockpit
   Next.js server (`POST /api/adb/scenarios/run` + SSE progress).
2. Add test-flavor **ChaosReceiver** + **ProtectedRequestKeyReceiver** to Courier
   Mobile so token/schedule/offline/restart/key can be controlled via `am broadcast`.
3. Ship **20 predefined hard-situation scenarios** mapped to real OS + Chaos APIs.
4. Align package names to `com.arasdigital.nesymobile*`.

## Non-goals (v1)

- Free-form shell command execution from the UI
- LTE/signal-quality throttle (`tc` / OEM radio) — simulated via wifi/data flap + airplane
- Persistent multi-user run history / DB-backed audit log
- Production-flavor chaos receivers (stripped from production manifests)

## Decisions

| Topic | Choice |
| --- | --- |
| Execution model | Allowlist: scenario ID → typed steps (no raw command strings) |
| Mobile surface | ChaosReceiver + ProtectedRequestKeyReceiver (test/dev flavors) |
| Production safety | Receivers removed via flavor `tools:node="remove"`; `BuildConfig.ENABLE_CHAOS_RECEIVER` |
| Progress transport | SSE (same pattern as log/network streams) |
| Package resolve | Existing `findNesyPackage` / `getAppIdentity` |
| History | In-memory server run + client session history (no Postgres in v1) |

## Architecture

```
UI Run → POST /api/adb/scenarios/run { scenarioId, serial, params }
           → ScenarioExecutor (allowlist)
           → adb.ts helpers (shell / broadcast / force-stop / start)
           → device OS chaos  OR  ChaosReceiver / ProtectedRequestKeyReceiver
           → SSE step events → Run Panel
```

### ChaosReceiver actions

| Action | Effect |
| --- | --- |
| `CLEAR_TOKEN` / `CORRUPT_TOKEN` | Clear or corrupt `SP.token` |
| `SET_TOKEN_EXPIRY_HINT` | Write expired JWT-shaped token for foreground logout path |
| `SET_OFFLINE` | Force `offlineMode` true/false |
| `SET_ALT_URL` | Set `alternativeURL` / http / port |
| `SET_SCHEDULE_DATE` | Mutate Room `scheduleMetaJson.scheduleDate` |
| `CLEAR_SCHEDULE` | Wipe schedule (+ optional request queue) |
| `RESTART_SHIPMENT` | Cancel waiting delivery requests for waybill + restore originals |
| `DUMP_STATE` | Return JSON via broadcast result data |
| `FORCE_LOGOUT` | Clear session flags + token |

### ProtectedRequestKeyReceiver actions

| Action | Effect |
| --- | --- |
| `GET_KEY` | `NativeKey.doWork` / `encryptAppSignature` result |
| `GET_DEVICE_ID` | `Settings.Secure.ANDROID_ID` |

Broadcast result format matches Cockpit parsers: `data="…"`.

## 20 predefined scenarios

| ID | Category | Mechanism |
| --- | --- | --- |
| `scn-mid-delivery-offline` | network | `svc wifi/data disable` |
| `scn-force-offline-flag` | network | Chaos `SET_OFFLINE` |
| `scn-restore-network` | network | `svc enable` |
| `scn-airplane-mode` | network | airplane settings + broadcast |
| `scn-network-flap` | network | wifi off/on ×3 |
| `scn-clear-token` | auth | Chaos `CLEAR_TOKEN` + relaunch |
| `scn-corrupt-token` | auth | Chaos `CORRUPT_TOKEN` |
| `scn-expire-token-foreground` | auth | Chaos expiry + relaunch |
| `scn-schedule-yesterday` | schedule | Chaos `SET_SCHEDULE_DATE` |
| `scn-schedule-tomorrow` | schedule | Chaos `SET_SCHEDULE_DATE` |
| `scn-clear-schedule` | schedule | Chaos `CLEAR_SCHEDULE` |
| `scn-restart-shipment` | shipment | Chaos `RESTART_SHIPMENT` |
| `scn-alt-api-endpoint` | auth | Chaos `SET_ALT_URL` |
| `scn-force-stop-mid-tour` | lifecycle | force-stop + Splash |
| `scn-pm-clear-cold` | lifecycle | `pm clear` |
| `scn-revoke-location` | permission | `pm revoke` location |
| `scn-revoke-camera` | permission | `pm revoke` camera |
| `scn-dump-courier-state` | diagnostic | Chaos `DUMP_STATE` |
| `scn-get-protected-key` | diagnostic | ProtectedRequestKeyReceiver |
| `scn-capture-bugreport` | diagnostic | bugreportz / device props |

## Security

- Serial whitelist: `/^[\w.:-]+$/`
- No arbitrary shell from client — only allowlisted scenario IDs
- Chaos receivers absent from production merged manifests
- Destructive scenarios require caution/destructive risk flags + UI confirm already in runner

## Verification

- Test flavor APK: DUMP_STATE / GET_DEVICE_ID return data via `am broadcast`
- Production flavor: receivers not in merged manifest
- Scenario Runner: Run produces real step stdout; mock `setInterval` gone
- Field-login orchestrator can read GET_DEVICE_ID after receiver lands
