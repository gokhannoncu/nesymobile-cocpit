# User Journeys Interactive Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/product/user-journeys` into an interactive flowchart + step-detail panel for all five courier journeys, with full branch/error/external nodes and no experience curve or comparison table.

**Architecture:** Extend `DiagramElement` nodes with optional `id`. Author journey data (`diagram` + `steps` map) in a dedicated data module. New `InteractiveJourneyFlow` (selectable nodes, Feature Library visual language) and `JourneyStepPanel` compose inside a per-journey client explorer. Feature Library `FlowDiagram` stays non-interactive.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind, framer-motion, lucide-react, Vitest (data integrity tests only — no RTL in this app).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-user-journeys-interactive-flow-design.md`
- Do **not** add React Flow or other diagram libraries
- Do **not** wire click selection into Feature Library `FlowDiagram`
- Remove experience curve and ComparisonTable from this page
- All five journeys ship with complete diagram + step copy in the same delivery
- **Commits:** only when the user explicitly asks — skip commit steps otherwise; leave working tree ready for review
- Prefer English UI copy consistent with the current page
- Reuse Feature Library node variants: `start` | `process` | `decision` | `end` | `error` | `external`

## File structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/data/product/nesy-types.ts` | Add optional `id` on diagram nodes |
| `apps/web/src/data/product/diagram-utils.ts` | Collect node ids; validate journey step maps |
| `apps/web/src/data/product/diagram-utils.test.ts` | Unit tests for utils |
| `apps/web/src/data/product/user-journeys.ts` | Five `UserJourney` definitions + exports |
| `apps/web/src/data/product/user-journeys.test.ts` | Integrity: every node id ↔ steps |
| `apps/web/src/components/product/flow-diagram.tsx` | Export shared `nodeStyles` (no behavior change) |
| `apps/web/src/components/product/interactive-journey-flow.tsx` | Selectable flowchart |
| `apps/web/src/components/product/journey-step-panel.tsx` | Right-hand step detail |
| `apps/web/src/components/product/journey-explorer.tsx` | Client shell: selection state + layout |
| `apps/web/src/components/product/index.ts` | Re-export new components |
| `apps/web/src/app/(cockpit)/product/user-journeys/page.tsx` | Thin page using `USER_JOURNEYS` + `JourneyExplorer` |

---

### Task 1: Diagram node `id` + collect/validate helpers

**Files:**
- Modify: `apps/web/src/data/product/nesy-types.ts`
- Create: `apps/web/src/data/product/diagram-utils.ts`
- Create: `apps/web/src/data/product/diagram-utils.test.ts`

**Interfaces:**
- Consumes: existing `DiagramElement`
- Produces:
  - `DiagramElement` node: `{ type: 'node'; id?: string; label: string; variant: DiagramNodeVariant; desc?: string }`
  - `collectDiagramNodeIds(elements: DiagramElement[]): string[]`
  - `assertJourneyStepsComplete(diagram: DiagramElement[], steps: Record<string, unknown>): { missingInSteps: string[]; orphanSteps: string[] }`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/data/product/diagram-utils.test.ts
import { describe, expect, it } from 'vitest'
import type { DiagramElement } from './nesy-types'
import { assertJourneyStepsComplete, collectDiagramNodeIds } from './diagram-utils'

const sample: DiagramElement[] = [
  { type: 'node', id: 'start', label: 'Start', variant: 'start' },
  { type: 'arrow' },
  { type: 'node', id: 'decide', label: 'OK?', variant: 'decision' },
  {
    type: 'branch',
    yes: {
      label: 'Yes',
      steps: [{ type: 'node', id: 'ok', label: 'Done', variant: 'end' }],
    },
    no: {
      label: 'No',
      steps: [{ type: 'node', id: 'fail', label: 'Fail', variant: 'error' }],
    },
  },
]

describe('collectDiagramNodeIds', () => {
  it('walks nodes inside branches', () => {
    expect(collectDiagramNodeIds(sample).sort()).toEqual(['decide', 'fail', 'ok', 'start'])
  })

  it('skips nodes without id', () => {
    const els: DiagramElement[] = [
      { type: 'node', label: 'Legacy', variant: 'process' },
      { type: 'node', id: 'a', label: 'A', variant: 'process' },
    ]
    expect(collectDiagramNodeIds(els)).toEqual(['a'])
  })
})

describe('assertJourneyStepsComplete', () => {
  it('reports missing and orphan step keys', () => {
    const result = assertJourneyStepsComplete(sample, {
      start: {},
      decide: {},
      ok: {},
      // fail missing
      extra: {},
    })
    expect(result.missingInSteps).toEqual(['fail'])
    expect(result.orphanSteps).toEqual(['extra'])
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/web && pnpm exec vitest run src/data/product/diagram-utils.test.ts`

Expected: FAIL (module / exports missing)

- [ ] **Step 3: Extend `DiagramElement` node type**

In `nesy-types.ts`, change the node arm to:

```ts
| { type: 'node'; id?: string; label: string; variant: DiagramNodeVariant; desc?: string }
```

- [ ] **Step 4: Implement helpers**

```ts
// apps/web/src/data/product/diagram-utils.ts
import type { DiagramElement } from './nesy-types'

export function collectDiagramNodeIds(elements: DiagramElement[]): string[] {
  const ids: string[] = []
  const walk = (els: DiagramElement[]) => {
    for (const el of els) {
      if (el.type === 'node' && el.id) ids.push(el.id)
      if (el.type === 'branch') {
        walk(el.yes.steps)
        walk(el.no.steps)
      }
    }
  }
  walk(elements)
  return ids
}

export function assertJourneyStepsComplete(
  diagram: DiagramElement[],
  steps: Record<string, unknown>,
): { missingInSteps: string[]; orphanSteps: string[] } {
  const nodeIds = new Set(collectDiagramNodeIds(diagram))
  const stepKeys = new Set(Object.keys(steps))
  const missingInSteps = [...nodeIds].filter((id) => !stepKeys.has(id)).sort()
  const orphanSteps = [...stepKeys].filter((id) => !nodeIds.has(id)).sort()
  return { missingInSteps, orphanSteps }
}
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd apps/web && pnpm exec vitest run src/data/product/diagram-utils.test.ts`

Expected: PASS

- [ ] **Step 6: Commit only if user asks**

```bash
git add apps/web/src/data/product/nesy-types.ts apps/web/src/data/product/diagram-utils.ts apps/web/src/data/product/diagram-utils.test.ts
git commit -m "$(cat <<'EOF'
feat(product): add diagram node ids and journey step validators

EOF
)"
```

---

### Task 2: Journey types + empty `USER_JOURNEYS` integrity harness

**Files:**
- Create: `apps/web/src/data/product/user-journeys.ts` (types + empty array first, or stub journeys)
- Create: `apps/web/src/data/product/user-journeys.test.ts`

**Interfaces:**
- Consumes: `DiagramElement`, `Tone` from product tones (re-export or import type)
- Produces:
  - `JourneyActor = 'courier' | 'ops' | 'system' | 'external'`
  - `JourneyStepDetail` (fields per spec)
  - `UserJourney`
  - `USER_JOURNEYS: UserJourney[]`
  - `findStartNodeId(diagram: DiagramElement[]): string | undefined`

- [ ] **Step 1: Write integrity test (will fail until Task 3–7 fill data)**

```ts
// apps/web/src/data/product/user-journeys.test.ts
import { describe, expect, it } from 'vitest'
import { assertJourneyStepsComplete } from './diagram-utils'
import { USER_JOURNEYS } from './user-journeys'

describe('USER_JOURNEYS', () => {
  it('defines exactly five journeys', () => {
    expect(USER_JOURNEYS.map((j) => j.value)).toEqual([
      'tour-start',
      'delivery',
      'pickup',
      'red-label',
      'd4me',
    ])
  })

  it('has complete step maps for every diagram node id', () => {
    for (const journey of USER_JOURNEYS) {
      const { missingInSteps, orphanSteps } = assertJourneyStepsComplete(
        journey.diagram,
        journey.steps,
      )
      expect({ journey: journey.value, missingInSteps, orphanSteps }).toEqual({
        journey: journey.value,
        missingInSteps: [],
        orphanSteps: [],
      })
    }
  })

  it('every journey has a start node with an id', () => {
    for (const journey of USER_JOURNEYS) {
      const start = journey.diagram.find(
        (el) => el.type === 'node' && el.variant === 'start' && el.id,
      )
      expect(start, journey.value).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Add types + `findStartNodeId` + temporary empty export so file exists**

```ts
// apps/web/src/data/product/user-journeys.ts
import type { LucideIcon } from 'lucide-react'
import type { DiagramElement } from './nesy-types'
import type { Tone } from '@/components/product/tones'

export type JourneyActor = 'courier' | 'ops' | 'system' | 'external'

export interface JourneyStepDetail {
  title: string
  whatHappens: string
  courierGoal: string
  touchpoint: string
  experience: string
  designOpportunity: string
  nesyActive: boolean
  actor?: JourneyActor
}

export interface UserJourney {
  value: string
  label: string
  icon: LucideIcon
  tone: Tone
  purpose: string
  diagram: DiagramElement[]
  steps: Record<string, JourneyStepDetail>
}

export function findStartNodeId(diagram: DiagramElement[]): string | undefined {
  const start = diagram.find(
    (el): el is Extract<DiagramElement, { type: 'node' }> =>
      el.type === 'node' && el.variant === 'start' && Boolean(el.id),
  )
  return start?.id
}

// Filled in Tasks 3–7 — leave as [] only during Task 2 scaffolding if running tests early.
export const USER_JOURNEYS: UserJourney[] = []
```

Note: Prefer completing Tasks 3–7 in the same working session before treating the integrity test as green. Do not leave `USER_JOURNEYS = []` in the final tree.

- [ ] **Step 3: Commit only if user asks** (types + test file)

---

### Task 3: Author Tour Start journey data

**Files:**
- Modify: `apps/web/src/data/product/user-journeys.ts`

**Interfaces:**
- Produces: journey `value: 'tour-start'` appended to `USER_JOURNEYS`

- [ ] **Step 1: Add Tour Start with full diagram + steps**

Use these ids (must match `steps` keys):

`ts-route` → `ts-scan` → decision `ts-scan-complete?` → branch Incomplete (`ts-scan-missing`) / Complete → `ts-request-approval` → decision `ts-approved?` → Waiting (`ts-approval-wait`) / Approved → `ts-stops` (end)

```ts
import {
  Boxes,
  ClipboardList,
  DoorOpen,
  Lock,
  MapPin,
  Package,
  PackageCheck,
  PackageSearch,
  PenLine,
  QrCode,
  Receipt,
  Route,
  ScanLine,
  Send,
  Undo2,
  Banknote,
  CheckCircle2,
} from 'lucide-react'

// ...types above...

const tourStart: UserJourney = {
  value: 'tour-start',
  label: 'Tour Start',
  icon: ScanLine,
  tone: 'blue',
  purpose:
    'Ensure the courier starts the day with the correct route and a complete parcel set; make the approval wait visible and manage subsequently added shipments seamlessly.',
  diagram: [
    {
      type: 'node',
      id: 'ts-route',
      label: 'Selects route',
      variant: 'start',
      desc: 'Opens the assigned route',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'ts-scan',
      label: 'Scans parcels',
      variant: 'process',
      desc: 'Barcode verification of vehicle load',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'ts-scan-check',
      label: 'Load complete?',
      variant: 'decision',
    },
    {
      type: 'branch',
      yes: {
        label: 'Complete',
        steps: [
          {
            type: 'node',
            id: 'ts-request-approval',
            label: 'Requests approval',
            variant: 'process',
          },
          { type: 'arrow' },
          {
            type: 'node',
            id: 'ts-approval-check',
            label: 'Approved?',
            variant: 'decision',
          },
          {
            type: 'branch',
            yes: {
              label: 'Approved',
              steps: [
                {
                  type: 'node',
                  id: 'ts-stops',
                  label: 'Manages stops',
                  variant: 'end',
                  desc: 'Merged addresses and late adds',
                },
              ],
            },
            no: {
              label: 'Waiting',
              steps: [
                {
                  type: 'node',
                  id: 'ts-approval-wait',
                  label: 'Approval wait',
                  variant: 'external',
                  desc: 'Ops must approve tour start',
                },
              ],
            },
          },
        ],
      },
      no: {
        label: 'Missing parcels',
        steps: [
          {
            type: 'node',
            id: 'ts-scan-missing',
            label: 'Resolve missing load',
            variant: 'error',
            desc: 'Show missing count and next action',
          },
        ],
      },
    },
  ],
  steps: {
    'ts-route': {
      title: 'Route selection',
      whatHappens:
        'The courier opens the assigned route for the day and confirms vehicle and tour identity before loading.',
      courierGoal: 'Start the correct tour without errors',
      touchpoint: 'Route selection screen',
      experience: '😐 Focused',
      designOpportunity: 'Reduce wrong route risk with day/vehicle summary.',
      nesyActive: true,
      actor: 'courier',
    },
    'ts-scan': {
      title: 'Parcel scanning',
      whatHappens:
        'Shipments loaded onto the vehicle are verified by barcode so the physical load matches the system.',
      courierGoal: 'Match the physical load in the vehicle with the system',
      touchpoint: 'Barcode scanner',
      experience: '😐 Repetitive task',
      designOpportunity: 'Keep progress and missing parcel count continuously visible.',
      nesyActive: true,
      actor: 'courier',
    },
    'ts-scan-check': {
      title: 'Load complete check',
      whatHappens:
        'The app compares scanned parcels to the expected tour load and decides whether approval can be requested.',
      courierGoal: 'Know whether the vehicle is ready to request tour start',
      touchpoint: 'Scan summary',
      experience: '😐 Checkpoint',
      designOpportunity: 'Make complete vs missing states unmistakable before the next action.',
      nesyActive: true,
      actor: 'system',
    },
    'ts-scan-missing': {
      title: 'Resolve missing load',
      whatHappens:
        'Missing or unexpected parcels block a clean start; the courier must scan remaining items or escalate the mismatch.',
      courierGoal: 'Close the gap between vehicle and system before leaving',
      touchpoint: 'Missing parcel list',
      experience: '😟 Blocked',
      designOpportunity: 'Surface missing count, shipment ids, and the recovery action in one place.',
      nesyActive: true,
      actor: 'courier',
    },
    'ts-request-approval': {
      title: 'Request approval',
      whatHappens: 'Tour start is submitted for operations approval before the courier can leave the depot.',
      courierGoal: 'Obtain permission to go to the field',
      touchpoint: 'Approval request',
      experience: '😐 Submitting',
      designOpportunity: 'Confirm what was submitted (route, counts) in a single summary.',
      nesyActive: true,
      actor: 'courier',
    },
    'ts-approval-check': {
      title: 'Approval decision',
      whatHappens: 'Operations accepts the tour start or the courier remains in a waiting state.',
      courierGoal: 'Know whether the tour is cleared',
      touchpoint: 'Approval status',
      experience: '😐 Decision gate',
      designOpportunity: 'Separate approved, waiting, and rejected with clear next steps.',
      nesyActive: true,
      actor: 'system',
    },
    'ts-approval-wait': {
      title: 'Approval wait',
      whatHappens:
        'The courier waits for ops; the tour cannot proceed until the responsible role acts.',
      courierGoal: 'Understand why they are waiting and who unblocks them',
      touchpoint: 'Approval status',
      experience: '😟 Waiting',
      designOpportunity: 'Clearly show the reason for waiting and the responsible role.',
      nesyActive: true,
      actor: 'ops',
    },
    'ts-stops': {
      title: 'Stop management',
      whatHappens:
        'Same addresses are merged and newly added shipments appear in the stop list for the day plan.',
      courierGoal: 'Maintain the day plan despite changes',
      touchpoint: 'Stop list',
      experience: '🙂 Sense of control',
      designOpportunity: 'Distinguish between auto-merged and subsequently added stops.',
      nesyActive: true,
      actor: 'courier',
    },
  },
}
```

Push `tourStart` into `USER_JOURNEYS` (array will grow in later tasks).

- [ ] **Step 2: Spot-check Tour Start integrity**

Run:

```bash
cd apps/web && pnpm exec vitest run src/data/product/diagram-utils.test.ts
```

Optional temporary assert in a scratch test, or wait for full `USER_JOURNEYS` green in Task 7.

- [ ] **Step 3: Commit only if user asks**

---

### Task 4: Author Delivery journey data

**Files:**
- Modify: `apps/web/src/data/product/user-journeys.ts`

**Interfaces:**
- Produces: journey `value: 'delivery'`

- [ ] **Step 1: Add Delivery flowchart + steps**

Required path: start `dl-arrive` → `dl-collect` → `dl-fiscal` → `dl-sign` → decision `dl-outcome?` → Delivered (`dl-success` end) / Failed (`dl-failed` error)

```ts
const delivery: UserJourney = {
  value: 'delivery',
  label: 'Delivery',
  icon: PackageCheck,
  tone: 'teal',
  purpose:
    'Complete the doorstep delivery moment quickly yet fault-tolerantly through consignee verification, collection, fiscalization, and signature steps.',
  diagram: [
    {
      type: 'node',
      id: 'dl-arrive',
      label: 'Arrives at stop',
      variant: 'start',
      desc: 'Consignee and shipment check',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'dl-collect',
      label: 'Collects payment',
      variant: 'process',
      desc: 'COD / ExW when required',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'dl-fiscal',
      label: 'Generates receipt',
      variant: 'process',
      desc: 'Fiscalization in required markets',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'dl-sign',
      label: 'Captures signature',
      variant: 'process',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'dl-outcome',
      label: 'Delivery outcome?',
      variant: 'decision',
    },
    {
      type: 'branch',
      yes: {
        label: 'Delivered',
        steps: [
          {
            type: 'node',
            id: 'dl-success',
            label: 'Closes delivery',
            variant: 'end',
            desc: 'DELY + tracking update',
          },
        ],
      },
      no: {
        label: 'Failed',
        steps: [
          {
            type: 'node',
            id: 'dl-failed',
            label: 'Records failure',
            variant: 'error',
            desc: 'Reason + photo evidence',
          },
        ],
      },
    },
  ],
  steps: {
    'dl-arrive': {
      title: 'Consignee verification',
      whatHappens:
        'At the stop the courier verifies consignee and shipment information before any collection or proof capture.',
      courierGoal: 'Deliver the right shipment to the right person',
      touchpoint: 'Delivery screen',
      experience: '😐 Controlled',
      designOpportunity: 'Clearly separate pre-filled and editable fields by country.',
      nesyActive: true,
      actor: 'courier',
    },
    'dl-collect': {
      title: 'Collection',
      whatHappens:
        'COD/ExW amount is collected via cash or the country-appropriate card flow when payment is required.',
      courierGoal: 'Collect the amount safely and quickly',
      touchpoint: 'Payment method',
      experience: '😟 Critical moment',
      designOpportunity: 'Simplify Raipay, SoftPOS, and cash options by country.',
      nesyActive: true,
      actor: 'courier',
    },
    'dl-fiscal': {
      title: 'Fiscalization',
      whatHappens: 'Fiscalization is triggered in required markets so the legal receipt is generated at the right time.',
      courierGoal: 'Generate the legal receipt at the right time',
      touchpoint: 'VPFR / printer',
      experience: '😐 Waiting',
      designOpportunity: 'Make retry and cancellation paths visible on integration error.',
      nesyActive: true,
      actor: 'system',
    },
    'dl-sign': {
      title: 'Signature',
      whatHappens: 'Digital or physical proof of delivery is completed on the signature surface.',
      courierGoal: 'Complete proof of delivery',
      touchpoint: 'Signature surface',
      experience: '😐 Final check',
      designOpportunity: 'Display mandatory and optional signature status unambiguously.',
      nesyActive: true,
      actor: 'courier',
    },
    'dl-outcome': {
      title: 'Delivery outcome',
      whatHappens: 'The courier confirms success or switches into the failed-delivery path with reason capture.',
      courierGoal: 'Close the stop with the correct outcome',
      touchpoint: 'Outcome selection',
      experience: '😐 Decision',
      designOpportunity: 'Keep success and failure equally reachable without burying failure behind menus.',
      nesyActive: true,
      actor: 'courier',
    },
    'dl-success': {
      title: 'Successful delivery',
      whatHappens: 'DELY is generated and tracking interfaces are updated; the courier sees a clear success summary.',
      courierGoal: 'Close the task confidently',
      touchpoint: 'Success summary',
      experience: '😌 Completed',
      designOpportunity: 'Confirm the DELY result and collection summary on a single screen.',
      nesyActive: true,
      actor: 'system',
    },
    'dl-failed': {
      title: 'Failed delivery',
      whatHappens:
        'The correct failure reason and required photo evidence are recorded so the shipment stays operable.',
      courierGoal: 'Record the correct reason and evidence',
      touchpoint: 'Reason + photo',
      experience: '😟 Under pressure',
      designOpportunity: 'Explain photo requirements by country at the time of the action.',
      nesyActive: true,
      actor: 'courier',
    },
  },
}
```

- [ ] **Step 2: Commit only if user asks**

---

### Task 5: Author Pickup journey data

**Files:**
- Modify: `apps/web/src/data/product/user-journeys.ts`

- [ ] **Step 1: Add Pickup flowchart + steps**

Path: `pu-task` → `pu-sender` → `pu-receive` → decision `pu-success?` → Success end `pu-done` / Failure `pu-code` → `pu-reassign` (process/end)

```ts
const pickup: UserJourney = {
  value: 'pickup',
  label: 'Pickup',
  icon: PackageSearch,
  tone: 'indigo',
  purpose:
    'Keep the pickup task traceable from assignment to end of day; generate the correct code on failure and carry the task over to the next business day if needed.',
  diagram: [
    {
      type: 'node',
      id: 'pu-task',
      label: 'Receives task',
      variant: 'start',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'pu-sender',
      label: 'Reaches sender',
      variant: 'process',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'pu-receive',
      label: 'Receives parcel',
      variant: 'process',
      desc: 'Pickup + CPP when required',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'pu-outcome',
      label: 'Pickup successful?',
      variant: 'decision',
    },
    {
      type: 'branch',
      yes: {
        label: 'Success',
        steps: [
          {
            type: 'node',
            id: 'pu-done',
            label: 'Closes pickup',
            variant: 'end',
          },
        ],
      },
      no: {
        label: 'Failed',
        steps: [
          {
            type: 'node',
            id: 'pu-code',
            label: 'Codes the issue',
            variant: 'error',
          },
          { type: 'arrow' },
          {
            type: 'node',
            id: 'pu-reassign',
            label: 'Plans follow-up',
            variant: 'process',
            desc: 'Next business day when eligible',
          },
        ],
      },
    },
  ],
  steps: {
    'pu-task': {
      title: 'Task assignment',
      whatHappens: 'Pickup is created via automatic job or dispatcher assignment and appears in the day list.',
      courierGoal: "View the day's pickup tasks",
      touchpoint: 'Task list',
      experience: '😐 Planning',
      designOpportunity: 'Make the source of automatic and manual assignments visible.',
      nesyActive: true,
      actor: 'system',
    },
    'pu-sender': {
      title: 'Sender information',
      whatHappens:
        'The courier views sender and, in required markets, consignee information to reach the correct address.',
      courierGoal: 'Reach the correct address and person',
      touchpoint: 'Pickup detail',
      experience: '😐 In the field',
      designOpportunity: 'Quickly escalate missing contact information to the operations channel.',
      nesyActive: true,
      actor: 'courier',
    },
    'pu-receive': {
      title: 'Pickup + CPP',
      whatHappens: 'The parcel is received and, if applicable, CPP collection is completed in the pickup flow.',
      courierGoal: 'Collect the parcel and payment completely',
      touchpoint: 'Pickup flow',
      experience: '🙂 Progressing',
      designOpportunity: 'Show CPP scope by country only when required.',
      nesyActive: true,
      actor: 'courier',
    },
    'pu-outcome': {
      title: 'Pickup outcome',
      whatHappens: 'The courier confirms a successful pickup or enters the failure coding path.',
      courierGoal: 'Record the true result of the visit',
      touchpoint: 'Pickup result',
      experience: '😐 Decision',
      designOpportunity: 'Keep success confirmation and failure coding one tap apart.',
      nesyActive: true,
      actor: 'courier',
    },
    'pu-done': {
      title: 'Successful pickup',
      whatHappens: 'The pickup task is closed successfully and the parcel continues in the network flow.',
      courierGoal: 'Leave the stop with a closed task',
      touchpoint: 'Success summary',
      experience: '😌 Completed',
      designOpportunity: 'Show parcel and payment confirmation on one screen.',
      nesyActive: true,
      actor: 'system',
    },
    'pu-code': {
      title: 'Failure code',
      whatHappens: 'Failure reason is selected with the correct operation code so ops can act on the real cause.',
      courierGoal: 'Record the actual reason correctly',
      touchpoint: 'Reason code selection',
      experience: '😟 Decision moment',
      designOpportunity: 'Support codes with descriptions instead of technical abbreviations.',
      nesyActive: true,
      actor: 'courier',
    },
    'pu-reassign': {
      title: 'Reassignment',
      whatHappens:
        'For eligible reasons the task is planned for the next business day so it is not lost.',
      courierGoal: 'Ensure the task is not lost',
      touchpoint: 'Task result',
      experience: '🙂 Clarity',
      designOpportunity: 'Clearly show the next business day and new task status.',
      nesyActive: true,
      actor: 'system',
    },
  },
}
```

- [ ] **Step 2: Commit only if user asks**

---

### Task 6: Author Red Label journey data

**Files:**
- Modify: `apps/web/src/data/product/user-journeys.ts`

- [ ] **Step 1: Add Red Label flowchart + steps**

Path: `rl-pac` → `rl-pickup` → `rl-npoint` → `rl-shipment` → `rl-backoffice` (`external` end of enrichment)

```ts
const redLabel: UserJourney = {
  value: 'red-label',
  label: 'Red Label',
  icon: Package,
  tone: 'purple',
  purpose:
    'Pick up a physical parcel with no existing shipment record from the customer location and convert it into a trackable shipment via Npoint and backoffice.',
  diagram: [
    {
      type: 'node',
      id: 'rl-pac',
      label: 'PAC task is created',
      variant: 'start',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'rl-pickup',
      label: 'Picks up parcel',
      variant: 'process',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'rl-npoint',
      label: 'Drops at Npoint',
      variant: 'process',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'rl-shipment',
      label: 'Shipment is created',
      variant: 'process',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'rl-backoffice',
      label: 'Data is completed',
      variant: 'external',
      desc: 'Backoffice enrichment',
    },
  ],
  steps: {
    'rl-pac': {
      title: 'PAC creation',
      whatHappens: 'A pickup-at-customer task is opened for the unregistered parcel.',
      courierGoal: 'Bring the unregistered parcel into operations',
      touchpoint: 'Task list',
      experience: '😐 Uncertain start',
      designOpportunity: 'Visually distinguish the Red Label task from a standard pickup.',
      nesyActive: true,
      actor: 'system',
    },
    'rl-pickup': {
      title: 'Physical pickup',
      whatHappens: 'The red label parcel is physically picked up and the courier takes responsibility for it.',
      courierGoal: 'Take responsibility for the parcel',
      touchpoint: 'Pickup confirmation',
      experience: '😐 Careful',
      designOpportunity: 'Verify the temporary ID and physical label together.',
      nesyActive: true,
      actor: 'courier',
    },
    'rl-npoint': {
      title: 'Npoint drop-off',
      whatHappens: 'The parcel is unloaded from the vehicle at the operations point.',
      courierGoal: 'Drop the parcel at the correct operation',
      touchpoint: 'Unload screen',
      experience: '😐 Operational',
      designOpportunity: 'Clearly confirm the point and receiving unit.',
      nesyActive: true,
      actor: 'courier',
    },
    'rl-shipment': {
      title: 'Shipment creation',
      whatHappens: 'The parcel becomes a trackable shipment in the system, linked to the previous task.',
      courierGoal: 'Make the parcel trackable',
      touchpoint: 'Shipment result',
      experience: '🙂 Relief',
      designOpportunity: 'Show the new shipment ID linked to the previous task.',
      nesyActive: true,
      actor: 'system',
    },
    'rl-backoffice': {
      title: 'Backoffice completion',
      whatHappens: 'Missing fields are enriched by the backoffice after the mobile handoff.',
      courierGoal: 'Leave incomplete data to the correct team',
      touchpoint: 'Backoffice',
      experience: '🙂 In control',
      designOpportunity: 'Explain which fields will be completed later on mobile.',
      nesyActive: false,
      actor: 'external',
    },
  },
}
```

- [ ] **Step 2: Commit only if user asks**

---

### Task 7: Author D4Me journey data + turn integrity tests green

**Files:**
- Modify: `apps/web/src/data/product/user-journeys.ts`
- Verify: `apps/web/src/data/product/user-journeys.test.ts`

- [ ] **Step 1: Add D4Me flowchart + steps**

Path: `d4-reserve` → `d4-deposit` → decision `d4-picked?` → Consignee pickup `d4-dely` (end) / Timeout `d4-timeout` → `d4-locker-pickup`

```ts
const d4me: UserJourney = {
  value: 'd4me',
  label: 'D4Me Locker',
  icon: Lock,
  tone: 'orange',
  purpose:
    'Keep the D4Me integration visible from locker reservation to consignee pickup; on timeout, return the parcel to the courier flow in a controlled manner.',
  diagram: [
    {
      type: 'node',
      id: 'd4-reserve',
      label: 'Makes reservation',
      variant: 'start',
      desc: 'LCR / DDP',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'd4-deposit',
      label: 'Deposits in locker',
      variant: 'process',
      desc: 'DEPT callback',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'd4-pickup-check',
      label: 'Picked up in time?',
      variant: 'decision',
    },
    {
      type: 'branch',
      yes: {
        label: 'Consignee pickup',
        steps: [
          {
            type: 'node',
            id: 'd4-dely',
            label: 'Consignee picks up',
            variant: 'end',
            desc: 'DELY callback',
          },
        ],
      },
      no: {
        label: 'Timeout',
        steps: [
          {
            type: 'node',
            id: 'd4-timeout',
            label: 'Timeout path',
            variant: 'error',
          },
          { type: 'arrow' },
          {
            type: 'node',
            id: 'd4-locker-pickup',
            label: 'Manages locker pickup',
            variant: 'process',
            desc: 'COPT on retrieval',
          },
        ],
      },
    },
  ],
  steps: {
    'd4-reserve': {
      title: 'LCR / DDP',
      whatHappens: 'Courier or consignee creates an LCR/DDP locker reservation.',
      courierGoal: 'Reserve a suitable locker',
      touchpoint: 'Reservation screen',
      experience: '😐 Making a choice',
      designOpportunity: 'Hide the Legacy ID conversion from the user and show the result clearly.',
      nesyActive: true,
      actor: 'courier',
    },
    'd4-deposit': {
      title: 'Locker drop-off',
      whatHappens: 'Parcel is placed in the locker and the DEPT callback is processed before completion is shown.',
      courierGoal: 'Place the right parcel in the right compartment',
      touchpoint: 'D4Me guidance',
      experience: '🙂 Progressing',
      designOpportunity: 'Do not show the operation as completed until the callback arrives.',
      nesyActive: true,
      actor: 'courier',
    },
    'd4-pickup-check': {
      title: 'Pickup window',
      whatHappens: 'The system waits for timely consignee pickup or escalates into the timeout path.',
      courierGoal: 'Know whether the locker delivery closed itself',
      touchpoint: 'D4Me status',
      experience: '😐 Waiting on consignee',
      designOpportunity: 'Show remaining pickup window and what happens on expiry.',
      nesyActive: true,
      actor: 'system',
    },
    'd4-dely': {
      title: 'Consignee pickup',
      whatHappens: 'Timely pickup is closed with the DELY callback and tracking updates.',
      courierGoal: 'Close the delivery automatically',
      touchpoint: 'D4Me callback',
      experience: '😌 Completed',
      designOpportunity: 'Reflect the DELY result on tracking screens without delay.',
      nesyActive: true,
      actor: 'external',
    },
    'd4-timeout': {
      title: 'Timeout',
      whatHappens: 'The pickup window expires and the parcel must return to a controlled courier retrieval flow.',
      courierGoal: 'Retrieve the parcel without losing it',
      touchpoint: 'Timeout signal',
      experience: '😟 Exception',
      designOpportunity: 'Explain timeout reason and the created follow-up task immediately.',
      nesyActive: true,
      actor: 'system',
    },
    'd4-locker-pickup': {
      title: 'Locker pickup task',
      whatHappens: 'A locker pickup task is created; COPT is generated upon courier retrieval.',
      courierGoal: 'Complete retrieval with the correct event',
      touchpoint: 'Locker pickup task',
      experience: '😟 Exception',
      designOpportunity: 'Show the new task reason, deadline, and locker location together.',
      nesyActive: true,
      actor: 'courier',
    },
  },
}

export const USER_JOURNEYS: UserJourney[] = [
  tourStart,
  delivery,
  pickup,
  redLabel,
  d4me,
]
```

- [ ] **Step 2: Run integrity tests — expect PASS**

Run: `cd apps/web && pnpm exec vitest run src/data/product/user-journeys.test.ts src/data/product/diagram-utils.test.ts`

Expected: all PASS

- [ ] **Step 3: Commit only if user asks**

---

### Task 8: Export shared node styles from `FlowDiagram`

**Files:**
- Modify: `apps/web/src/components/product/flow-diagram.tsx`

**Interfaces:**
- Produces: exported `flowNodeStyles` (rename of internal `nodeStyles` or `export { nodeStyles as flowNodeStyles }`)

- [ ] **Step 1: Export styles without changing rendering**

Change:

```ts
const nodeStyles: Record<...> = { ... }
```

to:

```ts
export const flowNodeStyles: Record<
  DiagramNodeVariant,
  { bg: string; border: string; text: string; icon: typeof Cog; iconBg: string }
> = { /* same values as current nodeStyles */ }
```

Replace internal references `nodeStyles` → `flowNodeStyles`.

- [ ] **Step 2: Smoke typecheck Feature Library still compiles**

Run: `cd apps/web && pnpm typecheck`

Expected: no errors related to `flow-diagram`

- [ ] **Step 3: Commit only if user asks**

---

### Task 9: Build `InteractiveJourneyFlow`

**Files:**
- Create: `apps/web/src/components/product/interactive-journey-flow.tsx`
- Modify: `apps/web/src/components/product/index.ts`

**Interfaces:**
- Consumes: `DiagramElement`, `Tone`, `flowNodeStyles`, `EASE` from tones
- Produces:

```ts
export function InteractiveJourneyFlow(props: {
  elements: DiagramElement[]
  tone?: Tone
  selectedId: string | null
  onSelect: (id: string) => void
  className?: string
}): JSX.Element
```

- [ ] **Step 1: Implement selectable flow**

Requirements:

- Mirror `FlowDiagram` layout (column of nodes, arrows, two-column branches)
- Only elements with `type === 'node' && id` are `<button type="button">`
- Selected: ring / stronger border + `scale-[1.02]`; `aria-pressed={selected}`
- Nodes without `id` render as non-interactive (should not appear in journey data)
- `framer-motion`: stagger children on mount (`staggerChildren: 0.06`)
- Import `flowNodeStyles` from `./flow-diagram`

Skeleton:

```tsx
'use client'

import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type { DiagramElement, DiagramNodeVariant } from '@/data/product/nesy-types'
import { flowNodeStyles } from './flow-diagram'
import { EASE, type Tone } from './tones'

export function InteractiveJourneyFlow({
  elements,
  selectedId,
  onSelect,
  className,
}: {
  elements: DiagramElement[]
  tone?: Tone
  selectedId: string | null
  onSelect: (id: string) => void
  className?: string
}) {
  return (
    <motion.div
      className={cn('flex w-full flex-col items-center', className)}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      {elements.map((el, i) => (
        <InteractiveElement
          key={i}
          element={el}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </motion.div>
  )
}

// InteractiveElement / InteractiveNode / InteractiveBranch —
// copy structure from flow-diagram.tsx FlowElement/FlowBranch,
// but nodes with id call onSelect and show selected styles.
```

Selected node classes (add on top of variant styles):

```ts
cn(
  selected && 'ring-2 ring-offset-2 ring-nesy scale-[1.02] shadow-md',
  id && 'cursor-pointer text-left',
)
```

- [ ] **Step 2: Export from `index.ts`**

```ts
export * from './interactive-journey-flow'
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm typecheck`

Expected: PASS for new file

- [ ] **Step 4: Commit only if user asks**

---

### Task 10: Build `JourneyStepPanel` + `JourneyExplorer`

**Files:**
- Create: `apps/web/src/components/product/journey-step-panel.tsx`
- Create: `apps/web/src/components/product/journey-explorer.tsx`
- Modify: `apps/web/src/components/product/index.ts`

**Interfaces:**
- Consumes: `UserJourney`, `JourneyStepDetail`, `findStartNodeId`, `InteractiveJourneyFlow`
- Produces:

```ts
export function JourneyStepPanel(props: {
  step: JourneyStepDetail
  tone: Tone
}): JSX.Element

export function JourneyExplorer(props: {
  journey: UserJourney
}): JSX.Element
```

- [ ] **Step 1: Implement panel**

Show: title, whatHappens, courierGoal, touchpoint, experience, designOpportunity, nesyActive badge, optional actor chip. Use `AnimatePresence` + `motion.div` with `key={step.title}` for fade/slide.

```tsx
'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Lightbulb, MapPin, Target } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type { JourneyStepDetail } from '@/data/product/user-journeys'
import { EASE, type Tone, toneIconBox, toneText } from './tones'

export function JourneyStepPanel({ step, tone }: { step: JourneyStepDetail; tone: Tone }) {
  return (
    <section aria-label="Step detail" className="rounded-2xl border border-border bg-background p-4 lg:p-5">
      <AnimatePresence mode="wait">
        <motion.div
          key={step.title}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="space-y-4"
        >
          {/* header: title + badges */}
          {/* whatHappens lead */}
          {/* grid of goal / touchpoint / experience */}
          {/* design opportunity callout using toneIconBox[tone] */}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
```

- [ ] **Step 2: Implement explorer**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  findStartNodeId,
  type UserJourney,
} from '@/data/product/user-journeys'
import { Callout } from './blocks' // or wherever Callout lives — use existing product Callout import path
import { InteractiveJourneyFlow } from './interactive-journey-flow'
import { JourneyStepPanel } from './journey-step-panel'

export function JourneyExplorer({ journey }: { journey: UserJourney }) {
  const startId = useMemo(() => findStartNodeId(journey.diagram), [journey.diagram])
  const [selectedId, setSelectedId] = useState<string | null>(startId ?? null)

  useEffect(() => {
    setSelectedId(findStartNodeId(journey.diagram) ?? null)
  }, [journey.value, journey.diagram])

  const step = selectedId ? journey.steps[selectedId] : undefined

  return (
    <div className="space-y-4">
      <Callout icon={journey.icon} title="Journey purpose" tone={journey.tone}>
        {journey.purpose}
      </Callout>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)]">
        <div className="overflow-x-auto rounded-2xl border border-border bg-background p-4 lg:p-5">
          <InteractiveJourneyFlow
            elements={journey.diagram}
            tone={journey.tone}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div>
          {step ? (
            <JourneyStepPanel step={step} tone={journey.tone} />
          ) : (
            <p className="text-sm text-muted-foreground">Select a step in the flow.</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

On mobile, columns stack automatically via single-column grid below `lg`. Optional: `scrollIntoView` on the panel when `selectedId` changes and `window.matchMedia('(max-width: 1023px)')` matches.

- [ ] **Step 3: Export both from `index.ts`**

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && pnpm typecheck`

- [ ] **Step 5: Commit only if user asks**

---

### Task 11: Rewire User Journeys page

**Files:**
- Modify: `apps/web/src/app/(cockpit)/product/user-journeys/page.tsx`

**Interfaces:**
- Consumes: `USER_JOURNEYS`, `JourneyExplorer`, existing `HeroCallout` / `Callout` / `SegmentTabs` / `ProductPage`

- [ ] **Step 1: Replace page body**

Remove inline `JOURNEYS` constant, `JourneyMap`, `ComparisonTable`. Keep hero + matrix callout. Update hero lead/chips to reflect interactive flow (remove “Experience curve” chip).

```tsx
'use client'

import { Footprints, Map } from 'lucide-react'
import {
  Callout,
  HeroCallout,
  JourneyExplorer,
  ProductPage,
  SegmentTabs,
} from '@/components/product'
import { USER_JOURNEYS } from '@/data/product/user-journeys'

export default function UserJourneysPage() {
  return (
    <ProductPage path="/product/user-journeys">
      <HeroCallout
        icon={Footprints}
        eyebrow="Users & Field Experience · Journeys"
        tone="orange"
        title="What journeys does the courier experience in the field?"
        lead="This page maps the screen and decision-level journeys of Nesy Mobile as interactive flows: select a step to see what happens, what the courier is trying to complete, and where design can recover friction."
        chips={['5 journeys', 'Interactive flow', 'Decision branches', 'Step-level detail']}
      />

      <Callout icon={Map} title="Journey ≠ Country Matrix" tone="orange">
        <b>User Journey</b> describes the screens and decision moments the courier goes through while completing a task.{' '}
        <b>Country Matrix</b> holds the exact behavior of the same step across countries. This page explains the experience;
        the matrix explains the operational truth; in case of conflict, the matrix is the source of record.
      </Callout>

      <SegmentTabs
        variant="button"
        items={USER_JOURNEYS.map((journey) => ({
          value: journey.value,
          label: journey.label,
          icon: journey.icon,
          content: <JourneyExplorer journey={journey} />,
        }))}
      />
    </ProductPage>
  )
}
```

Confirm `Callout` import path matches existing product exports (`blocks` via `@/components/product`).

- [ ] **Step 2: Typecheck + unit tests**

```bash
cd apps/web && pnpm exec vitest run src/data/product/user-journeys.test.ts src/data/product/diagram-utils.test.ts
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Manual QA checklist**

- [ ] Tour Start: start selected; click Waiting / Missing parcels / Manages stops — panel updates
- [ ] Delivery: Failed branch shows reason/photo step
- [ ] Pickup: Failed → Codes the issue → Plans follow-up
- [ ] Red Label: Data is completed shows `nesyActive: false` / external actor
- [ ] D4Me: Timeout arm vs Consignee pickup
- [ ] Narrow viewport: stacked layout readable
- [ ] Open any Feature Library feature with a diagram — still non-click, still renders

- [ ] **Step 4: Commit only if user asks**

```bash
git add apps/web/src/app/(cockpit)/product/user-journeys/page.tsx \
  apps/web/src/components/product/interactive-journey-flow.tsx \
  apps/web/src/components/product/journey-step-panel.tsx \
  apps/web/src/components/product/journey-explorer.tsx \
  apps/web/src/components/product/flow-diagram.tsx \
  apps/web/src/components/product/index.ts \
  apps/web/src/data/product/
git commit -m "$(cat <<'EOF'
feat(product): interactive user journey flows with step detail panel

EOF
)"
```

---

## Spec coverage check

| Spec requirement | Task |
| --- | --- |
| Interactive left flow + right panel | 9, 10, 11 |
| Full flowchart variants + branches | 3–7 |
| Remove curve + table | 11 |
| All five journeys complete | 3–7 + integrity test |
| Optional node `id`, Feature Library unchanged | 1, 8, 11 QA |
| Data module + step fields | 2–7, 10 |
| framer-motion stagger / panel transition | 9, 10 |
| a11y buttons / aria / panel label | 9, 10 |
| No React Flow / no FlowDiagram click overload | Global + 8, 9 |
| JourneyMap unused cleanup deferred | Non-goal — no task |

## Placeholder / consistency review

- No TBD steps; journey ids and copy are specified per journey
- `flowNodeStyles` name used consistently in Tasks 8–9
- `findStartNodeId` / `JourneyExplorer` / `USER_JOURNEYS` names consistent
- Commit steps gated on explicit user approval
`)