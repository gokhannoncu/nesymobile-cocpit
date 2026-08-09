/**
 * Run Span Recorder — lightweight per-run timing telemetry.
 *
 * Answers "where does run time actually go?" with named spans
 * (plan_compile, bridgeflow_startup, app_launch, per-node ui_action,
 * bridge_wait, process_spawn_per_node, video_pull, ...).
 *
 * Spans are collected in memory during the run and persisted once at the
 * end into WorkflowRun.spans (Json) — no extra DB round-trips mid-run.
 */

export interface RunSpan {
  /** Span name, e.g. "yaml_generation", "ui_action". */
  name: string;
  /** Offset from run start, in ms. */
  startMs: number;
  /** Duration in ms. */
  durationMs: number;
  /** Optional attributes (nodeId, nodeType, detail...). */
  attrs?: Record<string, string | number | boolean>;
}

export class RunSpanRecorder {
  private readonly runStart: number;
  private readonly spans: RunSpan[] = [];
  private readonly open = new Map<string, { start: number; attrs?: RunSpan["attrs"] }>();

  constructor(runStart = Date.now()) {
    this.runStart = runStart;
  }

  /** Starts an open span; end it with `end(key)`. Key must be unique among open spans. */
  start(key: string, attrs?: RunSpan["attrs"]): void {
    this.open.set(key, { start: Date.now(), attrs });
  }

  /**
   * Ends an open span. `name` defaults to the key (use it when the same key
   * tracks differently-named phases). No-op when the key was never started.
   */
  end(key: string, name?: string, extraAttrs?: RunSpan["attrs"]): void {
    const entry = this.open.get(key);
    if (!entry) return;
    this.open.delete(key);
    const now = Date.now();
    this.spans.push({
      name: name ?? key,
      startMs: entry.start - this.runStart,
      durationMs: now - entry.start,
      attrs: entry.attrs || extraAttrs ? { ...entry.attrs, ...extraAttrs } : undefined,
    });
  }

  /** Records a complete span measured elsewhere. */
  record(name: string, startedAt: number, durationMs: number, attrs?: RunSpan["attrs"]): void {
    this.spans.push({
      name,
      startMs: startedAt - this.runStart,
      durationMs,
      attrs,
    });
  }

  /** Measures a sync function as a span. */
  measure<T>(name: string, fn: () => T, attrs?: RunSpan["attrs"]): T {
    const start = Date.now();
    try {
      return fn();
    } finally {
      this.record(name, start, Date.now() - start, attrs);
    }
  }

  /** Measures an async function as a span. */
  async measureAsync<T>(name: string, fn: () => Promise<T>, attrs?: RunSpan["attrs"]): Promise<T> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      this.record(name, start, Date.now() - start, attrs);
    }
  }

  /** Closes any spans left open (run aborted mid-phase) and returns everything, sorted. */
  finalize(): RunSpan[] {
    const now = Date.now();
    for (const [key, entry] of this.open) {
      this.spans.push({
        name: key,
        startMs: entry.start - this.runStart,
        durationMs: now - entry.start,
        attrs: { ...entry.attrs, unterminated: true },
      });
    }
    this.open.clear();
    return [...this.spans].sort((a, b) => a.startMs - b.startMs);
  }
}
