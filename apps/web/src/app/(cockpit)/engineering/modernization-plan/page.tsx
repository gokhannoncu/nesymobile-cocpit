'use client'

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  XCircle,
} from 'lucide-react'
import { ProductPage } from '@/components/product'

/* ---------------------------------------------------------------------------
 * Types
 * --------------------------------------------------------------------------- */

type CheckpointStatus = 'PASSED' | 'PASSED_WITH_EXTERNAL_BLOCKERS' | 'BLOCKED' | 'NOT_EVALUATED'
type EvidenceStatus = 'PASS' | 'FAIL' | 'BLOCKED_EXTERNAL' | 'DEFERRED_WITH_REASON' | 'PENDING'

interface CheckpointEvidence {
  id: string
  label: string
  status: EvidenceStatus
  evidence?: string
  deferReason?: string
}

interface PhaseCheckpoint {
  phase: number
  name: string
  status: CheckpointStatus
  completedAt?: string
  evidenceItems: CheckpointEvidence[]
}

/* ---------------------------------------------------------------------------
 * Data — Verdict Phase Checkpoints (static snapshot, future: API-driven)
 * --------------------------------------------------------------------------- */

const PHASE_CHECKPOINTS: PhaseCheckpoint[] = [
  {
    phase: 4,
    name: 'Phase 4A: WorkflowIR v2 + Condition Engine',
    status: 'PASSED',
    completedAt: '2026-08-05',
    evidenceItems: [
      { id: 'cp4a-1', label: 'WorkflowIR v2 contract published', status: 'PASS', evidence: 'packages/workflow-contract' },
      { id: 'cp4a-2', label: 'Condition Engine tests green', status: 'PASS', evidence: 'pnpm test' },
    ],
  },
  {
    phase: 4.2,
    name: 'Phase 4B: Domain Pack Contracts',
    status: 'PASSED',
    completedAt: '2026-08-05',
    evidenceItems: [
      { id: 'cp4b-1', label: 'Domain Pack contract published', status: 'PASS', evidence: 'packages/domain-pack-contracts' },
      { id: 'cp4b-2', label: 'Nesy Courier reference pack', status: 'PASS', evidence: 'domain-packs/nesy-courier' },
    ],
  },
  {
    phase: 4.3,
    name: 'Phase 4C: BridgeFlowCompiler',
    status: 'PASSED',
    completedAt: '2026-08-05',
    evidenceItems: [
      { id: 'cp4c-1', label: 'BridgeFlowPlan output available', status: 'PASS', evidence: 'packages/bridgeflow-compiler' },
      { id: 'cp4c-2', label: 'Compiler provenance/hash chain', status: 'PASS' },
    ],
  },
  {
    phase: 5,
    name: 'Phase 5: BridgeFlowExecutor + Oracle v2 + Persistence',
    status: 'PASSED_WITH_EXTERNAL_BLOCKERS',
    completedAt: '2026-08-05',
    evidenceItems: [
      { id: 'cp5-1', label: 'Executor graph traversal/fences/recovery', status: 'PASS' },
      { id: 'cp5-2', label: 'Evidence Journey writer/classifier', status: 'PASS' },
      { id: 'cp5-3', label: 'Oracle evaluation worker', status: 'PASS' },
      { id: 'cp5-4', label: 'Phase 6 input APIs available', status: 'PASS' },
      { id: 'cp5-5', label: 'Real DUT acceptance', status: 'BLOCKED_EXTERNAL', evidence: 'CP3-DUT' },
      { id: 'cp5-6', label: 'PostgreSQL migration applied', status: 'BLOCKED_EXTERNAL', evidence: 'B-4-PG-MIGRATION-APPLY' },
    ],
  },
  {
    phase: 6,
    name: 'Phase 6: Cockpit UI + Route Cutover + Live Inspector',
    status: 'NOT_EVALUATED',
    evidenceItems: [
      { id: 'cp6-1', label: 'PageMigrationManifest covers all routes', status: 'PENDING' },
      { id: 'cp6-2', label: 'Domain Pack UI functional', status: 'PENDING' },
      { id: 'cp6-3', label: 'Live Inspector operational', status: 'PENDING' },
      { id: 'cp6-4', label: 'Run Detail Evidence Journey', status: 'PENDING' },
      { id: 'cp6-5', label: 'Test Profile/Campaign UI', status: 'PENDING' },
      { id: 'cp6-6', label: 'Legacy-zero checks green', status: 'PENDING' },
    ],
  },
]

/* ---------------------------------------------------------------------------
 * Status helpers
 * --------------------------------------------------------------------------- */

const STATUS_CONFIG: Record<CheckpointStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  PASSED: { label: 'Passed', color: 'text-emerald-500', icon: CheckCircle2 },
  PASSED_WITH_EXTERNAL_BLOCKERS: { label: 'Passed (External Blockers)', color: 'text-amber-500', icon: AlertTriangle },
  BLOCKED: { label: 'Blocked', color: 'text-red-500', icon: XCircle },
  NOT_EVALUATED: { label: 'Not Evaluated', color: 'text-slate-400', icon: Clock },
}

const EVIDENCE_STATUS_CONFIG: Record<EvidenceStatus, { label: string; color: string; bg: string }> = {
  PASS: { label: 'PASS', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  FAIL: { label: 'FAIL', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  BLOCKED_EXTERNAL: { label: 'BLOCKED (External)', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  DEFERRED_WITH_REASON: { label: 'DEFERRED', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  PENDING: { label: 'PENDING', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
}

/* ---------------------------------------------------------------------------
 * Component
 * --------------------------------------------------------------------------- */

export default function ModernizationPlanPage() {
  const totalItems = PHASE_CHECKPOINTS.reduce((sum, cp) => sum + cp.evidenceItems.length, 0)
  const passedItems = PHASE_CHECKPOINTS.reduce(
    (sum, cp) => sum + cp.evidenceItems.filter((e) => e.status === 'PASS').length,
    0,
  )
  const blockedItems = PHASE_CHECKPOINTS.reduce(
    (sum, cp) => sum + cp.evidenceItems.filter((e) => e.status === 'BLOCKED_EXTERNAL').length,
    0,
  )
  const pendingItems = PHASE_CHECKPOINTS.reduce(
    (sum, cp) => sum + cp.evidenceItems.filter((e) => e.status === 'PENDING').length,
    0,
  )

  return (
    <ProductPage path="/engineering/modernization-plan">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
            <Activity className="size-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Verdict Modernization
            </p>
            <h1 className="text-xl font-semibold text-slate-900">
              Checkpoint & Evidence Dashboard
            </h1>
          </div>
        </div>
        <p className="text-sm text-slate-600 max-w-2xl">
          Verdict Cockpit SDK Bridge modernization progress. Her checkpoint
          kanıt bazlı onay gerektirir; external blocker'lar açık olarak
          izlenir.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Items</p>
          <p className="text-2xl font-bold text-slate-900">{totalItems}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium text-emerald-600">Passed</p>
          <p className="text-2xl font-bold text-emerald-700">{passedItems}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-600">External Blocked</p>
          <p className="text-2xl font-bold text-amber-700">{blockedItems}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-500">Pending</p>
          <p className="text-2xl font-bold text-slate-600">{pendingItems}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Overall Progress</span>
          <span>{Math.round((passedItems / totalItems) * 100)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
            style={{ width: `${(passedItems / totalItems) * 100}%` }}
          />
        </div>
      </div>

      {/* Checkpoint timeline */}
      <div className="space-y-6">
        {PHASE_CHECKPOINTS.map((checkpoint) => {
          const config = STATUS_CONFIG[checkpoint.status]
          const StatusIcon = config.icon
          return (
            <div
              key={checkpoint.phase}
              className="rounded-lg border border-slate-200 bg-white overflow-hidden"
            >
              {/* Checkpoint header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <StatusIcon className={`size-5 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {checkpoint.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-xs font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    {checkpoint.completedAt && (
                      <span className="text-xs text-slate-400">
                        Completed: {checkpoint.completedAt}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-slate-400 tabular-nums">
                  {checkpoint.evidenceItems.filter((e) => e.status === 'PASS').length}/{checkpoint.evidenceItems.length}
                </span>
              </div>

              {/* Evidence items */}
              <div className="divide-y divide-slate-50">
                {checkpoint.evidenceItems.map((item) => {
                  const eConfig = EVIDENCE_STATUS_CONFIG[item.status]
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${eConfig.bg} ${eConfig.color}`}
                      >
                        {eConfig.label}
                      </span>
                      <span className="flex-1 text-sm text-slate-700">
                        {item.label}
                      </span>
                      {item.evidence && (
                        <span className="text-xs text-slate-400 font-mono truncate max-w-[200px]">
                          {item.evidence}
                        </span>
                      )}
                      {item.deferReason && (
                        <span className="text-xs text-blue-500 truncate max-w-[200px]">
                          {item.deferReason}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </ProductPage>
  )
}
