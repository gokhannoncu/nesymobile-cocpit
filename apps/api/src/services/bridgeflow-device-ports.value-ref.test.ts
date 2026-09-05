/**
 * An unresolved `valueRef` must fail its step, not type an empty string.
 *
 * Measured on run_d5bae2af: `load-to-vehicle` asks for `run.input.scanValue`,
 * the run was started with `{pin, routeCode}` only, and `String(undefined ?? '')`
 * sent a blank to the device. The bridge accepted it and reported the text as
 * typed, so `enter-barcode` went SUCCEEDED against an empty dialog, the confirm
 * tap addressed nothing, and the run failed four steps later citing an unrelated
 * step. The empty field was visible on the phone the whole time.
 */
import { describe, expect, it, vi } from "vitest";

import { createBridgeRuntimePort } from "./bridgeflow-device-ports.js";

/** Minimal fakes: only what the setText path touches. */
function harness(runInputs: Record<string, unknown>) {
  const acted: { command: string; text?: string }[] = [];
  const manager = {
    act: vi.fn(async (command: string, _fingerprint: unknown, opts: { text?: string }) => {
      acted.push({ command, ...(opts.text === undefined ? {} : { text: opts.text }) });
      return { terminalState: 'SUCCEEDED', actedBy: 'ACCESSIBILITY', manualTouch: false };
    }),
    resolveTarget: vi.fn(),
    pushCorrelation: vi.fn(async () => ({ ok: true })),
    getScheduler: () => ({ setState: () => {} }),
  } as unknown as Parameters<typeof createBridgeRuntimePort>[0]['manager'];

  // The shape `isTargetFingerprint` accepts — version 1 plus an id selector.
  const variables = {
    get: vi.fn(() => ({
      version: 1,
      selector: { by: 'id', value: 'barcode_input' },
    })),
    set: vi.fn(),
  } as unknown as Parameters<typeof createBridgeRuntimePort>[0]['variables'];

  const port = createBridgeRuntimePort({
    manager,
    variables,
    runId: 'run-1',
    runInputs,
    logger: () => {},
  });

  return { port, acted, manager };
}

const step = {
  planStepId: 'enter-barcode',
  timeoutMs: 5_000,
  params: {
    action: 'setText',
    targetVariable: 'inputFieldHandle',
    args: { valueRef: 'run.input.scanValue' },
  },
} as unknown as Parameters<ReturnType<typeof createBridgeRuntimePort>['act']>[0];

const context = { requestId: 'req-1' } as unknown as Parameters<
  ReturnType<typeof createBridgeRuntimePort>['act']
>[1];

describe('setText with an unresolved valueRef', () => {
  it('fails the step and names the reference', async () => {
    const { port, acted } = harness({ pin: '3680', routeCode: '36' });

    const result = await port.act(step, context);

    expect(result.terminalState).toBe('FAILED');
    expect(result.effectVerified).toBe(false);
    expect(result.evidenceRef).toContain('unresolved-value-ref');
    expect(result.evidenceRef).toContain('run.input.scanValue');
    // The device is never touched: typing a blank is what made this invisible.
    expect(acted).toEqual([]);
  });

  it('types the value when the run input is present', async () => {
    const { port, acted } = harness({ scanValue: '6880051000310910' });

    const result = await port.act(step, context);

    expect(result.terminalState).toBe('SUCCEEDED');
    expect(acted).toEqual([
      { command: 'input_text', text: '6880051000310910' },
    ]);
  });

  it('still allows an explicitly authored empty text', async () => {
    // Clearing a field is a real instruction; only an UNRESOLVED reference fails.
    const clearStep = {
      ...step,
      params: { ...step.params, args: { text: '' } },
    } as typeof step;
    const { port, acted } = harness({});

    const result = await port.act(clearStep, context);

    expect(result.terminalState).toBe('SUCCEEDED');
    expect(acted).toEqual([{ command: 'input_text', text: '' }]);
  });
});

/**
 * The same bug under the other arg key. Measured on run_3ef0e142:
 * `complete-delivery` writes `args: { text: "run.input.consignmentNumber" }`,
 * the guard written for `valueRef` never looked at it, an empty string went into
 * the delivery scan field, and the app emitted no `DELIVERY_PARCEL_SCANNED` at
 * all — so the run died 20s later on a continue gate three steps away.
 */
describe('an unresolved reference under any arg key', () => {
  const textStep = {
    planStepId: 'type-barcode',
    timeoutMs: 5_000,
    params: {
      action: 'setText',
      targetVariable: 'scanFieldHandle',
      args: { text: 'run.input.consignmentNumber' },
    },
  } as unknown as Parameters<ReturnType<typeof createBridgeRuntimePort>['act']>[0];

  it('fails the step instead of typing a blank', async () => {
    const { port, acted } = harness({ pin: '3680' });

    const result = await port.act(textStep, context);

    expect(result.terminalState).toBe('FAILED');
    expect(result.evidenceRef).toContain('unresolved-value-ref');
    expect(result.evidenceRef).toContain('run.input.consignmentNumber');
    expect(acted).toEqual([]);
  });

  it('types the value when the input is present', async () => {
    const { port, acted } = harness({ consignmentNumber: '6880051000313515' });

    const result = await port.act(textStep, context);

    expect(result.terminalState).toBe('SUCCEEDED');
    expect(acted).toEqual([{ command: 'input_text', text: '6880051000313515' }]);
  });

  it('still allows an authored empty string', async () => {
    // Clearing a field is a real instruction, and a literal is not a reference.
    const clearStep = {
      planStepId: 'clear-field',
      timeoutMs: 5_000,
      params: { action: 'setText', targetVariable: 'scanFieldHandle', args: { text: '' } },
    } as unknown as Parameters<ReturnType<typeof createBridgeRuntimePort>['act']>[0];

    const { port, acted } = harness({});

    const result = await port.act(clearStep, context);

    expect(result.terminalState).toBe('SUCCEEDED');
    expect(acted).toEqual([{ command: 'input_text', text: '' }]);
  });

  it('fails an unresolved var. reference on a non-text arg', async () => {
    // `select-route` scrolls with `rowIndex: "var.offeredRouteRows.route_index"`.
    // Scrolling to an undefined index addresses nothing, and reporting success
    // for it is the same lie in a different place.
    const scrollStep = {
      planStepId: 'scroll-to-row',
      timeoutMs: 5_000,
      params: {
        action: 'scrollToItem',
        args: { listClass: 'android.widget.ListView', rowIndex: 'var.missingRows.route_index' },
      },
    } as unknown as Parameters<ReturnType<typeof createBridgeRuntimePort>['act']>[0];

    const { port } = harness({});

    const result = await port.act(scrollStep, context);

    expect(result.terminalState).toBe('FAILED');
    expect(result.evidenceRef).toContain('var.missingRows.route_index');
  });
});
