# Step verification modes — run playbook

Date: 2026-09-06

## Purpose

Verify that an editor choice changes the compiled plan and runtime behavior without weakening unselected workflow groups.

## Modes

| Editor value | Runtime behavior | Product verdict |
|---|---|---|
| `BUSINESS_PROOF` | Existing gates, APP/LOCAL/REMOTE producers and final oracle | Existing behavior |
| `UI_CHECK` | Actions and UI facts run; business-only producers/oracle are skipped | Only remaining business-proof groups may contribute |
| `ACTION_ONLY` | Required control-flow/action steps run; post-action proof is not required | No verdict from this group |

An omitted value is `BUSINESS_PROOF`. This preserves existing saved workflows and their plan hashes.

## USB smoke procedure

1. Confirm API on port 4001 and the USB device with `adb devices -l`.
2. Compile `nesy.workflow.login` with `AUTH_LOGIN.data.config.verificationMode=UI_CHECK` against the pinned published pack.
3. Confirm its plan hash differs from the strict compile.
4. Run once with `nesy.launch.reuse-session` to verify proof-only pruning.
5. Run once with `nesy.launch.cold-real-login` from a logged-out state to exercise PIN entry and the UI gate.
6. Read `/api/verdict/runtime/runs/:runId` and verify:
   - every affected occurrence has verification metadata;
   - APP/LOCAL/REMOTE producers and final assert are `SKIPPED`;
   - the run does not invent `PASS_ONLINE` when no business oracle ran;
   - cleanup still executes.

## Acceptance checks

- Strict and reduced plans have different deterministic hashes.
- A reduced login group does not alter route/delivery groups in the full workflow.
- `UI_CHECK` still requires a UI continue gate when the pack provides UI facts.
- `ACTION_ONLY` accepts a completed gesture without claiming its effect was verified.
- `UNKNOWN_EFFECT`, bridge refusal, cleanup, recovery fence and cancellation behavior remain unchanged.
- Repeated observations of one fact produce one evidence reference and do not create decision changes by list growth.
- A mandatory target miss probes known dismissible overlays before spending the full target deadline.

