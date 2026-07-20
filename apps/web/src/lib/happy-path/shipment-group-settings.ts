import type { HappyPathTypeId } from "./happy-path-types";
import { getGroupIdForType, isPacDdefTypeId } from "./happy-path-types";

export type NesyCountryCode = "HR" | "SI" | "RS" | "BA" | "ME" | "SK" | "AZ";
export type CodCurrency = "EUR" | "RSD";
export type ExwBillingOption = "EXWORKS on invoice" | "EXWORKS in cash";

export interface OohPointSelection {
  oohPointId: string;
  oohName: string;
  zipCode?: string;
  city?: string;
}

export interface CodSettings {
  codAmount: number;
  codCurrency: CodCurrency;
  iban: string;
  bicSwift: string;
  parcelCount: number;
}

export interface DeliveryGroupSettings {
  parcelCount: number;
  multicolli?: {
    parcelCount: number;
    integrationCode1: string;
    weight: number;
  };
  exw?: {
    billingOption: ExwBillingOption;
  };
  deps?: OohPointSelection;
  d4me?: OohPointSelection;
}

export interface PickupGroupSettings {
  pickUpDateOffsetDays: number;
  pickupEndTime: string;
  parcelWeight: number;
  shipmentCount: number;
}

export interface ReturnGroupSettings {
  receiverName?: string;
  integrationCode1?: string;
}

export interface PerTypeSettings {
  parcelCount?: number;
  cod?: CodSettings;
  multicolli?: DeliveryGroupSettings["multicolli"];
  exw?: DeliveryGroupSettings["exw"];
  deps?: OohPointSelection;
  d4me?: OohPointSelection;
  pickup?: PickupGroupSettings;
  receiverName?: string;
  integrationCode1?: string;
}

export interface CombinedSettings {
  parcelCount: number;
  cod?: CodSettings;
  multicolli?: DeliveryGroupSettings["multicolli"];
  exw?: DeliveryGroupSettings["exw"];
  deps?: OohPointSelection;
  d4me?: OohPointSelection;
  pickup?: PickupGroupSettings;
  receiverName?: string;
  integrationCode1?: string;
}

export type ShipmentSettings =
  | DeliveryGroupSettings
  | CodSettings
  | PickupGroupSettings
  | ReturnGroupSettings
  | PerTypeSettings
  | CombinedSettings;

export interface CountryConfig {
  currency: CodCurrency;
  codLimit: number;
  defaultIban: string;
}

export const COUNTRY_DEFAULTS: Record<NesyCountryCode, CountryConfig> = {
  HR: { currency: "EUR", codLimit: 5000, defaultIban: "HR1210010051863000160" },
  SI: { currency: "EUR", codLimit: 5000, defaultIban: "SI56010000000000000" },
  RS: { currency: "RSD", codLimit: 10_000_000, defaultIban: "RS35260005604011337977" },
  BA: { currency: "EUR", codLimit: 5000, defaultIban: "BA391290079401028494" },
  ME: { currency: "EUR", codLimit: 5000, defaultIban: "ME25505000012345678951" },
  SK: { currency: "EUR", codLimit: 5000, defaultIban: "SK3112000000198742637541" },
  AZ: { currency: "EUR", codLimit: 5000, defaultIban: "" },
};

export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

function isCodSettings(s: ShipmentSettings): s is CodSettings {
  return "codAmount" in s && "codCurrency" in s;
}

function isDeliveryGroupSettings(s: ShipmentSettings): s is DeliveryGroupSettings {
  return "parcelCount" in s && !("codAmount" in s) && !("pickUpDateOffsetDays" in s);
}

function isPickupGroupSettings(s: ShipmentSettings): s is PickupGroupSettings {
  return "pickUpDateOffsetDays" in s;
}

function isReturnGroupSettings(s: ShipmentSettings): s is ReturnGroupSettings {
  return !("parcelCount" in s) && !("codAmount" in s) && !("pickUpDateOffsetDays" in s);
}

export function getDefaultCodSettings(country: NesyCountryCode): CodSettings {
  const cfg = COUNTRY_DEFAULTS[country] ?? COUNTRY_DEFAULTS.HR;
  return {
    codAmount: 10,
    codCurrency: cfg.currency,
    iban: cfg.defaultIban,
    bicSwift: "",
    parcelCount: 1,
  };
}

/** EXW is RS-only; mobile Cash events tests expect EXWORKS in cash */
export function getDefaultExwBillingOption(country: NesyCountryCode): ExwBillingOption {
  return country === "RS" ? "EXWORKS in cash" : "EXWORKS on invoice";
}

export function getDefaultDeliverySettings(
  includedTypeIds: Set<string>,
  country: NesyCountryCode,
): DeliveryGroupSettings {
  const settings: DeliveryGroupSettings = { parcelCount: 1 };
  if (includedTypeIds.has("mono-multicolli")) {
    settings.multicolli = {
      parcelCount: 3,
      integrationCode1: "HAPPY-PATH-MC-001",
      weight: 1,
    };
  }
  if (includedTypeIds.has("exw-delivery")) {
    settings.exw = { billingOption: getDefaultExwBillingOption(country) };
  }
  return settings;
}

export function getDefaultPickupSettings(): PickupGroupSettings {
  return {
    pickUpDateOffsetDays: 3,
    pickupEndTime: "21:00",
    parcelWeight: 5,
    shipmentCount: 1,
  };
}

export function getDefaultReturnSettings(includedTypeIds: Set<string>): ReturnGroupSettings {
  const settings: ReturnGroupSettings = {};
  if (includedTypeIds.has("delivery-pick")) {
    settings.receiverName = "Test Receiver";
  }
  if (includedTypeIds.has("red-label")) {
    settings.integrationCode1 = "";
  }
  return settings;
}

export function getDefaultPerTypeSettings(
  typeId: HappyPathTypeId,
  country: NesyCountryCode,
): PerTypeSettings {
  switch (typeId) {
    case "cod-delivery":
      return { cod: getDefaultCodSettings(country) };
    case "mono-multicolli":
      return {
        multicolli: {
          parcelCount: 3,
          integrationCode1: "HAPPY-PATH-MC-001",
          weight: 1,
        },
      };
    case "exw-delivery":
      return {
        exw: { billingOption: getDefaultExwBillingOption(country) },
        parcelCount: 1,
      };
    case "deps":
    case "d4me":
      return { parcelCount: 1 };
    case "remote-pickup":
    case "pickup-at-customer":
      return { pickup: getDefaultPickupSettings() };
    case "delivery-pick":
      return { receiverName: "Test Receiver" };
    case "red-label":
      return { integrationCode1: "" };
    default:
      return { parcelCount: 1 };
  }
}

export function getDefaultCombinedSettings(
  includedTypeIds: Set<string>,
  country: NesyCountryCode,
): CombinedSettings {
  const settings: CombinedSettings = { parcelCount: 1 };
  if (includedTypeIds.has("cod-delivery")) {
    settings.cod = getDefaultCodSettings(country);
  }
  if (includedTypeIds.has("mono-multicolli")) {
    settings.multicolli = {
      parcelCount: 3,
      integrationCode1: "HAPPY-PATH-MC-001",
      weight: 1,
    };
  }
  if (includedTypeIds.has("exw-delivery")) {
    settings.exw = { billingOption: getDefaultExwBillingOption(country) };
  }
  if (
    includedTypeIds.has("remote-pickup") ||
    includedTypeIds.has("pickup-at-customer")
  ) {
    settings.pickup = getDefaultPickupSettings();
  }
  if (includedTypeIds.has("delivery-pick")) {
    settings.receiverName = "Test Receiver";
  }
  if (includedTypeIds.has("red-label")) {
    settings.integrationCode1 = "";
  }
  return settings;
}

export function getDefaultSettingsForContext(
  contextId: string,
  includedTypeIds: Set<string>,
  country: NesyCountryCode,
): ShipmentSettings {
  if (contextId === "all") {
    return getDefaultCombinedSettings(includedTypeIds, country);
  }
  if (contextId === "delivery") {
    return getDefaultDeliverySettings(includedTypeIds, country);
  }
  if (contextId === "cod") {
    return getDefaultCodSettings(country);
  }
  if (contextId === "pickup") {
    return getDefaultPickupSettings();
  }
  if (contextId === "return") {
    return getDefaultReturnSettings(includedTypeIds);
  }
  if (contextId in { "standard-delivery": 1, "cod-delivery": 1, "exw-delivery": 1, deps: 1, d4me: 1, "mono-multicolli": 1, "remote-pickup": 1, "pickup-at-customer": 1, rdoc: 1, "delivery-pick": 1, "red-label": 1, doco: 1 }) {
    return getDefaultPerTypeSettings(contextId as HappyPathTypeId, country);
  }
  return { parcelCount: 1 };
}

export function validateSettings(
  contextId: string,
  settings: ShipmentSettings,
  country: NesyCountryCode,
  includedTypeIds: Set<string>,
): ValidationResult {
  const errors: ValidationError[] = [];
  const countryCfg = COUNTRY_DEFAULTS[country] ?? COUNTRY_DEFAULTS.HR;

  const validateCod = (cod: CodSettings) => {
    if (cod.codAmount <= 0) {
      errors.push({ field: "codAmount", message: "COD amount must be greater than 0", severity: "error" });
    }
    if (cod.codAmount > countryCfg.codLimit) {
      errors.push({
        field: "codAmount",
        message: `COD amount exceeds limit (${countryCfg.codLimit} ${countryCfg.currency})`,
        severity: "warning",
      });
    }
    if (!cod.iban.trim()) {
      errors.push({ field: "iban", message: "IBAN is required for COD", severity: "error" });
    }
  };

  if (contextId === "cod" || contextId === "cod-delivery") {
    if (isCodSettings(settings)) validateCod(settings);
  } else if (contextId === "delivery") {
    if (isDeliveryGroupSettings(settings)) {
      if (includedTypeIds.has("mono-multicolli") && settings.multicolli) {
        if (settings.multicolli.parcelCount < 2) {
          errors.push({
            field: "multicolli.parcelCount",
            message: "Multicolli requires at least 2 parcels",
            severity: "error",
          });
        }
        if (!settings.multicolli.integrationCode1.trim()) {
          errors.push({
            field: "multicolli.integrationCode1",
            message: "Integration code is required for multicolli",
            severity: "error",
          });
        }
      }
      if (includedTypeIds.has("deps") && !settings.deps?.oohPointId) {
        errors.push({
          field: "deps.oohPoint",
          message: "Please select a Parcel Shop for DEPS",
          severity: "error",
        });
      }
      if (includedTypeIds.has("d4me") && !settings.d4me?.oohPointId) {
        errors.push({
          field: "d4me.oohPoint",
          message: "Please select a Locker for D4ME",
          severity: "error",
        });
      }
    }
  } else if (contextId === "pickup" || ["remote-pickup", "pickup-at-customer"].includes(contextId)) {
    if (isPickupGroupSettings(settings)) {
      if (settings.pickUpDateOffsetDays < 0) {
        errors.push({
          field: "pickUpDateOffsetDays",
          message: "Pickup date offset must be 0 or more",
          severity: "error",
        });
      }
    }
  } else if (contextId === "return" || contextId === "delivery-pick") {
    if (isReturnGroupSettings(settings) || "receiverName" in settings) {
      const name = (settings as ReturnGroupSettings).receiverName;
      if (
        (contextId === "delivery-pick" || includedTypeIds.has("delivery-pick")) &&
        !name?.trim()
      ) {
        errors.push({
          field: "receiverName",
          message: "Receiver name is required for Delivery & Pick",
          severity: "error",
        });
      }
    }
  } else if (contextId === "all") {
    const combined = settings as CombinedSettings;
    if (combined.cod) validateCod(combined.cod);
    if (includedTypeIds.has("mono-multicolli") && combined.multicolli) {
      if (combined.multicolli.parcelCount < 2) {
        errors.push({
          field: "multicolli.parcelCount",
          message: "Multicolli requires at least 2 parcels",
          severity: "error",
        });
      }
    }
    if (includedTypeIds.has("deps") && !combined.deps?.oohPointId) {
      errors.push({
        field: "deps.oohPoint",
        message: "Please select a Parcel Shop for DEPS",
        severity: "error",
      });
    }
    if (includedTypeIds.has("d4me") && !combined.d4me?.oohPointId) {
      errors.push({
        field: "d4me.oohPoint",
        message: "Please select a Locker for D4ME",
        severity: "error",
      });
    }
  }

  if (contextId === "deps") {
    const depsPoint = "deps" in settings ? settings.deps : undefined;
    if (!depsPoint?.oohPointId) {
      errors.push({
        field: "deps.oohPoint",
        message: "Please select a Parcel Shop for DEPS",
        severity: "error",
      });
    }
  }
  if (contextId === "d4me") {
    const d4mePoint = "d4me" in settings ? settings.d4me : undefined;
    if (!d4mePoint?.oohPointId) {
      errors.push({
        field: "d4me.oohPoint",
        message: "Please select a Locker for D4ME",
        severity: "error",
      });
    }
  }

  const hasBlocking = errors.some((e) => e.severity === "error");
  return { ok: !hasBlocking, errors };
}

export function formatSettingsSummary(
  contextId: string,
  settings: ShipmentSettings | undefined,
): string {
  if (!settings) return "";
  const parts: string[] = [];

  if (isCodSettings(settings)) {
    parts.push(`COD ${settings.codAmount} ${settings.codCurrency}`);
    if (settings.iban) parts.push(`IBAN: ${settings.iban.slice(0, 6)}...`);
  }
  if (isDeliveryGroupSettings(settings)) {
    if (settings.parcelCount > 1) parts.push(`${settings.parcelCount} parcels`);
    if (settings.multicolli) parts.push(`MC ${settings.multicolli.parcelCount}`);
    if (settings.deps?.oohName) parts.push(`DEPS: ${settings.deps.oohName}`);
    if (settings.d4me?.oohName) parts.push(`D4ME: ${settings.d4me.oohName}`);
    if (settings.exw?.billingOption) parts.push(settings.exw.billingOption);
  }
  if (isPickupGroupSettings(settings)) {
    parts.push(`Pickup +${settings.pickUpDateOffsetDays}d`);
  }
  if ("receiverName" in settings && settings.receiverName) {
    parts.push(`Receiver: ${settings.receiverName}`);
  }
  if ("cod" in settings && settings.cod) {
    parts.push(`COD ${settings.cod.codAmount} ${settings.cod.codCurrency}`);
  }
  if ("multicolli" in settings && settings.multicolli) {
    parts.push(`MC ${settings.multicolli.parcelCount}`);
  }
  if ("pickup" in settings && settings.pickup) {
    parts.push(`Pickup +${settings.pickup.pickUpDateOffsetDays}d`);
  }
  if ("exw" in settings && settings.exw?.billingOption) {
    parts.push(settings.exw.billingOption);
  }

  if (contextId === "red-label") {
    parts.push("Unload flow (skipped on generate)");
  }

  return parts.join(" | ");
}

/** Resolve effective settings for a type from assignment context */
export function resolveSettingsForType(
  typeId: HappyPathTypeId,
  settings: ShipmentSettings | undefined,
  mode: "one" | "recommended" | "custom",
  contextId: string,
): Record<string, unknown> {
  if (isPacDdefTypeId(typeId)) {
    return { parcelCount: 1 };
  }

  if (!settings) return {};

  const result: Record<string, unknown> = {};

  if (mode === "one" || contextId === "all") {
    const combined = settings as CombinedSettings;
    if (typeId === "cod-delivery" && combined.cod) {
      Object.assign(result, combined.cod);
    }
    if (typeId === "mono-multicolli" && combined.multicolli) {
      Object.assign(result, combined.multicolli);
      result.parcelCount = combined.multicolli.parcelCount;
    }
    if (typeId === "exw-delivery" && combined.exw) {
      Object.assign(result, combined.exw);
    }
    if (typeId === "deps" && combined.deps) {
      result.oohPoint = combined.deps;
    }
    if (typeId === "d4me" && combined.d4me) {
      result.oohPoint = combined.d4me;
    }
    if (
      (typeId === "remote-pickup" || typeId === "pickup-at-customer") &&
      combined.pickup
    ) {
      Object.assign(result, combined.pickup);
    }
    if (typeId === "delivery-pick" && combined.receiverName) {
      result.receiverName = combined.receiverName;
    }
    if (typeId === "red-label" && combined.integrationCode1) {
      result.integrationCode1 = combined.integrationCode1;
    }
    if (!result.parcelCount && combined.parcelCount) {
      result.parcelCount = combined.parcelCount;
    }
    return result;
  }

  if (mode === "recommended") {
    const groupId = getGroupIdForType(typeId);
    if (groupId === "delivery" && isDeliveryGroupSettings(settings)) {
      result.parcelCount = settings.parcelCount;
      if (typeId === "mono-multicolli" && settings.multicolli) {
        Object.assign(result, settings.multicolli);
        result.parcelCount = settings.multicolli.parcelCount;
      }
      if (typeId === "exw-delivery" && settings.exw) Object.assign(result, settings.exw);
      if (typeId === "deps" && settings.deps) result.oohPoint = settings.deps;
      if (typeId === "d4me" && settings.d4me) result.oohPoint = settings.d4me;
    }
    if (groupId === "cod" && isCodSettings(settings)) {
      Object.assign(result, settings);
    }
    if (groupId === "pickup" && isPickupGroupSettings(settings)) {
      Object.assign(result, settings);
    }
    if (groupId === "return" && isReturnGroupSettings(settings)) {
      if (typeId === "delivery-pick") result.receiverName = settings.receiverName;
      if (typeId === "red-label") result.integrationCode1 = settings.integrationCode1;
    }
    return result;
  }

  const perType = settings as PerTypeSettings;
  if (perType.cod) Object.assign(result, perType.cod);
  if (perType.multicolli) {
    Object.assign(result, perType.multicolli);
    result.parcelCount = perType.multicolli.parcelCount;
  }
  if (perType.exw) Object.assign(result, perType.exw);
  if (perType.deps) result.oohPoint = perType.deps;
  if (perType.d4me) result.oohPoint = perType.d4me;
  if (perType.pickup) Object.assign(result, perType.pickup);
  if (perType.receiverName) result.receiverName = perType.receiverName;
  if (perType.integrationCode1) result.integrationCode1 = perType.integrationCode1;
  if (perType.parcelCount) result.parcelCount = perType.parcelCount;

  return result;
}
