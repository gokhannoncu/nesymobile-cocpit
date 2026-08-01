/**
 * ===========================================================================
 *  KANAL-AGNOSTİK SÖZLEŞME TEST PAKETİ  (Plan C.9 / Faz 0.3)
 *
 *  Buradaki testler taşıma detayını bilmez. `ControlChannel` implementasyonu
 *  olan `VerdictChannel` bu sözleşmenin tamamını geçmek ZORUNDADIR.
 *
 *  Taşıma farkı `ChannelHarness` ile soyutlanır: çağıran, kanalının üç
 *  senaryosunu (sessiz / patlayan / başarılı) nasıl kuracağını söyler.
 * ===========================================================================
 */
import { describe, expect, it } from "vitest";
import type { ControlOperation } from "@nesy/control-contract";
import { asSecret, newRequestId } from "@nesy/control-contract";
import type { ChannelContext, ControlChannel } from "./index.js";

export interface ChannelHarness {
  /** Test edilen kanal. */
  channel: ControlChannel;
  /**
   * Taşıma "cihaza ulaştı ama hiçbir kanıt dönmedi" gibi davranır.
   * (`Broadcast completed: result=0`, hiç `data=` yok)
   */
  silent(): ChannelContext;
  /** Taşıma patlar (adb yok, cihaz kopuk, timeout). */
  failing(message: string): ChannelContext;
  /** Verilen op için GEÇERLİ bir başarı yanıtı üretir. */
  succeeding(op: ControlOperation): ChannelContext;
  /**
   * Kanalın gerçekten desteklediği op'lar. Desteklenmeyenler için sözleşme
   * "asla `ok:true` dönmez" der; desteklenenler için başarı yolu sınanır.
   */
  supported: ReadonlyArray<ControlOperation["op"]>;
}

const SERIAL = "TESTSERIAL01";

/** Sözleşme testlerinin üzerinden geçtiği temsili op kümesi. */
export function sampleOperations(): ControlOperation[] {
  const env = () => ({ requestId: newRequestId("test"), scope: "run-1" });
  return [
    { ...env(), op: "get_state" },
    { ...env(), op: "get_run" },
    { ...env(), op: "get_device_id" },
    { ...env(), op: "get_request_key" },
    { ...env(), op: "reset_state" },
    {
      ...env(),
      op: "set_run",
      runId: "run-1",
      secret: asSecret("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),
      wsEnabled: true,
      wsPort: 8765,
      skipDeliveryWait: true,
    },
    { ...env(), op: "navigate", destination: "stop_list" },
    { ...env(), op: "seed", verb: "select_route", params: { route: "R7" } },
    { ...env(), op: "end_run" },
    { ...env(), op: "get_command_result", targetRequestId: "other-req" },
    { ...env(), op: "get_screen_state" },
  ];
}

export function runControlChannelContract(
  name: string,
  makeHarness: () => ChannelHarness,
): void {
  describe(`ControlChannel sözleşmesi — ${name}`, () => {
    it("her op için ya ok:true ya da kodlu bir hata döner; asla throw etmez", async () => {
      const h = makeHarness();
      for (const op of sampleOperations()) {
        const res = await h.channel.run(SERIAL, op, h.succeeding(op));
        if (res.ok) {
          expect(res.data, `${op.op} ok:true ama data yok`).toBeDefined();
        } else {
          expect(res.code, `${op.op} hata kodu boş`).toBeTruthy();
        }
      }
    });

    it("desteklenmeyen op varsa ASLA ok:true dönmez", async () => {
      const h = makeHarness();
      const unsupported = sampleOperations().filter(
        (op) => !h.supported.includes(op.op),
      );
      for (const op of unsupported) {
        const res = await h.channel.run(SERIAL, op, h.succeeding(op));
        expect(res.ok, `${op.op} desteklenmiyor ama ok:true döndü`).toBe(false);
      }
    });

    it("taşıma patlarsa CHANNEL_UNAVAILABLE döner", async () => {
      const h = makeHarness();
      for (const op of sampleOperations().filter((o) =>
        h.supported.includes(o.op),
      )) {
        const res = await h.channel.run(
          SERIAL,
          op,
          h.failing("device offline"),
        );
        expect(res.ok).toBe(false);
        if (!res.ok) {
          // Desteklenen op'ta taşıma hatası kanal seviyesinde raporlanmalı.
          expect(res.code).toBe("CHANNEL_UNAVAILABLE");
        }
      }
    });

    it("SESSİZ taşıma başarı sayılmaz — silent success YOK", async () => {
      const h = makeHarness();
      for (const op of sampleOperations().filter((o) =>
        h.supported.includes(o.op),
      )) {
        const res = await h.channel.run(SERIAL, op, h.silent());
        expect(
          res.ok,
          `${op.op}: kanıt yokken ok:true döndü — sessiz başarı`,
        ).toBe(false);
      }
    });

    it("mutasyon başarısı requestId'yi geri yansıtır", async () => {
      const h = makeHarness();
      const mutations = sampleOperations().filter(
        (o) =>
          h.supported.includes(o.op) &&
          ["set_run", "reset_state", "seed", "navigate", "end_run"].includes(
            o.op,
          ),
      );
      expect(mutations.length).toBeGreaterThan(0);
      for (const op of mutations) {
        const res = await h.channel.run(SERIAL, op, h.succeeding(op));
        expect(res.ok, `${op.op} başarı yolunda hata döndü`).toBe(true);
        if (res.ok) {
          const data = res.data as { requestId?: string; accepted?: boolean };
          expect(data.accepted).toBe(true);
          expect(data.requestId).toBe(op.requestId);
        }
      }
    });

    it("secret hiçbir yanıt alanına SIZMAZ", async () => {
      const h = makeHarness();
      const setRun = sampleOperations().find((o) => o.op === "set_run")!;
      const secret = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      for (const ctx of [h.silent(), h.failing(secret), h.succeeding(setRun)]) {
        const res = await h.channel.run(SERIAL, setRun, ctx);
        // `failing(secret)` bilinçli olarak secret'ı hata mesajına koyar:
        // kanal onu ham geçiriyorsa bu test yakalar.
        expect(JSON.stringify(res)).not.toContain(secret);
      }
    });

    it("girdi op nesnesini DEĞİŞTİRMEZ", async () => {
      const h = makeHarness();
      for (const op of sampleOperations()) {
        const before = JSON.stringify(op);
        await h.channel.run(SERIAL, op, h.succeeding(op));
        expect(JSON.stringify(op), `${op.op} mutasyona uğradı`).toBe(before);
      }
    });
  });
}
