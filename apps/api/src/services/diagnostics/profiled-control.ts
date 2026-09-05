import { createControlExecutor, createNodeAdbRunner } from '@nesy/control-channels/node'
import { profileAsync } from './live-profile-recorder.js'

export function createProfiledControlExecutor(applicationId: string) {
  const adb = createNodeAdbRunner()
  const executor = createControlExecutor({
    applicationId,
    adb: (serial, args, timeoutMs, stdin) => {
      // Allowlisted command structure only; broadcasts contain PINs/other inputs.
      const tokens = args.filter(a => a !== serial && a !== '-s')
      const verb = tokens.includes('broadcast') ? 'broadcast' :
        tokens.includes('cat') ? 'cat' : tokens.includes('logcat') ? 'logcat' :
          tokens[0] === 'exec-out' ? 'exec-out' : tokens[0] === 'shell' ? 'shell' : 'other'
      return profileAsync('adb.control_command', { verb }, () => adb(serial, args, timeoutMs, stdin))
    },
  })
  return {
    run: ((serial: string, op: any) => profileAsync('sdk.control', {
      operation: op.op, verb: op.verb, requestId: op.requestId,
    }, () => executor.run(serial, op))) as typeof executor.run,
  }
}
