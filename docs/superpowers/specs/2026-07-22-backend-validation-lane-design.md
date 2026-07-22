# Backend Validation Lane — Canvas Visibility + Run Result

**Date:** 2026-07-22  
**Status:** Approved for implementation (no commit required)  
**App:** NesyMobileCocpit automation editor

## Problem

Backend validations (EventTower checks, VALIDATE_STOPLIST / server-steps, oracle backend signals) already run during automation, but they are invisible on the workflow canvas and underrepresented on Run Result (no dedicated request/response view).

## Goals

1. Show an auto-derived, read-only **Backend Validations** lane on the canvas, visually separate from the courier flow (no edges into courier graph).
2. During Run Test, after Maestro completes, show the same progress UX (spinner + progress bar) on backend lane nodes.
3. Add a **Backend** tab on Run Result with per-step request/response and verdict.

## Non-goals

- Graylog / Mongo validation nodes
- Manual palette placement of backend nodes
- Persisting backend lane nodes into draft/publish graph
- Wiring edges between courier and backend lanes

## Decisions

| Topic | Choice |
| --- | --- |
| Validation sources | Existing automatic checks only (EventTower, server-steps, oracle backend) |
| Node creation | Auto-derived from courier graph |
| Run timing | Backend lane progress after Maestro (post-UI phase) |
| Run Result | New **Backend** tab |
| Canvas approach | Separate derived lane (not persisted) |

## Architecture

```
Courier graph (persisted)
        │ derive
        ▼
Backend lane (ephemeral UI nodes)
        │
Run: Maestro (courier progress)
        │ exit 0
        ▼
Backend phase → WorkflowStepResult per backend check
        │ poll /status
        ▼
Lane progress + Run Result Backend tab (HTTP capture)
```

### Derive rules

- Nodes with `verifyBackend` or default oracle requiring `backend` → EventTower / backend-check lane node
- `VALIDATE_STOPLIST` (+ TOUR_APPROVE / EOD_APPROVE if present) → server-step lane node
- Empty → placeholder “No backend validations in this flow”

### Progress

- Phase 1: courier nodes update as today; backend lane stays `pending`
- Phase 2: after Maestro success, backend steps run sequentially with `running` → success/fail and canvas progress bar
- Failures follow existing oracle/server-step fail rules

### Run Result — Backend tab

Tabs: Summary | Parameters | Logs | **Backend** | Video | Spans

Per step: status, duration, source action, request(s) (method/URL/masked headers/body summary), response (status/body summary), verdict.

## Out of scope follow-ups

Graylog/Mongo canvas integration; editable backend lane.
