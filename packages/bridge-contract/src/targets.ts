/**
 * ===========================================================================
 *  HEDEF ÇÖZÜMLEME VE FINGERPRINT  (Plan D.3 · D.4)
 *
 *  Bu dosyanın tek işi şu hatayı imkânsız kılmak: **yanlış satıra dokunmak.**
 *
 *  Bir liste ekranında "3. satırdaki onayla düğmesi" diye hedef belirlemek,
 *  liste kaydığında veya bir öğe eklendiğinde sessizce BAŞKA bir kaydı onaylar.
 *  Test yeşil kalır — çünkü bir şeye dokunuldu ve bir şey oldu. Bu yüzden
 *  `rowIndexHint` tip düzeyinde "hint" olarak adlandırıldı ve tek başına
 *  kalıcı bir kimlik olarak KABUL EDİLMEZ (`isPersistentTarget`).
 * ===========================================================================
 */
import { BRIDGE_LIMITS } from "./protocol.js";

/**
 * Ölçülemeyen üç durumlu alanlar için cihaz sentinel'i.
 *
 * `AccessibilityTree.kt` → `internal const val NOT_MEASURED = "not_measured"`.
 *
 * Neden `false` değil: "bu node tıklanabilir değil" ile "tıklanabilirliği
 * ölçemedim" aynı şey değildir. İkincisini `false` yapmak, ölçüm boşluğunu
 * ürün bulgusuna çevirir — "düğme tıklanamıyor" diye rapor edilen şey aslında
 * pencere ölçümünün alınamamış olmasıdır.
 */
export const BRIDGE_NOT_MEASURED = "not_measured" as const;

/** Ölçülmüş boolean, ya da ölçülemediğinin açık beyanı. */
export type MeasuredBoolean = boolean | typeof BRIDGE_NOT_MEASURED;

export const isMeasured = <T>(value: T | typeof BRIDGE_NOT_MEASURED): value is T =>
  value !== BRIDGE_NOT_MEASURED;

export interface BridgeBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface BridgeCollectionInfo {
  rowCount?: number;
  columnCount?: number;
  hierarchical?: boolean;
}

/**
 * Cihazın döndürdüğü node — `AccessibilityTree.kt` → `toJson()` birebir.
 *
 * `obscuredBy` özellikle önemli: bir node görünür VE başka bir pencere
 * tarafından kapatılmış olabilir. Onu yok saymak, üstünde bir dialog varken
 * düğmeye "dokunduğunu" sanmaya yol açar.
 */
export interface BridgeNode {
  depth: number;
  id: string | null;
  text: string | null;
  contentDescription: string | null;
  className: string | null;
  packageName: string | null;
  rowIndex: number | null;
  columnIndex: number | null;
  collectionInfo: BridgeCollectionInfo | null;
  clickable: MeasuredBoolean;
  enabled: MeasuredBoolean;
  visible: MeasuredBoolean;
  obscuredBy: readonly string[];
  bounds: BridgeBounds | typeof BRIDGE_NOT_MEASURED;
}

/**
 * ---------------------------------------------------------------------------
 *  Dump kapsamı
 *
 *  `ProtocolV1.parseDumpScope` → "full" | "depth" | "subtree".
 *
 *  ⚠️ Scoped dump BAŞARISIZ olduğunda full dump'a düşmek YASAK (RUN_PLAY
 *  acceptance 5). Sebebi performans değil doğruluk: full dump binlerce node
 *  taşır, hot path'te saniyeler sürer ve fallback sessizce devreye girerse
 *  "neden bu adım 4 saniye" sorusunun cevabı hiçbir yerde yazılı olmaz.
 * ---------------------------------------------------------------------------
 */
export type DumpScope =
  | { kind: "full" }
  | { kind: "depth"; maxDepth: number }
  | { kind: "subtree"; rootId: string; maxDepth?: number; rowIndex?: number };

/** Wire biçimine çevirir (`scope` + yanına düz alanlar). */
export function dumpScopeToParams(scope: DumpScope): Record<string, unknown> {
  switch (scope.kind) {
    case "full":
      return { scope: "full" };
    case "depth":
      return { scope: "depth", maxDepth: scope.maxDepth };
    case "subtree":
      return {
        scope: "subtree",
        rootId: scope.rootId,
        ...(scope.maxDepth === undefined ? {} : { maxDepth: scope.maxDepth }),
        ...(scope.rowIndex === undefined ? {} : { rowIndex: scope.rowIndex }),
      };
  }
}

/**
 * ---------------------------------------------------------------------------
 *  Selector
 *
 *  Cihaz iki eşleme kipi sunar: `find_id`/`tap_id` (viewId) ve
 *  `find_text`/`tap_text` (metin). Union, komut seçimini tip düzeyinde
 *  belirler; çağıran "id selector'ı text komutuna" veremez.
 * ---------------------------------------------------------------------------
 */
export type BridgeSelector =
  | { by: "id"; value: string; rowIndexHint?: number }
  | { by: "text"; value: string; exact?: boolean; rowIndexHint?: number };

/**
 * ---------------------------------------------------------------------------
 *  TargetFingerprint
 *
 *  Bir hedefin "aynı hedef" olduğunu iddia edebilmek için gereken kanıt.
 *
 *  `rowIndexHint` ADI GEREĞİ bir ipucudur: yalnızca aynı `rowKey` ile birlikte
 *  anlamlıdır ("bu kaydı bul; muhtemelen 3. satırdaydı"). Tek başına
 *  kullanıldığında hedef kimliği DEĞİLDİR.
 * ---------------------------------------------------------------------------
 */
export interface TargetFingerprint {
  /** Fingerprint şeması sürümü — kayıtlı kanıt ileride yorumlanabilsin. */
  version: 1;
  selector: BridgeSelector;
  /**
   * Kayda ait, listenin sırasından BAĞIMSIZ kimlik (ör. bir entity anahtarı).
   *
   * Bunu üreten Domain Pack'tir, Bridge değil — Bridge yalnız "opak stabil
   * anahtar" olarak taşır. Domain kavramı buraya sızmasın diye tip `string`.
   */
  rowKey?: string;
  /** Beklenen viewId. */
  expectedId?: string;
  /** Beklenen metin. */
  expectedText?: string;
  /** Beklenen sınıf adı. */
  expectedClassName?: string;
  /** Sıra ipucu — TEK BAŞINA kimlik değildir. */
  rowIndexHint?: number;
  /** Fingerprint'in alındığı ağaç nesli. */
  capturedTreeGen?: number;
}

/**
 * Fingerprint gücü.
 *
 * `WEAK` bir fiziksel mutation için YETERSİZDİR. Bu, "iyi olurdu" değil
 * "aksi halde yanlış satıra dokunulur" meselesidir.
 */
export type FingerprintStrength = "STRONG" | "MODERATE" | "WEAK";

/**
 * Fingerprint'in ne kadar kanıt taşıdığını ölçer.
 *
 * `STRONG`: sıradan bağımsız bir `rowKey` var — liste kayarsa da aynı kayıt.
 * `MODERATE`: viewId veya tam metin var; liste içinde tek ise güvenli.
 * `WEAK`: elde yalnız sıra ipucu (veya hiçbir şey) var.
 */
export function fingerprintStrength(fingerprint: TargetFingerprint): FingerprintStrength {
  if (fingerprint.rowKey !== undefined && fingerprint.rowKey !== "") return "STRONG";
  if (
    (fingerprint.expectedId !== undefined && fingerprint.expectedId !== "") ||
    (fingerprint.expectedText !== undefined && fingerprint.expectedText !== "")
  ) {
    return "MODERATE";
  }
  return "WEAK";
}

/**
 * Bu hedef kalıcı olarak yeniden bulunabilir mi?
 *
 * RUN_PLAY acceptance 8: "`rowIndexHint` tek başına target identity değil."
 * Bu fonksiyon o kuralın tek uygulama noktasıdır.
 */
export function isPersistentTarget(fingerprint: TargetFingerprint): boolean {
  return fingerprintStrength(fingerprint) !== "WEAK";
}

/**
 * ---------------------------------------------------------------------------
 *  Sabit koordinat yasağı
 *
 *  RUN_PLAY: "Sabit koordinat action/workflow kabul edilmez." Sebep: koordinat
 *  farklı ekran yoğunluğunda, farklı dilde, farklı yazı tipi ölçeğinde başka
 *  bir şeye denk gelir ve test yine "tap başarılı" der.
 *
 *  `swipe` bilinçli tek istisnadır — bir kaydırma jesti doğası gereği
 *  koordinat/vektör taşır ve bir NODE'a değil EKRANA uygulanır. Ayrımı tipte
 *  tutmak, "swipe zaten koordinat alıyor, tap de alabilir" kaymasını engeller.
 * ---------------------------------------------------------------------------
 */
export interface FixedCoordinateRejection {
  accepted: false;
  reason: "FIXED_COORDINATE_TARGET_FORBIDDEN";
  detail: string;
}

export interface WeakTargetRejection {
  accepted: false;
  reason: "ROW_INDEX_HINT_NOT_IDENTITY";
  detail: string;
}

export type TargetAdmission =
  | { accepted: true; fingerprint: TargetFingerprint }
  | FixedCoordinateRejection
  | WeakTargetRejection;

/**
 * Fiziksel bir mutation için hedefi kabul eder ya da gerekçeyle reddeder.
 *
 * İki ret sebebi var ve ikisi de sessiz yanlış dokunuşun kaynağıdır:
 * koordinat tabanlı hedef, ve yalnız sıra ipucuna dayanan hedef.
 */
export function admitMutationTarget(fingerprint: TargetFingerprint): TargetAdmission {
  if (!isPersistentTarget(fingerprint)) {
    return {
      accepted: false,
      reason: "ROW_INDEX_HINT_NOT_IDENTITY",
      detail:
        "target carries only a rowIndexHint (or nothing); a row index is not an identity — " +
        "the list shifts and the action lands on a different record with no error anywhere",
    };
  }
  return { accepted: true, fingerprint };
}

/**
 * ---------------------------------------------------------------------------
 *  Çözümleme kanıtı
 * ---------------------------------------------------------------------------
 */
export type TargetResolutionOutcome =
  | "RESOLVED_UNIQUE"
  | "NOT_FOUND"
  | "AMBIGUOUS"
  | "STALE_TREE"
  | "TREE_UNAVAILABLE"
  /** Hedef host tarafında reddedildi; cihaza HİÇ gitmedi. */
  | "REJECTED_WEAK_TARGET";

export interface TargetResolutionEvidence {
  outcome: TargetResolutionOutcome;
  fingerprint: TargetFingerprint;
  strength: FingerprintStrength;
  /** Cihazın bildirdiği eşleşme sayısı (`count`/`matched`). */
  matchedCount?: number;
  treeGen?: number;
  /** Çözümlenen node — yalnız `RESOLVED_UNIQUE` durumunda. */
  node?: BridgeNode;
  /** Cihazın hata kodu, varsa. */
  deviceError?: string;
}

/**
 * Bu sonuçtan sonra fiziksel aksiyon uygulanabilir mi?
 *
 * Tek `true` dönen durum `RESOLVED_UNIQUE`. Ambiguous ve stale açıkça
 * listelenmiyor da olsa `false` dönerdi; ama tek bir pozitif koşul yazmak,
 * ileride eklenen yeni bir outcome'ın kazara "aksiyona izinli" sayılmasını
 * imkânsız kılar.
 */
export const mayActOnResolution = (evidence: TargetResolutionEvidence): boolean =>
  evidence.outcome === "RESOLVED_UNIQUE";

/**
 * Host tarafı tap zaman aşımını cihaz sınırına kırpar.
 *
 * Kırpmamak, cihaz sınırı aşıldığında cihazın kendi kırpmasıyla host'un
 * beklentisinin ayrışmasına yol açar: cihaz 10 sn sonra cevap verir, host
 * 30 sn bekler ve arada 20 sn boyunca kimse bir şey yapmaz.
 */
export function clampTapTimeoutMs(requested: number | undefined): number {
  const value = requested ?? BRIDGE_LIMITS.defaultTapTimeoutMs;
  if (!Number.isFinite(value) || value <= 0) return BRIDGE_LIMITS.defaultTapTimeoutMs;
  return Math.min(Math.floor(value), BRIDGE_LIMITS.maxTapTimeoutMs);
}

export function clampWaitTimeoutMs(requested: number): number {
  if (!Number.isFinite(requested) || requested <= 0) return 1;
  return Math.min(Math.floor(requested), BRIDGE_LIMITS.maxWaitTimeoutMs);
}

export function clampSwipeDurationMs(requested: number | undefined): number {
  const value = requested ?? BRIDGE_LIMITS.defaultSwipeDurationMs;
  if (!Number.isFinite(value) || value <= 0) return BRIDGE_LIMITS.defaultSwipeDurationMs;
  return Math.min(Math.floor(value), BRIDGE_LIMITS.maxSwipeDurationMs);
}
