/**
 * ===========================================================================
 *  BRIDGE HOST CLIENT  (Plan D.3 · D.4)
 *
 *  ## Tek bağlantı YETMEZ — ve bu bir tercih değil, cihazın dayattığı bir gerçek
 *
 *  `BridgeTcpServer.serve()` bir bağlantı için şu döngüdür:
 *
 *      while (running) { val request = reader.readLine() ?: break
 *                        writer.write(protocol.handle(request, session)) ... }
 *
 *  Yani bir bağlantıda istekler SIRAYLA işlenir. 60 saniyelik bir `wait_node`
 *  o bağlantının reader'ını 60 saniye bloke eder; aynı sokete yazılan ikinci
 *  bir satır okunmaz. Sonuçları:
 *
 *    - İptal aynı sokette İMKÂNSIZDIR (cihazda `cancel_request` olsa bile).
 *    - Paralel `wait_node` bacakları aynı sokette YARIŞMAZ, sıraya dizilir —
 *      "yarış" sessizce ardışık beklemeye döner ve süre iki katına çıkar.
 *
 *  Bu yüzden client bağlantı HAVUZU tutar: her eşzamanlı uzun istek kendi
 *  soketini alır, ve CONTROL istekleri (ping/iptal) ayrı bir sokette gider.
 *  Cihaz çoklu bağlantıyı destekler (`clientExecutor` cached pool) ve
 *  `ProtocolV1` durumu process genelinde paylaşılır, bu yüzden handshake bir
 *  soketten yapıldığında oturum kapsamı diğerleri için de geçerlidir —
 *  ama her yeni soket kendi `Session`'ını aldığı için handshake SOKET BAŞINA
 *  tekrarlanmak zorundadır (`session.scope` per-connection).
 *
 *  ## Bağlantı kaybının sınıflandırılması hayatidir
 *
 *  Uçuşta bir istek varken soket koparsa, "ne olduğu" isteğin TÜRÜNE bağlıdır:
 *
 *    - mutation  → `UNKNOWN_EFFECT`. Etki gerçekleşmiş olabilir. Retry YASAK.
 *    - wait      → `WAIT_CONNECTION_LOST`. Koşul sağlanmış olabilir, etki yok.
 *    - read-only → retry edilebilir.
 *
 *  Üçünü tek bir "connection error" altında toplamak, bir onay tuşuna ikinci
 *  kez basmakla sonuçlanır.
 * ===========================================================================
 */
import { Socket } from "node:net";

import {
  BRIDGE_MAX_FRAME_BYTES,
  BRIDGE_PROTOCOL_VERSION,
  decodeResult,
  capabilityManifestFromDeviceResponse,
  deriveCapabilityManifest,
  encodeCommand,
  isMutationCommand,
  isWaitCommand,
  redactForLog,
  type BridgeCapabilityManifest,
  type BridgeCommand,
  type BridgeCommandEnvelope,
  type BridgeHostErrorCode,
  type BridgeResultEnvelope,
  type BridgeRunScope,
} from "@nesy/bridge-contract";

import { NdjsonParser } from "./ndjson.js";

/** Host tarafı hata — cihazın söylediğinden ayırt edilebilir olmak zorunda. */
export class BridgeHostError extends Error {
  constructor(
    readonly code: BridgeHostErrorCode,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "BridgeHostError";
  }
}

export interface BridgeClientOptions {
  host: string;
  port: number;
  scope: BridgeRunScope;
  /** İstek başına varsayılan zaman aşımı. */
  defaultTimeoutMs?: number;
  /** Eşzamanlı soket üst sınırı. Bekleme bacakları + control için yeterli olmalı. */
  maxConnections?: number;
  connectTimeoutMs?: number;
  /**
   * Tek NDJSON satırı için üst sınır.
   *
   * Yapılandırılabilir olması gerekli: `screenshot` taşıyan bir bağlantı
   * megabaytlara ihtiyaç duyar, ama sadece `wait_node` koşan bir bağlantı için
   * çok daha sıkı bir sınır doğru savunmadır — bozuk bir akış orada belleği
   * büyütmeden reddedilir.
   */
  maxFrameBytes?: number;
  logger?: (message: string) => void;
  now?: () => number;
}

export interface BridgeRequest {
  command: BridgeCommand;
  requestId: string;
  params?: Record<string, unknown>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /**
   * CONTROL isteği: uzun beklemelerin arkasında kuyruğa girmemesi gerekir.
   *
   * Ayrı bir bayrak olarak var çünkü `ping` normalde CONTROL'dür ama bir
   * teşhis akışında sıradan bir observation olarak da gönderilebilir; kararı
   * çağırana bırakmak, "iptal neden 40 saniye bekledi" sorusunu imkânsız kılar.
   */
  control?: boolean;
}

interface PendingRequest {
  requestId: string;
  command: BridgeCommand;
  resolve: (envelope: BridgeResultEnvelope) => void;
  reject: (error: BridgeHostError) => void;
  timer: ReturnType<typeof setTimeout>;
  onAbort?: () => void;
  signal?: AbortSignal;
}

/**
 * Tek bir TCP bağlantısı ve üzerindeki en fazla bir uçuşta istek.
 *
 * "En fazla bir" cihazın serileştirmesinden gelir: ikinci isteği aynı sokete
 * yazmak onu kuyruğa alır, paralelleştirmez.
 */
class BridgeConnection {
  private socket: Socket | null = null;
  private parser: NdjsonParser | null = null;
  private pending: PendingRequest | null = null;
  private handshaken = false;
  private closed = false;
  busy = false;

  constructor(
    readonly id: number,
    private readonly options: Required<
      Pick<BridgeClientOptions, "host" | "port" | "connectTimeoutMs" | "maxFrameBytes">
    > & {
      scope: BridgeRunScope;
      logger: (message: string) => void;
    },
  ) {}

  isHandshaken(): boolean {
    return this.handshaken;
  }

  isClosed(): boolean {
    return this.closed || this.socket === null;
  }

  async connect(): Promise<void> {
    if (this.socket) return;
    const socket = new Socket();
    socket.setNoDelay(true);

    const parser = new NdjsonParser({
      maxFrameBytes: this.options.maxFrameBytes,
      onLine: (line) => this.onLine(line),
      onOversized: (bytes) => {
        // Sessizce atmak teşhisi imkânsızlaştırır; ve uçuştaki istek bu
        // satırın yanıtıysa artık asla gelmeyecek, o yüzden hemen reddet.
        this.options.logger(`[BridgeClient#${this.id}] dropped oversized frame (${bytes} bytes)`);
        this.failPending(new BridgeHostError("FRAME_TOO_LARGE", `frame of ${bytes} bytes dropped`));
      },
    });

    await new Promise<void>((resolve, reject) => {
      const onConnectTimeout = setTimeout(() => {
        socket.destroy();
        reject(
          new BridgeHostError(
            "BRIDGE_UNAVAILABLE",
            `connect to ${this.options.host}:${this.options.port} timed out after ${this.options.connectTimeoutMs}ms`,
          ),
        );
      }, this.options.connectTimeoutMs);
      if (typeof onConnectTimeout.unref === "function") onConnectTimeout.unref();

      socket.once("error", (err: Error) => {
        clearTimeout(onConnectTimeout);
        reject(new BridgeHostError("BRIDGE_UNAVAILABLE", err.message));
      });
      socket.connect(this.options.port, this.options.host, () => {
        clearTimeout(onConnectTimeout);
        resolve();
      });
    });

    socket.on("data", (chunk: Buffer) => parser.push(chunk));
    socket.on("error", (err: Error) => this.onDisconnect(`socket error: ${err.message}`));
    socket.on("close", () => this.onDisconnect("socket closed"));

    this.socket = socket;
    this.parser = parser;
    this.closed = false;
  }

  /**
   * Handshake SOKET BAŞINA yapılır.
   *
   * `ProtocolV1.Session` bağlantıya özeldir (`session.scope`), bu yüzden yeni
   * bir soket handshake yapmadan komut gönderirse `handshake_required` alır —
   * process genelinde başka bir soket handshake yapmış olsa bile.
   */
  async ensureHandshake(send: (envelope: BridgeCommandEnvelope) => Promise<BridgeResultEnvelope>): Promise<void> {
    if (this.handshaken) return;
    const envelope: BridgeCommandEnvelope = {
      ...this.options.scope,
      requestId: `hs-${this.id}-${String(this.options.scope.runEpoch)}`,
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      command: "handshake",
    };
    const result = await send(envelope);
    if (!result.ok) {
      throw new BridgeHostError(
        "BRIDGE_UNAVAILABLE",
        `handshake rejected: ${String(result.error ?? "unknown")}`,
      );
    }
    this.handshaken = true;
  }

  write(envelope: BridgeCommandEnvelope, pending: PendingRequest): void {
    const socket = this.socket;
    if (!socket || this.closed) {
      // `writeAndAwait` timer/AbortSignal listener'ı kurduktan sonra buraya
      // düşebilir. Doğrudan `pending.reject` etmek promise'i kapatır ama timer
      // ve listener'ı temizlemez; uzun suite'te sessiz sızıntı olur. Pending'i
      // kısa süreliğine sahiplenip standart settle yolundan geçiriyoruz.
      this.pending = pending;
      this.busy = true;
      this.failPending(new BridgeHostError("BRIDGE_UNAVAILABLE", "connection is not open", pending.requestId));
      return;
    }
    this.pending = pending;
    this.busy = true;
    // Tek uçuşta istek olduğu için writer'ın serileştirilmesi yapıdan gelir:
    // araya başka bir NDJSON satırı giremez.
    socket.write(`${encodeCommand(envelope)}\n`);
  }

  private onLine(line: string): void {
    const decoded = decodeResult(line, this.options.maxFrameBytes);
    if (!decoded.ok) {
      this.options.logger(`[BridgeClient#${this.id}] refused frame: ${decoded.reason} — ${decoded.detail}`);
      if (decoded.reason === "MISSING_REQUEST_ID") {
        // ADRESSİZ frame. Protocol v1'de push YOK, bu yüzden reddedilir — ama
        // bekleyen MEŞRU isteği öldürmez. Öldürmek daha kötü bir hata olurdu:
        // cihazın gönderdiği alakasız bir satır, tamamlanmak üzere olan bir
        // tap'i "protokol ihlali" diye başarısız yapardı.
        return;
      }
      const code: BridgeHostErrorCode =
        decoded.reason === "FRAME_TOO_LARGE" ? "FRAME_TOO_LARGE" : "PROTOCOL_VIOLATION";
      // Bozuk/aşırı büyük satır, bekleyen isteğin yanıtı olma ihtimali yüksek;
      // onu süresiz bekletmek yerine açık hatayla reddet.
      this.failPending(new BridgeHostError(code, `${decoded.reason}: ${decoded.detail}`));
      return;
    }

    const pending = this.pending;
    if (!pending) {
      // İstenmemiş frame. Protocol v1'de push YOK, bu yüzden fail-closed:
      // yutmak, ileride yanlışlıkla eklenen bir push'u görünmez kılardı.
      this.options.logger(
        `[BridgeClient#${this.id}] refused unsolicited frame ${redactForLog(decoded.envelope)}`,
      );
      return;
    }
    if (decoded.envelope.requestId !== pending.requestId) {
      // Sıra dışı/eşleşmeyen yanıt. Cihaz istekleri serileştirdiği için bu
      // olmamalı; olduysa sözleşme ihlalidir ve isteği çözmek yanlış olur.
      this.options.logger(
        `[BridgeClient#${this.id}] response for ${String(decoded.envelope.requestId)} while awaiting ${pending.requestId}`,
      );
      this.failPending(
        new BridgeHostError(
          "PROTOCOL_VIOLATION",
          `out-of-order response: got ${String(decoded.envelope.requestId)}, awaiting ${pending.requestId}`,
          pending.requestId,
        ),
      );
      return;
    }

    this.settle(pending, () => pending.resolve(decoded.envelope));
  }

  /**
   * Bağlantı koptu — uçuştaki isteği TÜRÜNE göre sınıflandır.
   *
   * Bu fonksiyonun tamamı tek bir hatayı önlemek için var: kaybolan bir tap'i
   * "başarısız" sayıp tekrar göndermek.
   */
  private onDisconnect(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.parser?.end();
    const pending = this.pending;
    if (!pending) return;

    const code: BridgeHostErrorCode = isMutationCommand(pending.command)
      ? "UNKNOWN_EFFECT"
      : isWaitCommand(pending.command)
        ? "WAIT_CONNECTION_LOST"
        : "BRIDGE_UNAVAILABLE";

    this.failPending(
      new BridgeHostError(
        code,
        code === "UNKNOWN_EFFECT"
          ? `${pending.command} was in flight when the connection dropped (${reason}); ` +
            "the effect may or may not have happened — this must NOT be retried automatically"
          : `${pending.command} lost its connection (${reason})`,
        pending.requestId,
      ),
    );
  }

  private failPending(error: BridgeHostError): void {
    const pending = this.pending;
    if (!pending) return;
    this.settle(pending, () => pending.reject(error));
  }

  /** Her çıkış yolunda timer ve abort listener temizlenir — sızıntı bırakmaz. */
  private settle(pending: PendingRequest, deliver: () => void): void {
    clearTimeout(pending.timer);
    if (pending.onAbort && pending.signal) {
      pending.signal.removeEventListener("abort", pending.onAbort);
    }
    this.pending = null;
    this.busy = false;
    deliver();
  }

  /**
   * Uçuştaki isteği VERİLEN hata ile reddedip soketi kapatır.
   *
   * Sıra kritik ve bir hatanın bedelini ödeyerek öğrenildi: önce `destroy()`
   * çağırmak `onDisconnect` üzerinden isteği `WAIT_CONNECTION_LOST` ile
   * reddediyordu ve gerçek sebep (host timeout / iptal) SESSİZCE eziliyordu.
   * Bir teşhis okuyan kişi "soket koptu" görüyordu; oysa host beklemekten
   * vazgeçmişti. Önce doğru sebeple çöz, sonra kapat.
   */
  abortPending(error: BridgeHostError, reason: string): void {
    this.failPending(error);
    this.destroy(reason);
  }

  destroy(reason: string): void {
    this.onDisconnect(reason);
    this.socket?.destroy();
    this.socket = null;
    this.parser = null;
    this.handshaken = false;
  }

  hasPending(): boolean {
    return this.pending !== null;
  }
}

/**
 * Idempotency kaydı — aynı `requestId` ile aynı payload tekrar gönderilebilir,
 * farklı payload gönderilemez.
 *
 * Cihaz da bunu yapar (`request_id_conflict`, `CACHE_TTL_MS`), ama host tarafında
 * da tutulmasının nedeni teşhis: çakışmayı burada yakalamak hangi iki çağıranın
 * aynı id'yi kullandığını gösterir; cihazdan dönen kod ise yalnız "çakıştı" der.
 */
interface IdempotencyEntry {
  fingerprint: string;
  at: number;
}

export interface BridgeCommandOutcome {
  envelope: BridgeResultEnvelope;
  /** Aynı requestId ile daha önce gönderilmiş ve cihaz önbelleğinden dönmüş olabilir. */
  replayed: boolean;
}

export class BridgeClient {
  private readonly connections: BridgeConnection[] = [];
  private readonly idempotency = new Map<string, IdempotencyEntry>();
  private readonly host: string;
  private readonly port: number;
  private readonly scope: BridgeRunScope;
  private readonly defaultTimeoutMs: number;
  private readonly maxConnections: number;
  private readonly connectTimeoutMs: number;
  private readonly maxFrameBytes: number;
  private readonly logger: (message: string) => void;
  private readonly now: () => number;
  private nextConnectionId = 1;
  private disposed = false;
  private capabilities: BridgeCapabilityManifest | null = null;

  constructor(options: BridgeClientOptions) {
    this.host = options.host;
    this.port = options.port;
    this.scope = options.scope;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;
    // Bekleme bacakları + CONTROL için yeterli; cihazın accept backlog'u 4
    // olduğu için abartmak bağlantı reddine yol açar.
    this.maxConnections = options.maxConnections ?? 4;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 3_000;
    this.maxFrameBytes = options.maxFrameBytes ?? BRIDGE_MAX_FRAME_BYTES;
    this.logger = options.logger ?? (() => undefined);
    this.now = options.now ?? Date.now;
  }

  getCapabilities(): BridgeCapabilityManifest | null {
    return this.capabilities;
  }

  /**
   * Bağlantıyı açar, handshake yapar ve yetenek manifestini türetir.
   *
   * Tercih: cihaz `capabilities` yanıtı. Eski cihaz `unsupported_command`
   * dönerse protocol-version baseline'ına düşülür.
   */
  async connect(): Promise<BridgeCapabilityManifest> {
    const connection = await this.acquire(true);
    try {
      const pong = await this.dispatch(connection, {
        command: "ping",
        requestId: `ping-${String(this.now())}`,
        control: true,
      });
      if (!pong.envelope.ok) {
        throw new BridgeHostError("BRIDGE_UNAVAILABLE", `ping failed: ${String(pong.envelope.error)}`);
      }
      const caps = await this.dispatch(connection, {
        command: "capabilities",
        requestId: `capabilities-${String(this.now())}`,
        control: true,
      });
      if (caps.envelope.ok) {
        this.capabilities = capabilityManifestFromDeviceResponse(
          caps.envelope as unknown as Record<string, unknown>,
        );
      } else {
        this.capabilities = deriveCapabilityManifest(pong.envelope.protocolVersion);
      }
      return this.capabilities;
    } finally {
      connection.busy = false;
    }
  }

  /**
   * Bir komut gönderir.
   *
   * `control: true` olan istekler kendi bağlantısını alır ve uzun beklemelerin
   * arkasında kuyruğa GİRMEZ — CONTROL starvation'ı yapısal olarak imkânsız.
   */
  async send(request: BridgeRequest): Promise<BridgeCommandOutcome> {
    if (this.disposed) {
      throw new BridgeHostError("BRIDGE_UNAVAILABLE", "client disposed", request.requestId);
    }

    const fingerprint = JSON.stringify({
      command: request.command,
      params: request.params ?? {},
      scope: this.scope,
    });
    const previous = this.idempotency.get(request.requestId);
    if (previous && previous.fingerprint !== fingerprint) {
      // Cihaz da reddederdi; burada yakalamak HANGİ iki çağıranın aynı id'yi
      // kullandığını gösterir, cihazın kodu ise yalnız "çakıştı" der.
      throw new BridgeHostError(
        "PROTOCOL_VIOLATION",
        `requestId ${request.requestId} was already used with a different payload; ` +
          "reusing an id with different parameters is a conflict, not a retry",
        request.requestId,
      );
    }
    const replayed = previous !== undefined;
    this.idempotency.set(request.requestId, { fingerprint, at: this.now() });
    this.pruneIdempotency();

    const connection = await this.acquire(request.control === true);
    try {
      const outcome = await this.dispatch(connection, request);
      return { ...outcome, replayed };
    } finally {
      connection.busy = false;
    }
  }

  private async dispatch(
    connection: BridgeConnection,
    request: BridgeRequest,
  ): Promise<BridgeCommandOutcome> {
    await connection.ensureHandshake((envelope) => this.writeAndAwait(connection, envelope, this.defaultTimeoutMs));

    const envelope: BridgeCommandEnvelope = {
      ...this.scope,
      requestId: request.requestId,
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      command: request.command,
      ...(request.params === undefined ? {} : { params: request.params }),
    };
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    const result = await this.writeAndAwait(connection, envelope, timeoutMs, request.signal);
    return { envelope: result, replayed: false };
  }

  private writeAndAwait(
    connection: BridgeConnection,
    envelope: BridgeCommandEnvelope,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<BridgeResultEnvelope> {
    return new Promise<BridgeResultEnvelope>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new BridgeHostError("HOST_CANCELLED", "aborted before dispatch", envelope.requestId));
        return;
      }

      const timer = setTimeout(() => {
        // Host zaman aşımı cihaz zaman aşımından AYRI bir olaydır: cihaz hâlâ
        // çalışıyor olabilir. `abortPending` sebebi koruyarak kapatır.
        connection.abortPending(
          new BridgeHostError(
            "HOST_TIMEOUT",
            `${envelope.command} did not answer within ${timeoutMs}ms`,
            envelope.requestId,
          ),
          `host timeout after ${timeoutMs}ms`,
        );
      }, timeoutMs);
      if (typeof timer.unref === "function") timer.unref();

      const onAbort = () => {
        // İptal edilen istek soketi de bırakır: cihaz bir sonraki yanıtı
        // yazdığında onu eşleştirecek bekleyen istek olmayacak.
        connection.abortPending(
          new BridgeHostError("HOST_CANCELLED", "request aborted by caller", envelope.requestId),
          "host cancelled",
        );
      };
      if (signal) signal.addEventListener("abort", onAbort, { once: true });

      connection.write(envelope, {
        requestId: envelope.requestId,
        command: envelope.command,
        resolve,
        reject,
        timer,
        ...(signal === undefined ? {} : { signal, onAbort }),
      });
    });
  }

  /**
   * Serbest bir bağlantı bulur veya açar.
   *
   * `control` olan istek yeni bağlantı açmayı TERCİH eder: uzun beklemelerin
   * hepsi meşgulse iptalin sıraya girmesi, iptali anlamsız kılar.
   */
  private async acquire(control: boolean): Promise<BridgeConnection> {
    for (const connection of this.connections) {
      if (!connection.busy && !connection.isClosed()) {
        connection.busy = true;
        return connection;
      }
    }

    const reusable = this.connections.filter((c) => c.isClosed());
    for (const dead of reusable) {
      this.connections.splice(this.connections.indexOf(dead), 1);
    }

    if (this.connections.length >= this.maxConnections && !control) {
      // Bekleyip serbest kalanı almak yerine açıkça hata vermek kasıtlı:
      // sessiz kuyruk, "bu adım neden 40 saniye sürdü" sorusunu cevapsız
      // bırakır. Çağıran admission scheduler ile sıralamayı zaten yapıyor.
      throw new BridgeHostError(
        "BRIDGE_UNAVAILABLE",
        `all ${this.maxConnections} bridge connections are busy; queue at the admission layer, not here`,
      );
    }

    const connection = new BridgeConnection(this.nextConnectionId++, {
      host: this.host,
      port: this.port,
      connectTimeoutMs: this.connectTimeoutMs,
      maxFrameBytes: this.maxFrameBytes,
      scope: this.scope,
      logger: this.logger,
    });
    await connection.connect();
    connection.busy = true;
    this.connections.push(connection);
    return connection;
  }

  private pruneIdempotency(): void {
    // Cihazın penceresiyle aynı: daha uzun tutmak, cihazın çoktan unuttuğu bir
    // id'yi "replay" diye raporlamak olurdu.
    const cutoff = this.now() - 300_000;
    for (const [key, entry] of this.idempotency) {
      if (entry.at < cutoff) this.idempotency.delete(key);
    }
  }

  /** Açık bağlantı sayısı — sızıntı iddialarını test edilebilir kılar. */
  connectionCount(): number {
    return this.connections.filter((c) => !c.isClosed()).length;
  }

  /** Uçuşta istek kalıp kalmadığı — soket kapandıktan sonra 0 olmak ZORUNDA. */
  pendingCount(): number {
    return this.connections.filter((c) => c.hasPending()).length;
  }

  dispose(reason = "client disposed"): void {
    this.disposed = true;
    for (const connection of this.connections) connection.destroy(reason);
    this.connections.length = 0;
    this.idempotency.clear();
  }
}
