import { describe, expect, it, vi } from 'vitest'
import {
  parseScreenStateDump,
  readScreenStateDumpWithFallback,
} from './screen-state-dump'

const SERIAL = 'emulator-5554'
const PACKAGE_NAME = 'com.arasdigital.nesymobile.test'
const PROVIDER_DUMP =
  'PROVIDER\nNESY_SCREEN_STATE:{"screen":{"stopCount":12},"shared":{"route":"36"}}\n'
const LEGACY_DUMP =
  'TASK\nNESY_SCREEN_STATE:{"screen":{"stopCount":7},"shared":{"route":"legacy"}}\n'
const COMMANDS = {
  provider:
    `dumpsys activity provider ${PACKAGE_NAME}/com.verdict.sdk.core.VerdictDumpProvider --verdict-screen-state`,
  legacy:
    `dumpsys activity ${PACKAGE_NAME}/com.arasdigital.nesymobile.main.MainActivity --nesy-state`,
}

describe('Screen State dump channel fallback', () => {
  it('uses the VerdictDumpProvider component first and stops on a valid dump', async () => {
    const runShell = vi.fn().mockResolvedValue(PROVIDER_DUMP)

    const state = await readScreenStateDumpWithFallback(SERIAL, COMMANDS, runShell)

    expect(runShell).toHaveBeenCalledTimes(1)
    expect(runShell).toHaveBeenCalledWith(
      SERIAL,
      COMMANDS.provider,
      8_000,
    )
    expect(state.instrumented).toBe(true)
    expect(state.fields.find((field) => field.name === 'stopCount')?.value).toBe(12)
  })

  it('falls back to the legacy MainActivity component when the provider dump is empty', async () => {
    const runShell = vi
      .fn()
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce(LEGACY_DUMP)

    const state = await readScreenStateDumpWithFallback(SERIAL, COMMANDS, runShell)

    expect(runShell.mock.calls.map((call) => call[1])).toEqual([
      COMMANDS.provider,
      COMMANDS.legacy,
    ])
    expect(state.instrumented).toBe(true)
    expect(state.fields.find((field) => field.name === 'route')?.value).toBe('legacy')
  })

  it('reports an uninstrumented state when both component dumps are empty', async () => {
    const runShell = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('  ')

    await expect(readScreenStateDumpWithFallback(SERIAL, COMMANDS, runShell)).resolves.toEqual({
      instrumented: false,
      fields: [],
    })
    expect(runShell).toHaveBeenCalledTimes(2)
  })

  it('keeps parsing the NESY_SCREEN_STATE marker', () => {
    expect(parseScreenStateDump(PROVIDER_DUMP).instrumented).toBe(true)
    expect(parseScreenStateDump('VERDICT_SCREEN_STATE:{"screen":{}}')).toEqual({
      instrumented: false,
      fields: [],
    })
  })
})
