/**
 * ===========================================================================
 *  AKSİYON YAŞAM DÖNGÜSÜ  (Plan D.3 · D.4)
 *
 *  Bir fiziksel aksiyonun "oldu mu?" sorusu iki değerli değildir. Üç değerlidir:
 *  oldu, olmadı, ve **bilinmiyor**. Üçüncüsünü modellemeyen her sistem onu
 *  ikinciye yuvarlar ("cevap gelmedi → başarısız") ve sonra retry eder — yani
 *  gerçekte gerçekleşmiş bir onayı ikinci kez gönderir.
 *
 *  Bu yüzden terminal durumlar arasında `UNKNOWN_EFFECT` birinci sınıf bir
 *  vatandaştır ve ondan otomatik retry YOKTUR.
 * ===========================================================================
 */
import type { BridgeActionMethod, BridgeCommand } from "./protocol.js";
import type { TargetFingerprint, TargetResolutionEvidence } from "./targets.js";

/**
 * Yaşam döngüsü aşamaları.
 *
 * `ACCEPTED` host'un kabulü (hedef doğrulandı), `DISPATCHED` tele yazıldı,
 * `GESTURE_STARTED`/`GESTURE_COMPLETED` cihazın jest pencereleri, `OBSERVED`
 * aksiyon sonrası ağacın yeniden okunduğu an.
 *
 * Aşamaların ayrı tutulması teşhis içindir: "dispatched ama gesture hiç
 * başlamadı" ile "gesture tamamlandı ama observed değişmedi" bambaşka iki
 * arızadır ve tek bir `failed` bayrağı ikisini ayırt edemez.
 */
export type BridgeActionPhase =
  | "ACCEPTED"
  | "DISPATCHED"
  | "GESTURE_STARTED"
  | "GESTURE_COMPLETED"
  | "OBSERVED";

/**
 * Terminal durumlar.
 *
 * `UNKNOWN_EFFECT` neden ayrı: cihaz yanıtı kaybolduğunda etki gerçekleşmiş de
 * olabilir. Bunu `FAILED` saymak, retry'ı meşrulaştırır ve çift etki üretir.
 * `REJECTED` ise aksiyonun cihaza HİÇ gitmediğini söyler — host hedefi
 * reddetti; burada retry güvenlidir çünkü hiçbir şey olmadı.
 */
export type BridgeActionTerminalState =
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN_EFFECT"
  | "REJECTED"
  | "CANCELLED";

export const BRIDGE_ACTION_TERMINAL_STATES: readonly BridgeActionTerminalState[] = [
  "SUCCEEDED",
  "FAILED",
  "UNKNOWN_EFFECT",
  "REJECTED",
  "CANCELLED",
];

/** Bu terminal durumdan sonra aynı aksiyon otomatik tekrarlanabilir mi? */
export function mayAutoRetry(state: BridgeActionTerminalState): boolean {
  // Yalnız "hiç olmadığı kesin" olan durumlar. UNKNOWN_EFFECT kasıtlı olarak
  // dışarıda: etki olmuş olabilir ve tekrar göndermek çift etki demektir.
  return state === "REJECTED";
}

/**
 * Etkileşimin kaynağı.
 *
 * `MANUAL` bir ÜRÜN HATASI DEĞİLDİR: koşu sırasında birinin ekrana dokunması
 * kanıtı kirletir ama uygulamanın bozuk olduğunu göstermez. Ayrı tutulmazsa,
 * elle yapılmış bir dokunuş "SDK click üretmedi" diye raporlanır.
 */
export type BridgeInteractionOrigin = "BRIDGE_INJECTED" | "MANUAL" | "UNKNOWN";

/** Cihazın monotonik saatiyle işaretlenmiş bir aşama. */
export interface BridgeActionMarker {
  phase: BridgeActionPhase;
  /** `SystemClock.elapsedRealtime()` — duvar saati değil. */
  monoTs: number;
}

/**
 * Bir aksiyonun tam kanıt kaydı.
 *
 * `requestId` ve `fingerprint` zorunlu: aksiyonu sonradan "hangi hedefe, hangi
 * istekle" diye eşlemenin başka yolu yok.
 */
export interface BridgeActionRecord {
  requestId: string;
  command: BridgeCommand;
  method: BridgeActionMethod | null;
  fingerprint: TargetFingerprint;
  resolution: TargetResolutionEvidence | null;
  origin: BridgeInteractionOrigin;
  markers: readonly BridgeActionMarker[];
  terminalState: BridgeActionTerminalState | null;
  /** Cihaz hata kodu veya host hata kodu. */
  error?: string;
  /** Cihazın bildirdiği ağaç nesli (aksiyon anında). */
  treeGen?: number;
}

/**
 * Yaşam döngüsünü biriktiren, geçişleri zorlayan kayıt defteri.
 *
 * Sınıf olması şart değildi; ama terminal durumun BİR KEZ yazılmasını ve
 * terminal sonrası aşama eklenememesini tipin dışında zorlamanın başka yolu
 * yok. "İki kez terminal" hatası sessizdir: ikinci yazım birinciyi ezer ve
 * kanıt kaybolur.
 */
export class BridgeActionLifecycle {
  private readonly markers: BridgeActionMarker[] = [];
  private terminal: BridgeActionTerminalState | null = null;
  private errorCode: string | undefined;
  private resolution: TargetResolutionEvidence | null = null;
  private method: BridgeActionMethod | null = null;
  private treeGen: number | undefined;

  constructor(
    readonly requestId: string,
    readonly command: BridgeCommand,
    readonly fingerprint: TargetFingerprint,
    readonly origin: BridgeInteractionOrigin = "BRIDGE_INJECTED",
  ) {}

  mark(phase: BridgeActionPhase, monoTs: number): this {
    if (this.terminal !== null) {
      throw new Error(
        `action ${this.requestId} already terminal (${this.terminal}); cannot record ${phase}`,
      );
    }
    this.markers.push({ phase, monoTs });
    return this;
  }

  withResolution(evidence: TargetResolutionEvidence): this {
    this.resolution = evidence;
    if (evidence.treeGen !== undefined) this.treeGen = evidence.treeGen;
    return this;
  }

  withMethod(method: BridgeActionMethod): this {
    this.method = method;
    return this;
  }

  /** Terminal durumu bir kez yazar. İkinci çağrı bir programlama hatasıdır. */
  finish(state: BridgeActionTerminalState, error?: string): BridgeActionRecord {
    if (this.terminal !== null) {
      throw new Error(
        `action ${this.requestId} already terminal (${this.terminal}); refusing to overwrite with ${state}`,
      );
    }
    this.terminal = state;
    this.errorCode = error;
    return this.snapshot();
  }

  isTerminal(): boolean {
    return this.terminal !== null;
  }

  snapshot(): BridgeActionRecord {
    return {
      requestId: this.requestId,
      command: this.command,
      method: this.method,
      fingerprint: this.fingerprint,
      resolution: this.resolution,
      origin: this.origin,
      markers: [...this.markers],
      terminalState: this.terminal,
      ...(this.errorCode === undefined ? {} : { error: this.errorCode }),
      ...(this.treeGen === undefined ? {} : { treeGen: this.treeGen }),
    };
  }

  /**
   * Jest süresi — yalnız iki marker da varsa.
   *
   * Elle dokunuş kirlenmesini ayırt etmek için gerekli: enjekte edilmiş jestin
   * penceresi bilinmiyorsa, o pencerede olan bir dokunuşun bizden mi geldiği
   * söylenemez.
   */
  injectedGestureWindow(): { startMonoTs: number; endMonoTs: number } | null {
    const start = this.markers.find((m) => m.phase === "GESTURE_STARTED");
    const end = this.markers.find((m) => m.phase === "GESTURE_COMPLETED");
    if (!start || !end) return null;
    return { startMonoTs: start.monoTs, endMonoTs: end.monoTs };
  }
}

/**
 * Bir dokunuşun enjekte edilmiş jest penceresine düşüp düşmediğine bakar.
 *
 * Pencere bilinmiyorsa `UNKNOWN` döner — `MANUAL` DEĞİL. "Bizden geldiğini
 * kanıtlayamıyorum" ile "kullanıcı dokundu" arasındaki fark, birinin
 * suçlanması gereken yeri değiştirir.
 */
export function classifyInteractionOrigin(
  touchMonoTs: number,
  window: { startMonoTs: number; endMonoTs: number } | null,
): BridgeInteractionOrigin {
  if (!window) return "UNKNOWN";
  return touchMonoTs >= window.startMonoTs && touchMonoTs <= window.endMonoTs
    ? "BRIDGE_INJECTED"
    : "MANUAL";
}
