/**
 * ===========================================================================
 *  DEVICE COMMAND ADMISSION SCHEDULER  (Plan D.3 · C.42 · RUN_PLAY 3.7)
 *
 *  Lane sözleşmesi `@nesy/bridge-contract`tedir; burada olan onun ZAMANLAYICISI.
 *
 *  ## Bu dosyanın önlediği hata
 *
 *  Aynı cihaza iki `tap` eşzamanlı gönderildiğinde hangi jestin hangi ekrana
 *  denk geldiği ARTIK BİLİNEMEZ — ve her iki tap da "ok" döner. Test yeşil
 *  kalır, kanıt yanlıştır. `MUTATION` şeridinin eşzamanlılığı 1'dir ve bu sayı
 *  bir ayar değil, bir invariant.
 *
 *  ## Neden öncelikli kuyruk, neden basit FIFO değil
 *
 *  Uzun bir bekleme kuyrukta önde duruyorsa, arkasındaki `ping`/iptal onun
 *  bitmesini bekler. İptalin geciktiği bir sistemde iptal etmenin anlamı
 *  yoktur. `CONTROL` en yüksek öncelikte ve kendi eşzamanlılık bütçesinde;
 *  starvation yapısal olarak imkânsız.
 * ===========================================================================
 */
import {
  LANE_CONCURRENCY,
  LANE_PRIORITY,
  POST_MUTATION_INVALIDATION,
  admitDeviceCommand,
  isMutationCommand,
  type AdmissionDecision,
  type AdmissionLane,
  type DeviceCommandAdmissionEnvelope,
} from "@nesy/bridge-contract";

export interface AdmissionTask<T> {
  envelope: DeviceCommandAdmissionEnvelope;
  run: () => Promise<T>;
}

interface QueuedTask {
  lane: AdmissionLane;
  priority: number;
  /** Aynı öncelikte FIFO'yu korumak için — starvation'ın diğer yarısı. */
  sequence: number;
  start: () => void;
}

export class AdmissionRejectedError extends Error {
  constructor(readonly decision: Extract<AdmissionDecision, { admitted: false }>) {
    super(decision.detail);
    this.name = "AdmissionRejectedError";
  }
}

export interface DeviceAdmissionState {
  activeRunId: string | null;
  deviceReady: boolean;
}

/**
 * Cihaz başına lane zamanlayıcısı.
 *
 * Cihaz başına olması şart: iki cihaz birbirini beklememeli, ama bir cihazdaki
 * iki mutation kesinlikle birbirini beklemeli.
 */
export class DeviceAdmissionScheduler {
  private readonly running = new Map<AdmissionLane, number>();
  private readonly queue: QueuedTask[] = [];
  private sequence = 0;
  private state: DeviceAdmissionState = { activeRunId: null, deviceReady: false };
  /**
   * Mutation sonrası okuma durumunun geçersizleşme sayacı.
   *
   * Sayaç olarak tutuluyor çünkü çağıranın "benim okuduğum ağaç hâlâ geçerli
   * mi" sorusuna cevap vermesi gerekiyor; boolean bir bayrak iki mutation
   * arasındaki farkı ayırt edemezdi.
   */
  private invalidationEpoch = 0;
  private readonly waitReevaluationListeners = new Set<() => void>();

  constructor(readonly deviceId: string) {
    for (const lane of Object.keys(LANE_CONCURRENCY) as AdmissionLane[]) {
      this.running.set(lane, 0);
    }
  }

  setState(state: Partial<DeviceAdmissionState>): void {
    this.state = { ...this.state, ...state };
    // Cihaz hazır hale geldiyse kuyruk ilerleyebilir.
    this.pump();
  }

  getState(): DeviceAdmissionState {
    return { ...this.state };
  }

  currentInvalidationEpoch(): number {
    return this.invalidationEpoch;
  }

  /**
   * Bekleyenlerin mutation sonrası yeniden değerlendirilmesi için abonelik.
   *
   * Bir tap koşulu SAĞLAMIŞ olabilir; bekleyenleri uyandırmamak, cihaz bir
   * olay üretmediğinde beklemenin gereksizce zaman aşımına düşmesi demektir.
   */
  onWaitReevaluation(listener: () => void): () => void {
    this.waitReevaluationListeners.add(listener);
    return () => this.waitReevaluationListeners.delete(listener);
  }

  laneDepth(lane: AdmissionLane): number {
    return this.queue.filter((t) => t.lane === lane).length;
  }

  laneRunning(lane: AdmissionLane): number {
    return this.running.get(lane) ?? 0;
  }

  queueDepth(): number {
    return this.queue.length;
  }

  /**
   * Komutu kabul eder, sıraya alır ve şerit müsait olduğunda koşar.
   *
   * Admission kararı SIRAYA ALMADAN ÖNCE verilir: reddedilmiş bir komutu
   * kuyrukta bekletmek, çağırana "sıradasın" izlenimi verip sonunda
   * reddetmektir. Ret anında bilinmeli.
   */
  async submit<T>(task: AdmissionTask<T>): Promise<T> {
    const decision = admitDeviceCommand(task.envelope, this.state);
    if (!decision.admitted) throw new AdmissionRejectedError(decision);

    const lane = decision.lane;
    await new Promise<void>((resolve) => {
      this.queue.push({
        lane,
        priority: LANE_PRIORITY[lane],
        sequence: this.sequence++,
        start: resolve,
      });
      this.pump();
    });

    // Şerit sayacı BURADA artırılmaz — `pump()` görevi kuyruktan alırken
    // artırdı. Burada artırmak bir YARIŞ üretiyordu ve testte yakalandı:
    // `task.start()` promise'i çözer, devamı bir microtask'a düşer, ve o arada
    // `pump()` ikinci görevi de başlatırdı. Yani "tek mutation şeridi"
    // invariant'ı sessizce ihlal ediliyordu — iki tap eşzamanlı gidiyordu ve
    // ikisi de "ok" dönerdi.
    try {
      return await task.run();
    } finally {
      this.running.set(lane, Math.max(0, (this.running.get(lane) ?? 1) - 1));
      if (isMutationCommand(task.envelope.command)) {
        // Ağaç değişti: önceki `treeGen`/nodeRef artık güvenilmez ve bekleyenler
        // yeniden değerlendirilmeli (POST_MUTATION_INVALIDATION).
        this.invalidationEpoch += 1;
        if (POST_MUTATION_INVALIDATION.reevaluateWaits) {
          for (const listener of [...this.waitReevaluationListeners]) listener();
        }
      }
      this.pump();
    }
  }

  /**
   * Kuyruğu ilerletir.
   *
   * Sıralama: önce öncelik (CONTROL en üstte), sonra FIFO. İkinci anahtar
   * olmadan aynı öncelikteki görevler keyfi sırada koşar ve bir görev
   * teorik olarak sonsuza kadar bekleyebilir.
   */
  private pump(): void {
    if (!this.state.deviceReady) return;
    this.queue.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);

    for (let i = 0; i < this.queue.length; ) {
      const task = this.queue[i]!;
      const running = this.running.get(task.lane) ?? 0;
      if (running >= LANE_CONCURRENCY[task.lane]) {
        i += 1;
        continue;
      }
      this.queue.splice(i, 1);
      // Slot DAĞITIM ANINDA ayrılır. `submit()`e bırakmak bir yarıştı: onun
      // devamı bir microtask'a düşerken `pump()` aynı şeritte ikinci görevi de
      // başlatabiliyordu.
      this.running.set(task.lane, running + 1);
      task.start();
      // Aynı turda başka şeritler de açılabilir; baştan taramaya devam et.
    }
  }
}

/** Cihaz başına zamanlayıcı defteri. */
const schedulers = new Map<string, DeviceAdmissionScheduler>();

export function getAdmissionScheduler(deviceId: string): DeviceAdmissionScheduler {
  let scheduler = schedulers.get(deviceId);
  if (!scheduler) {
    scheduler = new DeviceAdmissionScheduler(deviceId);
    schedulers.set(deviceId, scheduler);
  }
  return scheduler;
}

export function disposeAdmissionScheduler(deviceId: string): void {
  schedulers.delete(deviceId);
}

/** Test seam: defteri boşaltır. */
export function resetAdmissionSchedulersForTests(): void {
  schedulers.clear();
}
