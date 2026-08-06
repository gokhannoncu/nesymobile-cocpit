/**
 * ===========================================================================
 *  DEVICE COMMAND ADMISSION  (Plan D.3 · C.42)
 *
 *  Bir cihaz tek bir fiziksel kaynaktır. İki mutation aynı anda gönderilirse
 *  hangi jestin hangi ekrana denk geldiği ARTIK BİLİNEMEZ — ve hiçbir yerde
 *  hata çıkmaz, çünkü her iki tap da "başarılı" döner.
 *
 *  Bu dosya lane sözleşmesidir; zamanlayıcının kendisi
 *  `apps/api/src/services/bridge-admission.ts` içindedir. Ayrı olmalarının
 *  nedeni: lane kararı bir SÖZLEŞMEdir (hangi komut hangi kuyruğa) ve
 *  zamanlayıcı bir RUNTIME'dır (kim ne zaman koşar). Sözleşmeyi contract
 *  paketinde tutmak, ileride başka bir zamanlayıcının aynı kuralları
 *  yeniden yorumlamasını engeller.
 * ===========================================================================
 */
import type { BridgeCommand } from "./protocol.js";
import { BRIDGE_HEAVY_COMMANDS, isMutationCommand, isWaitCommand } from "./protocol.js";

/**
 * Lane'ler.
 *
 * `CONTROL` en yüksek öncelikli ve ASLA aç bırakılamaz: iptal ve acil durdurma
 * bu lane'dedir. Uzun bir bekleme iptali geciktirirse, iptal etmenin bir anlamı
 * kalmaz.
 *
 * `MUTATION` tek şeritlidir — cihaz başına bir fiziksel aksiyon (C.42).
 *
 * `HEAVY_OBS` ayrı: `screenshot`/`dump` yanıtları büyüktür ve bekleme hattıyla
 * aynı kotayı paylaşırlarsa tek bir teşhis çekimi bütün bekleyişleri geciktirir.
 */
export type AdmissionLane = "CONTROL" | "OBSERVATION" | "WAIT" | "MUTATION" | "HEAVY_OBS";

export const ADMISSION_LANES: readonly AdmissionLane[] = [
  "CONTROL",
  "OBSERVATION",
  "WAIT",
  "MUTATION",
  "HEAVY_OBS",
];

/** Büyük olan önce koşar. `CONTROL` starvation'ı bu sıralamayla imkânsızdır. */
export const LANE_PRIORITY: Readonly<Record<AdmissionLane, number>> = {
  CONTROL: 100,
  WAIT: 60,
  OBSERVATION: 50,
  MUTATION: 40,
  HEAVY_OBS: 10,
};

/**
 * Lane başına eşzamanlılık sınırı.
 *
 * `MUTATION: 1` bu dosyanın en önemli satırıdır ve gevşetilemez.
 *
 * `WAIT: 4` çoklu bacak yarışını mümkün kılar (`RACED_WAIT_NODE` her bacak için
 * ayrı bağlantı ister). Sınırsız olsaydı geniş bir plan cihazda onlarca
 * eşzamanlı bekleme açardı.
 *
 * `HEAVY_OBS: 1` — iki base64 PNG'yi aynı anda çekmek bellek ve soket
 * açısından hiçbir şey kazandırmaz.
 */
export const LANE_CONCURRENCY: Readonly<Record<AdmissionLane, number>> = {
  CONTROL: 4,
  OBSERVATION: 3,
  WAIT: 4,
  MUTATION: 1,
  HEAVY_OBS: 1,
};

/**
 * Komutu lane'ine yerleştirir.
 *
 * `heavy` bayrağı çağırandan gelir: `dump` bir depth-1 scoped okuma da olabilir
 * (hafif), full tree de olabilir (ağır). Aynı komut adının iki farklı maliyeti
 * olduğu için karar çağırana bırakıldı; ama `screenshot` her zaman ağırdır.
 */
export function laneForCommand(command: BridgeCommand, heavy = false): AdmissionLane {
  if (
    command === "ping" ||
    command === "handshake" ||
    command === "capabilities" ||
    command === "cancel_request"
  ) {
    return "CONTROL";
  }
  if (isMutationCommand(command)) return "MUTATION";
  if (isWaitCommand(command)) return "WAIT";
  if (command === "screenshot") return "HEAVY_OBS";
  if (heavy && BRIDGE_HEAVY_COMMANDS.has(command)) return "HEAVY_OBS";
  return "OBSERVATION";
}

/**
 * Admission zarfı — zamanlayıcıya verilen istek.
 *
 * `actorKind` neden var: aktif bir koşu sırasında Inspector'ın (insan aracı)
 * mutation göndermesi fail-closed reddedilir (C.42). Aktörü taşımayan bir
 * istek, o kararı vermeyi imkânsız kılar.
 */
export interface DeviceCommandAdmissionEnvelope {
  deviceId: string;
  command: BridgeCommand;
  lane: AdmissionLane;
  requestId: string;
  runId?: string;
  actorKind: AdmissionActorKind;
  /** Açık devralma: insan aracı aktif koşuyu bilinçli olarak devraldı. */
  takeover?: boolean;
}

/**
 * İsteği kim gönderiyor.
 *
 * `AUTOMATED_RUN` bir workflow koşusu; `INSPECTOR` bir insanın açtığı araç;
 * `SYSTEM` heartbeat/iptal gibi altyapı.
 */
export type AdmissionActorKind = "AUTOMATED_RUN" | "INSPECTOR" | "SYSTEM";

export type AdmissionDecision =
  | { admitted: true; lane: AdmissionLane }
  | {
      admitted: false;
      reason: "ACTIVE_RUN_MUTATION_LOCK" | "DEVICE_NOT_READY";
      detail: string;
      /** Açık devralma ile aşılabilir mi? */
      overridable: boolean;
    };

/**
 * Inspector'ın aktif koşu sırasında mutation göndermesini reddeder.
 *
 * Neden fail-closed: bir koşu ekranı sürerken elle yapılan bir tap, koşunun
 * kanıtını sessizce kirletir. Sonuç "uygulama yanlış davrandı" diye raporlanır,
 * oysa iki aktör aynı ekranda yarışmıştır. Devralma mümkündür ama AÇIK olmak
 * zorundadır ve denetim kaydına yazılır.
 */
export function admitDeviceCommand(
  envelope: DeviceCommandAdmissionEnvelope,
  state: { activeRunId: string | null; deviceReady: boolean },
): AdmissionDecision {
  if (!state.deviceReady) {
    return {
      admitted: false,
      reason: "DEVICE_NOT_READY",
      detail: "device preflight has not passed; no command may be sent",
      overridable: false,
    };
  }

  const wantsMutation = envelope.lane === "MUTATION";
  const foreignRunActive =
    state.activeRunId !== null && envelope.runId !== undefined && envelope.runId !== state.activeRunId;

  if (
    wantsMutation &&
    envelope.actorKind === "INSPECTOR" &&
    state.activeRunId !== null &&
    envelope.takeover !== true
  ) {
    return {
      admitted: false,
      reason: "ACTIVE_RUN_MUTATION_LOCK",
      detail:
        `run ${state.activeRunId} owns the mutation lane on ${envelope.deviceId}; ` +
        "an Inspector tap here would contaminate that run's evidence and be reported as an app fault",
      overridable: true,
    };
  }

  if (wantsMutation && envelope.actorKind === "AUTOMATED_RUN" && foreignRunActive) {
    return {
      admitted: false,
      reason: "ACTIVE_RUN_MUTATION_LOCK",
      detail: `run ${state.activeRunId} owns ${envelope.deviceId}; run ${String(envelope.runId)} cannot mutate concurrently`,
      // Başka bir otomatik koşu devralamaz: devralma insan kararıdır.
      overridable: false,
    };
  }

  return { admitted: true, lane: envelope.lane };
}

/**
 * Mutation sonrası geçersiz kılınması gereken okuma durumu.
 *
 * Bir tap ağacı değiştirir; ondan önce alınmış `nodeRef`/`treeGen` artık
 * güvenilmez. Geçersiz kılmamak, bir sonraki aksiyonun eski ağaca göre
 * çözümlenip `stale_tree` (iyi durum) veya yanlış node'a dokunma (kötü durum)
 * üretmesi demektir.
 */
export interface PostMutationInvalidation {
  invalidateTreeGen: true;
  /** Bekleyen wait'ler yeniden değerlendirilmeli — mutation koşulu sağlamış olabilir. */
  reevaluateWaits: true;
}

export const POST_MUTATION_INVALIDATION: PostMutationInvalidation = {
  invalidateTreeGen: true,
  reevaluateWaits: true,
};
