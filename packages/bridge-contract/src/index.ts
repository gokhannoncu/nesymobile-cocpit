/**
 * ===========================================================================
 *  @nesy/bridge-contract — Verdict Accessibility Bridge protocol v1
 *
 *  Bu paketin üç yasağı var ve üçü de derleme/inceleme zamanında görünür
 *  olmalı:
 *
 *    1. TAŞIMA YOK. TCP, socket, `adb`, NDJSON I/O burada değil. Taşıma
 *       `@nesy/bridge-client`tedir ve buna bağımlıdır — tersi asla.
 *    2. DOMAIN YOK. `STOP`, `PARCEL`, `TOUR`, `OPEN_STOP`, `APPROVE_TOUR`,
 *       `COURIER_LOGIN` buraya giremez. Bridge "hangi node" bilir, "hangi iş
 *       kuralı" bilmez.
 *    3. UYDURMA YOK. Her wire literal'i cihazdaki `ProtocolV1.kt` /
 *       `BridgeTcpServer.kt` karşılığından çıkarıldı. Uydurulmuş bir
 *       sözleşmeye yazılan testler sonsuza kadar yeşil kalır ve gerçek
 *       cihazda hiçbir şey çalışmaz.
 * ===========================================================================
 */
export * from "./protocol.js";
export * from "./targets.js";
export * from "./lifecycle.js";
export * from "./wait.js";
export * from "./admission.js";
export * from "./codec.js";
