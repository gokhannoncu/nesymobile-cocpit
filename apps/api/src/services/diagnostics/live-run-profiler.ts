/**
 * Diagnostic hooks only: inactive unless explicitly armed. Wraps real methods,
 * not synthetic ActionTransition timestamps. Does not alter decisions or retry.
 */
import { BridgeFlowExecutor } from '@nesy/bridgeflow-executor'
import { writeFileSync } from 'node:fs'
import { BridgeClient } from '@nesy/bridge-client'
import { BridgeFlowExecutionQueue } from '../bridgeflow-execution-queue.js'
import { PrismaExecutionPersistence } from '../bridgeflow-prisma-persistence.js'
import { BridgeDeviceManager } from '../bridge-device-manager.js'
import { OracleEvaluationWorker } from '../oracle-evaluation-worker.js'
import { profileActive, profileAsync, profilePrisma, profileRun, type ProfileAttrs } from './live-profile-recorder.js'

const wrapped = new WeakSet<object>()
function wrap(target: any, method: string, name: string, attrs: (args: any[]) => ProfileAttrs = () => ({})) {
  const original = target[method]
  if (typeof original !== 'function') throw new Error('Profiler hook missing: ' + method)
  target[method] = function(this: any, ...args: any[]) {
    if (!profileActive()) return original.apply(this, args)
    return profileAsync(name, attrs(args), () => original.apply(this, args))
  }
}
const stepAttrs = (args: any[]) => ({ stepId: args[1]?.planStepId, kind: args[1]?.kind })

// Every executor's runtime ports carry the true action/query/remote boundaries.
const execute = BridgeFlowExecutor.prototype.execute
BridgeFlowExecutor.prototype.execute = function(this: any, input: any) {
  if (profileActive() && !wrapped.has(this)) {
    wrapped.add(this)
    const o = this.options
    for (const [key, methods] of Object.entries({
      bridge: ['act', 'waitAny'], genericSteps: ['execute'], remoteRuntime: ['execute'],
    })) {
      if (!o[key]) continue
      const port = Object.create(o[key])
      for (const method of methods) if (typeof o[key][method] === 'function') {
        const original = o[key][method].bind(o[key])
        port[method] = (...args: any[]) => profileAsync('port.' + key + '.' + method,
          { stepId: args[0]?.planStepId, kind: args[0]?.kind,
            operation: args[0]?.params?.spec?.operationRef ?? args[0]?.params?.queryRef },
          () => original(...args))
      }
      o[key] = port
    }
  }
  return execute.call(this, input)
}
wrap(BridgeFlowExecutor.prototype, 'executeStep', 'executor.step', stepAttrs)
wrap(BridgeFlowExecutor.prototype, 'executeBridgeAction', 'executor.action', stepAttrs)
wrap(BridgeFlowExecutor.prototype, 'assertLiveFence', 'executor.fence')

for (const name of Object.getOwnPropertyNames(PrismaExecutionPersistence.prototype)) {
  if (name === 'constructor' || !/^(persist|loadOracle|withFence|assertFence$|lockFenceRow$|assertExecution)/.test(name)) continue
  wrap(PrismaExecutionPersistence.prototype, name, 'persistence.' + name, args => ({
    phase: args[0]?.transition?.phase, lifecycle: args[0]?.outcome?.actionResult,
    stepId: args[0]?.planStepId,
  }))
}
const start = PrismaExecutionPersistence.prototype.persistRunStart
PrismaExecutionPersistence.prototype.persistRunStart = function(this: any, input: any) {
  if (profileActive() && !wrapped.has(this)) { wrapped.add(this); this.client = profilePrisma(this.client) }
  return start.call(this, input)
}
wrap(BridgeDeviceManager.prototype, 'submit', 'bridge.admission_and_request', args => ({ command: args[0] }))
wrap(BridgeClient.prototype, 'send', 'bridge.client_request', args => ({
  command: args[0]?.command, requestId: args[0]?.requestId,
}))
wrap(OracleEvaluationWorker.prototype, 'runContinueGate', 'oracle.continue_gate')
wrap(OracleEvaluationWorker.prototype, 'runFinalOracle', 'oracle.final')
const run = (BridgeFlowExecutionQueue.prototype as any).execute
;(BridgeFlowExecutionQueue.prototype as any).execute = function(this: any, item: any) {
  return profileRun(item, () => run.call(this, item))
}
// The runner checks this PID against the listening API before touching a device.
try {
  writeFileSync('/tmp/nesy-live-profile-installed.json', JSON.stringify({
    pid: process.pid, installedAt: new Date().toISOString(), schemaVersion: 1,
  }), { mode: 0o600 })
} catch { /* A status marker is diagnostic only. */ }
