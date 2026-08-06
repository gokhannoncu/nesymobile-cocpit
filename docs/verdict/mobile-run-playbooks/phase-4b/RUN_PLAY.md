# Phase M4b RUN_PLAY — Nesy App Adapter Production

```yaml
runPlayId: verdict-mobile-phase-4b-run-play
phase: "4b"
phaseName: "Nesy App Adapter Production"
status: IN_PROGRESS
recoveryState: IN_PROGRESS
createdAt: "2026-08-06 03:58:00 +03"
startedAt: "2026-08-06 18:20:00 +03"
completedAt: null
lastUpdatedAt: "2026-08-06 18:35:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:8fd5f90f991fa9576c342a946a9a276996324cf6b68f8ba64f47a8ce7c1c6d4f"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-4b/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-4a/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-4b/RESULT.md"
progressBoard: "docs/verdict/mobile-run-playbooks/PROGRESS.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
```

## 1. Amaç

Phase M4B, Nesy Mobile'daki en kritik teslimdir: mevcut automation seam'lerini
versioned Nesy Automation App Adapter altında toplamak ve Cockpit Domain Pack'in
beklediği named query / evidence / scanner / launch capability'lerini sağlamak.

İkinci paralel adapter yazılmaz. NesyCommands / NesyStateProvider / roomQueries /
structured events refactor edilir.

**Başlama:** M0 + M4A + Cockpit Phase 4B COMPLETED.

## 1.1 AI agent'a verilecek başlangıç metni

```text
Verdict Mobile Phase M4b uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/mobile-run-playbooks/phase-4b/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/mobile-run-playbooks/phase-4b/RESULT.md

Canlı board:
docs/verdict/mobile-run-playbooks/PROGRESS.md

Cockpit karşılığını oku:
docs/verdict/run-playbooks/phase-4b/RESULT.md

Recovery: RESULT recovery instruction — continue from 4b.5; first slice already landed.
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M4b` |
| Current step | `4b.5` |
| Current state | `IN_PROGRESS` |
| Last successful step | `4b.4` |
| Last attempted step | `4b.10` |
| Last update | `2026-08-06 18:35:00 +03` |
| Recovery instruction | `Slice1 done (manifest+queries+isolation markers). Continue 4b.5 entity binding → scanner/launch → evidence → recovery → full 4b.10/4b.11.` |

## 3–10

See original RUN_PLAY scope/owned paths/hard bans. Step checklist status lives in RESULT.md §5.
