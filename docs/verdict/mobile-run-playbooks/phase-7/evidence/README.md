# M7 evidence pack (Mobile)

Honest packaging for Mobile Phase M7. This pack does **not** claim full Field
Login / Load Tour / process-kill DUT acceptance.

## Device snapshot (2026-08-09)

| Field | Value |
|---|---|
| serial | `R6CW400BC8N` |
| model | SM-A346E |
| `ro.build.type` | `user` |
| `ro.debuggable` | `0` |
| installed | `com.arasdigital.nesymobile.rstest` (+ `.test`) |
| CP3-DUT (userdebug/eng) | **NOT cleared** |

## Offline / host evidence

| Artifact | Result |
|---|---|
| `NesyM7AcceptanceMatrixTest` | PASS (scanner / recovery / isolation ops) |
| `assembleTstrsAutomationRelease` | PASS → APK scanned |
| `scripts/assert-release-isolation-apk.sh … true` | PASS (SDK + setup markers present) |
| `assembleTstrsRelease` | **BLOCKED_LOCAL** — `SigningConfig.release` missing `storeFile` |
| Production DEX negative scan | **BLOCKED_LOCAL** (no signed release APK) |
| `SdkAbsenceTest` on DUT `tstrsDebug` | PASS (`targetApkMatchesPhysicalSdkBoundary`, SM-A346E) |

## DUT-blocked (not claimed)

- Live Field Login / Load Tour / courier slice with Bridge evidence
- Hardware/camera REAL scan origin on-device stream proof
- Process-kill → `nesy.recovery.*` before/after observation
- Connected `SdkAbsenceTest` on release target
- Cockpit Phase 7 joint DUT fixture packaging (Cockpit P7 still NOT_STARTED)

## Commands

```bash
# Unit matrix
cd NesyMobile && ./gradlew :app:testTstrsDebugUnitTest \
  --tests com.arasdigital.nesymobile.verdict.NesyM7AcceptanceMatrixTest

# Automation APK positive isolation scan
./gradlew :app:assembleTstrsAutomationRelease
./scripts/assert-release-isolation-apk.sh \
  app/build/outputs/apk/tstrs/automationRelease/*.apk true

# Release negative scan (requires local storeFile)
./gradlew :app:assembleTstrsRelease
./scripts/assert-release-isolation-apk.sh \
  app/build/outputs/apk/tstrs/release/*.apk false
```
