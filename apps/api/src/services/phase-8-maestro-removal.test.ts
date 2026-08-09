import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

describe('Phase 8 API Maestro removal', () => {
  it('removes the runnable legacy executor/compiler files', () => {
    for (const relativePath of [
      'services/maestro-executor.ts',
      'services/workflow-runner.ts',
      'services/yaml-generator.ts',
    ]) {
      expect(existsSync(join(ROOT, relativePath)), `${relativePath} should be removed`).toBe(false)
    }
  })

  it('hard-closes legacy workflow execution and source download routes', () => {
    const router = read('legacy/workflows.router.ts')
    expect(router).toMatch(/Legacy workflow execution has been removed/)
    expect(router).toMatch(/Run YAML download has been removed/)
    expect(router).not.toMatch(/generateWorkflowWorkspace|dispatchRun|WorkflowRunner/)
  })

  it('keeps DeviceWorker free of legacy driver prep', () => {
    const worker = read('services/device-worker.ts')
    expect(worker).not.toMatch(/MAESTRO_HOME|MAESTRO_PATH|dev\.mobile\.maestro|no-reinstall-driver/)
    expect(worker).toMatch(/persistent per-device Bridge context/)
  })
})
