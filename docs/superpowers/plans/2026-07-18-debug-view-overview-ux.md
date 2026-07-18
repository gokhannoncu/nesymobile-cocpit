# Debug View Overview UX Implementation Plan

> **For agentic workers:** Implement `overview/page.tsx` per the approved spec. Single file. No commits unless asked.

**Goal:** Neutral surfaces + status/section color only on `/debug-view/overview`.

**Spec:** `docs/superpowers/specs/2026-07-18-debug-view-overview-ux-design.md`

**File:** `apps/web/src/app/(cockpit)/debug-view/overview/page.tsx`

## Tasks

1. Add tone helpers: `latencyTone`, `batteryTone`, `appTone`, `usageBarClass`
2. Header → teal; badges neutral
3. KPI StatCards → status tones
4. Sections → blue / indigo / teal; panels → `bg-card` / gray; strip orange washes
5. Visual check at `http://localhost:4002/debug-view/overview`
