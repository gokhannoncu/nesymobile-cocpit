/**
 * ===========================================================================
 *  FAKE TCP BRIDGE  (Plan D.3 · RUN_PLAY 3.4)
 *
 *  Gerçek bir TCP sunucusu — mock değil. Sebep: bu fazda test edilmesi gereken
 *  şeylerin çoğu YALNIZCA gerçek soket üzerinde vardır: chunk sınırından
 *  bölünen bir satır, yarım UTF-8 karakter, `FIN` gelmesiyle kopan uçuştaki
 *  istek, ve cihazın bir bağlantıda istekleri serileştirmesi. Bir mock bunların
 *  hiçbirini üretmez ve hepsi yeşil geçer.
 *
 *  ## Cihaz davranışının taklit edilen kısmı
 *
 *  `BridgeTcpServer.serve()` bir bağlantıda `readLine → handle → write`
 *  döngüsüdür. Bu fake AYNI şeyi yapar: bir bağlantıdaki istekler SIRAYLA
 *  işlenir. Bu, testlerin "iptal aynı sokette çalışmaz" gerçeğini gerçekten
 *  gözlemesini sağlar — paralel işleyen bir fake bunu gizlerdi ve host tasarımı
 *  gerçek cihazda çökerdi.
 *
 *  `ProtocolV1` gibi handshake zorunluluğu, run fencing ve requestId dedupe de
 *  taklit edilir; aksi halde host'un o yollardaki davranışı hiç sınanmaz.
 * ===========================================================================
 */
import { createServer, type Server, type Socket } from "node:net";
import { StringDecoder } from "node:string_decoder";

import {
  BRIDGE_COMMANDS,
  BRIDGE_LIMITS,
  BRIDGE_PROTOCOL_VERSION,
  isBridgeCommand,
} from "@nesy/bridge-contract";

/** Bir isteğe verilecek programlanmış davranış. */
export interface FakeBehaviour {
  /** Yanıtı geciktir (uzun `wait_node` taklidi). */
  delayMs?: number;
  /** Yanıt alanları. `ok` verilmezse `true` kabul edilir. */
  fields?: Record<string, unknown>;
  ok?: boolean;
  error?: string;
  /** Yanıt yerine soketi kopar — uçuştaki istek sınıflandırması testi. */
  dropConnection?: boolean;
  /** Geçerli JSON olmayan bir satır yaz. */
  malformed?: boolean;
  /** Yanıtı N parçaya bölerek yaz — artımlı parser testi. */
  splitIntoChunks?: number;
  /** Aynı yanıtı iki kez yaz — duplicate terminal testi. */
  duplicate?: boolean;
  /** Yanıtı yanlış bir requestId ile yaz — sıra dışı yanıt testi. */
  respondWithRequestId?: string;
  /** İstenmemiş bir frame gönder (push simülasyonu; host reddetmeli). */
  emitUnsolicited?: boolean;
  /** Sınırı aşan bir satır yaz. */
  oversizedBytes?: number;
}

export interface FakeBridgeOptions {
  /** Komut adına göre davranış. Yoksa `ok: true` döner. */
  behaviours?: Partial<Record<string, FakeBehaviour>>;
  /** `handshake` olmadan gelen komutu `handshake_required` ile reddet. */
  enforceHandshake?: boolean;
  /** Run fencing uygula: farklı epoch/run `stale_run` alır. */
  enforceFencing?: boolean;
  /** Process-wide active scope, mirroring ProtocolV1's stale_run handoff rule. */
  activeScope?: FakeScope;
}

interface FakeScope {
  runId: string;
  sessionId: string;
  runEpoch: number;
}

interface FakeSession {
  scope: FakeScope | null;
}

function stripEnvelopeFields(request: Record<string, unknown>): Record<string, unknown> {
  const params = { ...request };
  delete params.requestId;
  delete params.protocolVersion;
  delete params.command;
  delete params.runId;
  delete params.sessionId;
  delete params.runEpoch;
  return params;
}

export class FakeBridgeServer {
  private server: Server | null = null;
  private readonly sockets = new Set<Socket>();
  private readonly seen = new Map<string, string>();
  /** Gözlemlenen istekler — testler sıralamayı ve içeriği doğrulayabilsin. */
  readonly received: { command: string; requestId: string; params: Record<string, unknown> }[] = [];
  /** Aynı anda açık bağlantı sayısının zirvesi — havuz iddiasını kanıtlar. */
  peakConnections = 0;
  private activeScope: FakeScope | null;

  constructor(private readonly options: FakeBridgeOptions = {}) {
    this.activeScope = options.activeScope ?? null;
  }

  async listen(): Promise<number> {
    const server = createServer((socket) => this.onConnection(socket));
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      // Port 0: işletim sistemi boş port verir. Sabit port kullanmak, paralel
      // test dosyalarının birbirinin portunu çalmasına yol açar.
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("fake bridge did not bind a TCP port");
    }
    return address.port;
  }

  private onConnection(socket: Socket): void {
    this.sockets.add(socket);
    this.peakConnections = Math.max(this.peakConnections, this.sockets.size);
    socket.on("close", () => this.sockets.delete(socket));
    socket.on("error", () => this.sockets.delete(socket));

    const session: FakeSession = { scope: null };
    const decoder = new StringDecoder("utf8");
    let buffer = "";
    /**
     * Bağlantı başına SIRALI işleme kuyruğu.
     *
     * Cihazın `serve()` döngüsünün taklidi. Paralel işlemek, host'un "uzun
     * bekleme aynı sokette iptali bloke eder" gerçeğini görmesini engellerdi.
     */
    let chain: Promise<void> = Promise.resolve();

    socket.on("data", (chunk: Buffer) => {
      buffer += decoder.write(chunk);
      for (;;) {
        const newlineAt = buffer.indexOf("\n");
        if (newlineAt === -1) break;
        const line = buffer.slice(0, newlineAt);
        buffer = buffer.slice(newlineAt + 1);
        if (line.trim() === "") continue;
        chain = chain.then(() => this.handle(socket, session, line));
      }
    });
  }

  private async handle(socket: Socket, session: FakeSession, line: string): Promise<void> {
    let request: Record<string, unknown>;
    try {
      request = JSON.parse(line) as Record<string, unknown>;
    } catch {
      this.write(socket, { ok: false, requestId: null, error: "invalid_json" });
      return;
    }

    const requestId = typeof request.requestId === "string" ? request.requestId : "";
    if (requestId === "") {
      this.write(socket, { ok: false, requestId: null, error: "missing_request_id" });
      return;
    }
    if (request.protocolVersion !== BRIDGE_PROTOCOL_VERSION) {
      this.write(socket, {
        ok: false,
        requestId,
        error: "unsupported_protocol_version",
        requestedProtocolVersion: request.protocolVersion,
      });
      return;
    }
    const command = typeof request.command === "string" ? request.command : "";
    if (command === "") {
      this.write(socket, { ok: false, requestId, error: "missing_command" });
      return;
    }
    if (!isBridgeCommand(command)) {
      this.write(socket, { ok: false, requestId, error: "unsupported_command", command });
      return;
    }

    const scope = {
      runId: String(request.runId ?? ""),
      sessionId: String(request.sessionId ?? ""),
      runEpoch: Number(request.runEpoch ?? 0),
    };

    if (command === "handshake") {
      if (this.options.enforceFencing === true && this.activeScope !== null) {
        const expected = this.activeScope;
        const sameScope =
          scope.runEpoch === expected.runEpoch &&
          scope.runId === expected.runId &&
          scope.sessionId === expected.sessionId;
        if (!sameScope && scope.runEpoch <= expected.runEpoch) {
          this.write(socket, {
            ok: false,
            requestId,
            error:
              scope.runId === expected.runId &&
              scope.runEpoch === expected.runEpoch &&
              scope.sessionId !== expected.sessionId
                ? "wrong_session"
                : "stale_run",
            expectedRunId: expected.runId,
            expectedSessionId: expected.sessionId,
            expectedRunEpoch: expected.runEpoch,
          });
          return;
        }
      }
      this.activeScope = scope;
      session.scope = scope;
    } else if (this.options.enforceHandshake === true && session.scope === null) {
      this.write(socket, { ok: false, requestId, error: "handshake_required" });
      return;
    } else if (this.options.enforceFencing === true && session.scope !== null) {
      const expected = session.scope;
      if (scope.runEpoch !== expected.runEpoch || scope.runId !== expected.runId) {
        this.write(socket, {
          ok: false,
          requestId,
          error: "stale_run",
          expectedRunId: expected.runId,
          expectedSessionId: expected.sessionId,
          expectedRunEpoch: expected.runEpoch,
        });
        return;
      }
      if (scope.sessionId !== expected.sessionId) {
        this.write(socket, {
          ok: false,
          requestId,
          error: "wrong_session",
          expectedRunId: expected.runId,
          expectedSessionId: expected.sessionId,
          expectedRunEpoch: expected.runEpoch,
        });
        return;
      }
    }

    const params = stripEnvelopeFields(request);
    this.received.push({ command, requestId, params });

    // Cihazın requestId dedupe'u: aynı id + farklı payload = çakışma.
    const fingerprint = JSON.stringify(params);
    const previous = this.seen.get(`${scope.runId}|${requestId}`);
    if (previous !== undefined && previous !== fingerprint) {
      this.write(socket, { ok: false, requestId, error: "request_id_conflict" });
      return;
    }
    this.seen.set(`${scope.runId}|${requestId}`, fingerprint);

    const behaviour = this.options.behaviours?.[command] ?? {};
    const defaultCapabilityFields =
      command === "capabilities" && behaviour.fields === undefined
        ? {
            commands: [...BRIDGE_COMMANDS],
            supportsWaitAny: true,
            supportsCancelRequest: true,
            supportsUnsolicitedPush: false,
            limits: { ...BRIDGE_LIMITS },
          }
        : undefined;

    if (behaviour.delayMs !== undefined && behaviour.delayMs > 0) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, behaviour.delayMs);
        if (typeof timer.unref === "function") timer.unref();
      });
    }

    if (behaviour.dropConnection === true) {
      socket.destroy();
      return;
    }
    if (behaviour.malformed === true) {
      socket.write("{ this is not json\n");
      return;
    }
    if (behaviour.oversizedBytes !== undefined) {
      socket.write(`${"x".repeat(behaviour.oversizedBytes)}\n`);
      return;
    }
    if (behaviour.emitUnsolicited === true) {
      // Protocol v1'de push YOK; host bunu reddetmeli, yutmamalı.
      socket.write(`${JSON.stringify({ ok: true, event: "node_appeared", monoTs: 1 })}\n`);
    }

    const payload = {
      ok: behaviour.ok ?? true,
      requestId: behaviour.respondWithRequestId ?? requestId,
      ...(behaviour.error === undefined ? {} : { error: behaviour.error }),
      ...(defaultCapabilityFields ?? {}),
      ...(behaviour.fields ?? {}),
    };

    this.write(socket, payload, behaviour.splitIntoChunks);
    if (behaviour.duplicate === true) this.write(socket, payload);
  }

  private write(socket: Socket, payload: Record<string, unknown>, splitIntoChunks?: number): void {
    if (socket.destroyed) return;
    const line = `${JSON.stringify({
      monoTs: Date.now() % 1_000_000,
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      ...payload,
    })}\n`;

    if (splitIntoChunks === undefined || splitIntoChunks <= 1) {
      socket.write(line);
      return;
    }
    // Satırı parçalara bölerek yaz: artımlı parser'ın gerçekten artımlı
    // olduğunu kanıtlar. `split("\n")` ile yazılmış bir parser burada patlar.
    const size = Math.ceil(line.length / splitIntoChunks);
    for (let i = 0; i < line.length; i += size) {
      socket.write(line.slice(i, i + size));
    }
  }

  async close(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    this.sockets.clear();
    const server = this.server;
    this.server = null;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
