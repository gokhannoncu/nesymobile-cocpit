# Step verification modes — result

Date: 2026-09-06  
Device: Samsung SM A346E, USB `R6CW400BC8N`  
App: `com.arasdigital.nesymobile.rstest`  
Pack: `nesy.courier@1.48.0`

## Implementation result

The editor now exposes `Business proof (strict)`, `UI check (fast)` and `Action only (unverified)` on action nodes. The selected value is compiled into each step of the matching macro group. Reduced modes prune only business-proof producers and final-oracle work; control-flow dependencies and cleanup remain.

Each reduced occurrence persists:

```json
{
  "verificationMode": "UI_CHECK",
  "verificationRole": "BUSINESS_PROOF",
  "verificationSkipped": true
}
```

The run detail presents a mixed-coverage warning. A workflow with no executed business oracle remains `NOT_EVALUATED`.

## Live runs

### Real PIN login, UI check

Run: `run_85c215a5-9ca8-4ba5-9304-86634379f11f`  
Profile: `nesy.launch.cold-real-login`  
Plan hash: `sha256:0a16188e48a1825400725ca047406cedba974184ec4c21b1b2ac8017d230d31f`

| Measurement | Result |
|---|---:|
| Total run | 5,332 ms |
| Resolve PIN | 54 ms |
| Enter PIN | 199 ms |
| Resolve submit | 27 ms |
| Tap submit + `UI.ROUTE_LIST_READY` | 4,345 ms |
| Four skipped proof occurrences, including persistence boundaries | 102 ms |
| Product verdict | `NOT_EVALUATED` |
| Evaluation failure | `NONE` |

The remaining 4.345 seconds are the product/UI transition after submit. Local PostgreSQL, APP/LOCAL queries and REMOTE validation are not on this critical path in this mode.

### Reused session, UI check

Run: `run_6fb3f62b-0bba-4740-aa9a-ce8873e41368`  
Profile: `nesy.launch.reuse-session`  
Total: 440 ms  
Product verdict: `NOT_EVALUATED`

This run proves the pruning mechanics but is not comparable with a cold real login because the launch precondition is different.

### Excluded readiness run

`run_9d777a8d-ebc2-4d51-8883-01aa118bf5dc` took 45,113 ms and stopped before the executor because the cold-login profile required the PIN screen while an existing session opened `StopListFragment`. The API process was also still serving the pre-change module. It is retained as a readiness/profile diagnostic and excluded from performance comparison.

## Last full courier run diagnosis retained

Run `run_6ef22d25-3d7b-4403-9c8a-e0635f6b80b4` completed in 159,815 ms. Its dominant step was `deliver-assert-confirmed` at 120,378 ms while waiting for remote proof. `visit-resolve-search-toggle` cost 10,691 ms because the known notification overlay was swept only after the initial target deadline.

The implementation now:

- probes handled overlays on the first mandatory target miss;
- deduplicates identical fact-key evidence references in oracle evaluations and fingerprints;
- avoids running selected proof-only work instead of making it asynchronous and letting it continue to consume the critical path.

## Verification

- Workflow contract/compiler/executor/API typechecks: passed.
- Executor package tests: 50 passed.
- Oracle engine tests: 18 passed.
- Compile/runtime wiring tests: 39 passed.
- Overlay, oracle worker, run-detail and editor source tests: passed.
- Full web typecheck still reports unrelated pre-existing errors in test-campaign and execution-queue screens; none point to the changed files.

## Remaining measurement work

A fresh full-courier dataset is required for a controlled strict versus mixed-mode A/B run. The previous shipment has already been mutated by the completed delivery, so rerunning it would compare different business state. Thirty repetitions are still required before reporting p95 or a general speedup percentage.
