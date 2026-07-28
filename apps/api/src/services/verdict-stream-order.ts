/**
 * Stream-local ordering primitives for durable ingest.
 *
 * Streams are independent protocol cursors, so ordering globally would make one slow
 * device stall every other device. The JSON tuple avoids collisions between identities
 * such as ("ab", "c") and ("a", "bc").
 */
function streamKey(runId: string, sessionId: string): string {
  return JSON.stringify([runId, sessionId]);
}

export class StreamSerialiser {
  private readonly tails = new Map<string, Promise<void>>();

  run<T>(runId: string, sessionId: string, task: () => Promise<T>): Promise<T> {
    const key = streamKey(runId, sessionId);
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(task);
    // A rejected frame must not poison the stream queue. Store a settled tail and remove
    // it only if no newer frame replaced it in the meantime.
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return result;
  }
}

export class MonotoneStreamWatermarks {
  private readonly values = new Map<string, bigint>();

  advance(runId: string, sessionId: string, candidate: bigint): bigint {
    const key = streamKey(runId, sessionId);
    const previous = this.values.get(key);
    const next = previous === undefined ? candidate : previous > candidate ? previous : candidate;
    this.values.set(key, next);
    return next;
  }
}
