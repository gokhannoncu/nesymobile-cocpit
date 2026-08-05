/**
 * ===========================================================================
 *  ADMISSION SCHEDULER
 *
 *  Bu suite'in koruduğu tek şey: aynı cihazda iki fiziksel aksiyonun asla
 *  eşzamanlı olmaması. O ihlal SESSİZDİR — her iki tap da "ok" döner ve test
 *  yeşil kalır, sadece kanıt yanlıştır.
 * ===========================================================================
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { DeviceCommandAdmissionEnvelope } from "@nesy/bridge-contract";

import {
  AdmissionRejectedError,
  DeviceAdmissionScheduler,
  getAdmissionScheduler,
  resetAdmissionSchedulersForTests,
} from "./bridge-admission.js";

const env = (
  over: Partial<DeviceCommandAdmissionEnvelope> = {},
): DeviceCommandAdmissionEnvelope => ({
  deviceId: "dev-1",
  command: "tap_id",
  lane: "MUTATION",
  requestId: "r-1",
  actorKind: "AUTOMATED_RUN",
  ...over,
});

const deferred = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

beforeEach(() => {
  resetAdmissionSchedulersForTests();
});

describe("mutation lane", () => {
  it("never runs two mutations at once on the same device", async () => {
    const scheduler = new DeviceAdmissionScheduler("dev-1");
    scheduler.setState({ deviceReady: true, activeRunId: null });

    const order: string[] = [];
    const first = deferred();

    const a = scheduler.submit({
      envelope: env({ requestId: "a" }),
      run: async () => {
        order.push("a:start");
        await first.promise;
        order.push("a:end");
      },
    });
    const b = scheduler.submit({
      envelope: env({ requestId: "b" }),
      run: async () => {
        order.push("b:start");
      },
    });

    await new Promise((r) => setTimeout(r, 20));
    // b HENÜZ başlamadı — şerit tek.
    expect(order).toEqual(["a:start"]);

    first.release();
    await Promise.all([a, b]);
    expect(order).toEqual(["a:start", "a:end", "b:start"]);
  });

  it("lets OBSERVATION run in parallel with a MUTATION", async () => {
    // Okuma ile yazmayı serileştirmek gereksiz yavaşlık olurdu; yasak olan
    // iki YAZMA.
    const scheduler = new DeviceAdmissionScheduler("dev-1");
    scheduler.setState({ deviceReady: true });
    const gate = deferred();
    const order: string[] = [];

    const mutation = scheduler.submit({
      envelope: env({ requestId: "m" }),
      run: async () => {
        order.push("m:start");
        await gate.promise;
      },
    });
    const observation = scheduler.submit({
      envelope: env({ requestId: "o", command: "find_id", lane: "OBSERVATION" }),
      run: async () => {
        order.push("o:start");
      },
    });

    await observation;
    expect(order).toEqual(["m:start", "o:start"]);
    gate.release();
    await mutation;
  });
});

describe("CONTROL priority", () => {
  it("runs a CONTROL command ahead of queued mutations — no starvation", async () => {
    const scheduler = new DeviceAdmissionScheduler("dev-1");
    scheduler.setState({ deviceReady: true });
    const gate = deferred();
    const order: string[] = [];

    // Şeridi tut.
    const held = scheduler.submit({
      envelope: env({ requestId: "held" }),
      run: async () => {
        order.push("held:start");
        await gate.promise;
      },
    });
    await new Promise((r) => setTimeout(r, 10));

    // Kuyruğa iki mutation, sonra bir CONTROL ekle.
    const queuedA = scheduler.submit({
      envelope: env({ requestId: "q1" }),
      run: async () => void order.push("q1"),
    });
    const queuedB = scheduler.submit({
      envelope: env({ requestId: "q2" }),
      run: async () => void order.push("q2"),
    });
    const control = scheduler.submit({
      envelope: env({ requestId: "ctl", command: "ping", lane: "CONTROL" }),
      run: async () => void order.push("ctl"),
    });

    // CONTROL kendi bütçesinde ve en yüksek öncelikte: mutation şeridinin
    // açılmasını BEKLEMEZ. İptalin geciktiği bir sistemde iptal anlamsızdır.
    await control;
    expect(order).toContain("ctl");
    expect(order).not.toContain("q1");

    gate.release();
    await Promise.all([held, queuedA, queuedB]);
    // Aynı öncelikte FIFO korunur.
    expect(order.indexOf("q1")).toBeLessThan(order.indexOf("q2"));
  });
});

describe("device readiness and run ownership", () => {
  it("refuses everything before preflight passes", async () => {
    const scheduler = new DeviceAdmissionScheduler("dev-1");
    // deviceReady default false → fail-closed.
    await expect(
      scheduler.submit({ envelope: env({ lane: "OBSERVATION", command: "find_id" }), run: async () => 1 }),
    ).rejects.toBeInstanceOf(AdmissionRejectedError);
  });

  it("rejects an Inspector mutation during a run, and accepts it under takeover", async () => {
    const scheduler = new DeviceAdmissionScheduler("dev-1");
    scheduler.setState({ deviceReady: true, activeRunId: "run-7" });

    const rejected = await scheduler
      .submit({ envelope: env({ actorKind: "INSPECTOR" }), run: async () => "no" })
      .catch((e: unknown) => e);
    expect(rejected).toBeInstanceOf(AdmissionRejectedError);
    expect((rejected as AdmissionRejectedError).decision.reason).toBe("ACTIVE_RUN_MUTATION_LOCK");
    expect((rejected as AdmissionRejectedError).decision.overridable).toBe(true);

    const allowed = await scheduler.submit({
      envelope: env({ actorKind: "INSPECTOR", takeover: true }),
      run: async () => "yes",
    });
    expect(allowed).toBe("yes");
  });

  it("rejects the request BEFORE queueing it, not after waiting", async () => {
    // Reddedilmiş bir komutu kuyrukta bekletmek, çağırana "sıradasın"
    // izlenimi verip sonunda reddetmektir.
    const scheduler = new DeviceAdmissionScheduler("dev-1");
    scheduler.setState({ deviceReady: true, activeRunId: "run-7" });
    const started = Date.now();
    await scheduler
      .submit({ envelope: env({ actorKind: "INSPECTOR" }), run: async () => 1 })
      .catch(() => undefined);
    expect(Date.now() - started).toBeLessThan
      (100);
    expect(scheduler.queueDepth()).toBe(0);
  });
});

describe("post-mutation invalidation", () => {
  it("bumps the invalidation epoch and wakes waiters after a mutation", async () => {
    // Bir tap koşulu SAĞLAMIŞ olabilir; bekleyenleri uyandırmamak, cihaz olay
    // üretmediğinde beklemenin gereksizce zaman aşımına düşmesi demektir.
    const scheduler = new DeviceAdmissionScheduler("dev-1");
    scheduler.setState({ deviceReady: true });
    let woken = 0;
    const unsubscribe = scheduler.onWaitReevaluation(() => {
      woken += 1;
    });

    const before = scheduler.currentInvalidationEpoch();
    await scheduler.submit({ envelope: env(), run: async () => undefined });
    expect(scheduler.currentInvalidationEpoch()).toBe(before + 1);
    expect(woken).toBe(1);

    // Okuma ağacı değiştirmez: epoch artmamalı.
    await scheduler.submit({
      envelope: env({ command: "find_id", lane: "OBSERVATION" }),
      run: async () => undefined,
    });
    expect(scheduler.currentInvalidationEpoch()).toBe(before + 1);
    expect(woken).toBe(1);

    unsubscribe();
    await scheduler.submit({ envelope: env({ requestId: "z" }), run: async () => undefined });
    expect(woken).toBe(1);
  });

  it("releases the lane even when the command throws", async () => {
    const scheduler = new DeviceAdmissionScheduler("dev-1");
    scheduler.setState({ deviceReady: true });
    await scheduler
      .submit({
        envelope: env(),
        run: async () => {
          throw new Error("device exploded");
        },
      })
      .catch(() => undefined);
    // Şerit serbest kalmazsa cihaz sonsuza kadar kilitli kalır.
    expect(scheduler.laneRunning("MUTATION")).toBe(0);
    await expect(scheduler.submit({ envelope: env({ requestId: "next" }), run: async () => "ok" })).resolves.toBe(
      "ok",
    );
  });
});

describe("scheduler registry", () => {
  it("keeps one scheduler per device", () => {
    const a = getAdmissionScheduler("dev-1");
    const b = getAdmissionScheduler("dev-1");
    const c = getAdmissionScheduler("dev-2");
    expect(a).toBe(b);
    // İki cihaz birbirini beklememeli.
    expect(a).not.toBe(c);
  });
});
