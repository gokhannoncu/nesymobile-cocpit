/**
 * ===========================================================================
 *  NDJSON ÇERÇEVELEME — bayt akışının gerçekten bayt akışı olduğu testler
 *
 *  Buradaki her senaryo, `buffer.toString().split("\n")` ile yazılmış bir
 *  parser'da SESSİZCE bozulur. Sessizlik önemli: bölünmüş bir UTF-8 karakter
 *  istisna atmaz, sadece yanlış karakter üretir.
 * ===========================================================================
 */
import { describe, expect, it } from "vitest";

import { NdjsonParser } from "./ndjson.js";

function collect(options?: { maxFrameBytes?: number }) {
  const lines: string[] = [];
  const oversized: number[] = [];
  const parser = new NdjsonParser({
    maxFrameBytes: options?.maxFrameBytes ?? 1_000_000,
    onLine: (line) => lines.push(line),
    onOversized: (bytes) => oversized.push(bytes),
  });
  return { parser, lines, oversized };
}

describe("NdjsonParser", () => {
  it("delivers one frame per newline", () => {
    const { parser, lines } = collect();
    parser.push(Buffer.from('{"a":1}\n{"a":2}\n'));
    expect(lines).toEqual(['{"a":1}', '{"a":2}']);
  });

  it("reassembles a frame split across three chunks", () => {
    const { parser, lines } = collect();
    parser.push(Buffer.from('{"req'));
    expect(lines).toEqual([]);
    parser.push(Buffer.from('uestId":"r-'));
    expect(lines).toEqual([]);
    parser.push(Buffer.from('1"}\n'));
    expect(lines).toEqual(['{"requestId":"r-1"}']);
  });

  it("delivers three frames arriving in ONE chunk", () => {
    const { parser, lines } = collect();
    parser.push(Buffer.from('{"a":1}\n{"a":2}\n{"a":3}\n'));
    expect(lines).toHaveLength(3);
  });

  it("does not corrupt a multi-byte character split across chunks", () => {
    // Bu testin olmadığı bir parser'da Türkçe karakter taşıyan bir yanıt
    // sessizce bozulur — ve base64 PNG'de bu, çözülemeyen bir ekran görüntüsü
    // demektir.
    const payload = Buffer.from('{"text":"Onaylandı ğüşiöç"}\n', "utf8");
    const cut = payload.indexOf(Buffer.from("ı", "utf8")[0]!) + 1;
    const { parser, lines } = collect();
    parser.push(payload.subarray(0, cut));
    parser.push(payload.subarray(cut));
    expect(lines).toEqual(['{"text":"Onaylandı ğüşiöç"}']);
    expect(JSON.parse(lines[0]!)).toEqual({ text: "Onaylandı ğüşiöç" });
  });

  it("tolerates CRLF, which would otherwise break JSON.parse", () => {
    const { parser, lines } = collect();
    parser.push(Buffer.from('{"a":1}\r\n'));
    expect(lines).toEqual(['{"a":1}']);
    expect(() => JSON.parse(lines[0]!)).not.toThrow();
  });

  it("skips blank lines instead of treating them as frames", () => {
    const { parser, lines } = collect();
    parser.push(Buffer.from('\n\n{"a":1}\n   \n'));
    expect(lines).toEqual(['{"a":1}']);
  });

  it("passes malformed JSON through as a frame — framing is not validation", () => {
    // Ayrım kasıtlı: bozuk bir satır bir SATIRI atlamalı, akışı bozmamalı.
    // Doğrulama `decodeResult`'ın işi.
    const { parser, lines } = collect();
    parser.push(Buffer.from('{ not json\n{"a":1}\n'));
    expect(lines).toEqual(["{ not json", '{"a":1}']);
  });

  it("drops an oversized frame and reports it instead of buffering forever", () => {
    const { parser, lines, oversized } = collect({ maxFrameBytes: 32 });
    parser.push(Buffer.from(`${"x".repeat(100)}\n{"a":1}\n`));
    expect(oversized).toHaveLength(1);
    expect(oversized[0]).toBeGreaterThan(32);
    // Kritik: dev satırdan SONRAKİ geçerli satır hâlâ teslim edilir.
    expect(lines).toEqual(['{"a":1}']);
  });

  it("drops an unterminated oversized stream without unbounded memory growth", () => {
    // Satır sonu HİÇ gelmeyen bozuk/kötü niyetli akış.
    const { parser, lines, oversized } = collect({ maxFrameBytes: 64 });
    for (let i = 0; i < 10; i += 1) parser.push(Buffer.from("y".repeat(50)));
    expect(oversized.length).toBeGreaterThanOrEqual(1);
    expect(parser.pendingBytes()).toBeLessThanOrEqual(64);
    // Kuyruk atıldıktan sonra yeni bir geçerli satır normal işlenir.
    parser.push(Buffer.from(`\n{"a":1}\n`));
    expect(lines).toEqual(['{"a":1}']);
  });

  it("never delivers a half frame on stream end", () => {
    // Yarısı gelmiş bir JSON'u geçerli sanmak, yanıtı uydurmakla eşdeğer.
    const { parser, lines } = collect();
    parser.push(Buffer.from('{"a":1'));
    parser.end();
    expect(lines).toEqual([]);
    expect(parser.pendingBytes()).toBe(0);
  });
});
