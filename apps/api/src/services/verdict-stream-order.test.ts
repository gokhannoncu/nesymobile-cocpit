import { describe, expect, it } from "vitest";
import { MonotoneStreamWatermarks, StreamSerialiser } from "./verdict-stream-order.js";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("stream-local durable ordering", () => {
  it("runs at most one task for the same stream", async () => {
    const serialiser = new StreamSerialiser();
    const firstGate = deferred();
    const started: number[] = [];

    const first = serialiser.run("run", "session", async () => {
      started.push(1);
      await firstGate.promise;
      return 1;
    });
    const second = serialiser.run("run", "session", async () => {
      started.push(2);
      return 2;
    });

    await Promise.resolve();
    expect(started).toEqual([1]);
    firstGate.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(started).toEqual([1, 2]);
  });

  it("does not make different streams wait for each other", async () => {
    const serialiser = new StreamSerialiser();
    const gate = deferred();
    const started: string[] = [];

    const slow = serialiser.run("run", "slow", async () => {
      started.push("slow");
      await gate.promise;
    });
    const fast = serialiser.run("run", "fast", async () => {
      started.push("fast");
    });

    await fast;
    expect(started).toEqual(["slow", "fast"]);
    gate.resolve();
    await slow;
  });

  it("keeps ACK watermarks monotone when a late result regresses to zero", () => {
    const watermarks = new MonotoneStreamWatermarks();
    const observed = [5n, 0n, 3n, 8n].map((candidate) =>
      watermarks.advance("run", "session", candidate),
    );

    expect(observed).toEqual([5n, 5n, 5n, 8n]);
    expect(watermarks.advance("run", "other", 1n)).toBe(1n);
  });
});
