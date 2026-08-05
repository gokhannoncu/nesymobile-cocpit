/**
 * ===========================================================================
 *  @nesy/bridge-client — Verdict Bridge host taşıması
 *
 *  Bu paket `@nesy/bridge-contract`a bağımlıdır; TERSİ ASLA. Sözleşme taşımayı
 *  bilmez (D.3). Bağımlılığın yönü tersine dönerse, protokol tipleri soket
 *  ayrıntılarına göre şekillenmeye başlar ve sözleşme cihazın SSOT'u olmaktan
 *  çıkar.
 *
 *  Fake TCP bridge de burada: client'ın kendi testleri gerçek soket üzerinden
 *  koşmalı ve bunun için `apps/api`'ye bağımlı olmamalı.
 * ===========================================================================
 */
export { NdjsonParser, type NdjsonParserOptions } from "./ndjson.js";
export {
  BridgeClient,
  BridgeHostError,
  type BridgeClientOptions,
  type BridgeCommandOutcome,
  type BridgeRequest,
} from "./client.js";
export { FakeBridgeServer, type FakeBehaviour, type FakeBridgeOptions } from "./fake-bridge-server.js";
