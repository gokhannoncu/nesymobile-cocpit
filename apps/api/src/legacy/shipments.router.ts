// @ts-nocheck
import { Router, type Router as RouterType } from "express";
import { prisma, type Prisma } from "@nesy/db";
import type { BffCustomerPayload } from "./nesy-customer-payload.js";
import {
  buildShipmentPayloadFromParties,
  type BffCreateShipmentParties,
} from "./nesy-shipment-parties.js";
import {
  type NesyCountry,
  type NesyEnvironment,
  resolveDashboardBaseUrl,
  resolveBaseUrl,
  nesyHeaders,
} from "../nesy-env.js";
import { extractShipmentIdFromNesySaveResponse, isNesyResultOk } from "./nesy-save-response.js";
import {
  extractNesyShipmentId,
  resolveLatestEventLabel,
} from "./nesy-last-event.js";
import { loadHappyPathLinkedRecordIds } from "./happy-path-list-exclusions.js";

const router: RouterType = Router();

type ShipmentType =
  | "standard"
  | "return-document"
  | "cod"
  | "exw"
  | "multicolli"
  | "deps"
  | "d4me"
  | "doco"
  | "delivery-pick";

const nesyCountries = new Set<NesyCountry>(["HR", "SI", "RS", "BA", "ME", "SK", "AZ"]);
const nesyEnvironments = new Set<NesyEnvironment>(["stage", "prod"]);

function isNesyCountry(value: unknown): value is NesyCountry {
  return typeof value === "string" && nesyCountries.has(value as NesyCountry);
}

function isNesyEnvironment(value: unknown): value is NesyEnvironment {
  return typeof value === "string" && nesyEnvironments.has(value as NesyEnvironment);
}

/** Staging/portal ile aynı: Cash Prepayed + Standard (ClientSaveShipment başarı koşulları) */
const cashPrepayedService = {
  servicePrice: 0,
  serviceName: "Cash Prepayed",
  serviceType: 39,
  legacySystemServiceId: "0",
  value: "0",
} as const;

interface CodServiceOptions {
  codAmount?: number;
  codCurrency?: string;
  iban?: string;
  bicSwift?: string;
}

function buildServices(
  shipmentType: ShipmentType,
  codOpts?: CodServiceOptions,
  receiverName?: string,
) {
  const standard = {
    servicePrice: 0,
    serviceName: "Standard",
    serviceType: 24,
    legacySystemServiceId: "1",
    value: "1",
  };

  if (shipmentType === "return-document") {
    return [
      {
        servicePrice: 0,
        serviceName: "Document Collection",
        serviceType: 27,
        legacySystemServiceId: "64",
        value: "64",
      },
      standard,
    ];
  }

  if (shipmentType === "doco") {
    return [
      {
        servicePrice: 0,
        serviceName: "Document Collection",
        serviceType: 27,
        legacySystemServiceId: "64",
        value: "64",
      },
      cashPrepayedService,
      standard,
    ];
  }

  if (shipmentType === "cod") {
    const currency = codOpts?.codCurrency ?? "EUR";
    return [
      {
        servicePrice: codOpts?.codAmount ?? 0,
        serviceName: "Cash on Delivery",
        serviceType: 20,
        legacySystemServiceId: "8",
        value: "8",
        currency,
        iban: codOpts?.iban ?? "",
        bicSwift: codOpts?.bicSwift ?? "",
      },
      standard,
    ];
  }

  if (shipmentType === "exw") {
    return [
      {
        servicePrice: 0,
        serviceName: "Exwork",
        serviceType: 22,
        legacySystemServiceId: "2",
        value: "2",
      },
      standard,
    ];
  }

  if (shipmentType === "multicolli") {
    return [
      {
        servicePrice: 0,
        serviceName: "MultiColli",
        serviceType: 46,
        legacySystemServiceId: "46",
        value: "46",
      },
      cashPrepayedService,
      standard,
    ];
  }

  if (shipmentType === "deps") {
    return [
      {
        servicePrice: 0,
        serviceName: "Parcel Shop Delivery",
        serviceType: 30,
        legacySystemServiceId: "30",
        value: "30",
      },
      cashPrepayedService,
      standard,
    ];
  }

  if (shipmentType === "d4me") {
    return [
      {
        servicePrice: 0,
        serviceName: "Parcel Terminal Delivery",
        serviceType: 47,
        legacySystemServiceId: "47",
        value: "47",
      },
      cashPrepayedService,
      standard,
    ];
  }

  if (shipmentType === "delivery-pick") {
    return [
      {
        servicePrice: 0,
        serviceName: "Personal Delivery",
        serviceType: 36,
        legacySystemServiceId: "36",
        value: receiverName ?? "Test Receiver",
      },
      cashPrepayedService,
      standard,
    ];
  }

  return [cashPrepayedService, standard];
}

function getDefaultCustomerPreferences() {
  return {
    allowedCustomerIdList: [],
    isInternationalUser: false,
    ignoreCoverage: true,
    canCommission: true,
    ddspDisabled: false,
    requirePersonalID: false,
    autoInit: false,
    pickByRefEnabled: false,
    returnStickerMandatory: false,
    ignoreNoDataShipment: false,
    adhocPickupEnabled: false,
    isIncludeInNoData: false,
    isTakeWeightFromFile: false,
    importMode: false,
    isAutoOrderDeleteEnabled: false,
    isMipOrderOverwriteEnabled: false,
    isIncludeImportServicesCustomer: false,
    isAutoRedirectEnabled: false,
    isCargoServiceDisabled: false,
    enableStrictCityZipCheck: false,
    isCreditCardPaymentEnabled: true,
    returnLimitDays: 0,
    returnCustomerId: 0,
    isCustomerServiceDisabled: false,
    isCrc: null,
    isCifCreationOnInitEnabled: false,
    isMergingRedLabelWithCifEnabled: false,
    isEurodisDeactivated: false,
    customerBffPublicEvents: [],
  };
}

function buildShipmentPayload(
  parcelCount: number,
  shipmentType: ShipmentType = "standard",
  codAmount?: number,
  customer?: BffCustomerPayload,
  billing: { billingOption: string; payerType: number } = {
    billingOption: "CPP in cash",
    payerType: 2,
  }
) {
  const { billingOption, payerType } = billing;
  const parcels = Array.from({ length: parcelCount }, () => ({
    barcode: "",
    customerBarcode: "",
    weight: 1,
    parcelType: "PARCEL",
    pricingUnit: "WeightPerUnit",
    goodCategory: 0,
    integrationCode: "",
  }));

  if (customer) {
    const raw = customer.name.trim();
    const withUnderscore = raw.startsWith("_") ? raw : `_${raw}`;
    const noUnderscore = raw.replace(/^_/, "");
    const addressText =
      customer.addressText?.trim() ||
      `${customer.addressStreet} ,${customer.addressZipCode} ,${customer.addressCity} ,${customer.addressCountry}`;
    const addressTitle = customer.addressTitle?.trim() || noUnderscore;
    const preferences =
      customer.customerPreferences && Object.keys(customer.customerPreferences).length > 0
        ? customer.customerPreferences
        : getDefaultCustomerPreferences();

    return {
      customerCustomer: withUnderscore,
      customerAddressTitle: withUnderscore,
      customerCustomerId: customer.customerId,
      customerCustomerCenter: customer.customerCenter,
      customerName: withUnderscore,
      customerPhone: customer.phone,
      customerGsm: customer.gsm,
      codReturnBankAccount: "",
      codReturnBankCode: "",
      customerAddressType: 0,
      customerAddressText: addressText,
      customerAddressCountry: customer.addressCountry,
      customerAddressStreet: customer.addressStreet,
      customerAddressCity: customer.addressCity,
      customerAddressZipCode: customer.addressZipCode,
      customerHouseNumber: null,
      customerDoorNumber: null,
      customerSaveAddress: false,
      counterLocationShipperId: 0,
      customerSaveAddressBookIndex: -1,
      customerPreferences: preferences,
      customerCustomerAlphanumericId: null,
      shipperCustomer: noUnderscore,
      shipperCustomerId: customer.customerId,
      shipperCustomerCenter: customer.customerCenter,
      shipperName: noUnderscore,
      shipperPhone: customer.phone,
      shipperGsm: customer.gsm,
      shipperAddressType: 0,
      shipperAddressTitle: addressTitle,
      shipperAddressText: "",
      shipperAddressCountry: customer.addressCountry,
      shipperAddressStreet: customer.addressStreet,
      shipperAddressCity: customer.addressCity,
      shipperAddressZipCode: customer.addressZipCode,
      shipperHouseNumber: null,
      shipperDoorNumber: null,
      shipperSaveAddress: false,
      shipperSaveAddressBookIndex: -1,
      shipperCustomerAlphanumericId: null,
      isWorldWide: false,
      consigneeCustomer: noUnderscore,
      consigneeName: noUnderscore,
      consigneeCustomerId: customer.customerId,
      consigneeCustomerCenter: customer.customerCenter,
      consigneePhone: customer.phone,
      consigneeGsm: customer.gsm,
      consigneeAddressType: 0,
      consigneeAddressTitle: addressTitle,
      consigneeAddressText: "",
      consigneeAddressCountry: customer.addressCountry,
      consigneeAddressStreet: customer.addressStreet,
      consigneeAddressCity: customer.addressCity,
      consigneeAddressZipCode: customer.addressZipCode,
      consigneeHouseNumber: null,
      consigneeDoorNumber: null,
      consigneeSaveAddress: false,
      counterLocationConsigneeId: 0,
      consigneeSaveAddressBookIndex: -1,
      parcels,
      parcelCount,
      integrationCode1: null,
      integrationCode2: null,
      integrationCode3: null,
      internationalCode: "",
      parcelType: "PARCEL",
      channel: "Portal",
      billingOption,
      payerType,
      codCurrency: 0,
      services: buildServices(shipmentType, { codAmount }),
      dimCount: null,
      ...(shipmentType === "cod"
        ? { shouldUpdateTransTypeForPriceCalculation: false }
        : {}),
    };
  }

  return {
    customerCustomer: "_OVERSEAS IT&IS",
    customerAddressTitle: "_OVERSEAS IT&IS",
    customerCustomerId: 10330,
    customerCustomerCenter: "1",
    customerName: "_OVERSEAS IT&IS",
    customerPhone: "4607-000",
    customerGsm: "4607-000",
    codReturnBankAccount: "",
    codReturnBankCode: "",
    customerAddressType: 0,
    customerAddressText: "ZASTAVNICE 38A ,10251 ,HRVATSKI LESKOVAC ,HR",
    customerAddressCountry: "HR",
    customerAddressStreet: "ZASTAVNICE 38A",
    customerAddressCity: "HRVATSKI LESKOVAC",
    customerAddressZipCode: "10251",
    customerHouseNumber: null,
    customerDoorNumber: null,
    customerSaveAddress: false,
    counterLocationShipperId: 0,
    customerSaveAddressBookIndex: -1,
    customerPreferences: getDefaultCustomerPreferences(),
    customerCustomerAlphanumericId: null,
    shipperCustomer: "OVERSEAS IT&IS",
    shipperCustomerId: 10330,
    shipperCustomerCenter: "1",
    shipperName: "OVERSEAS IT&IS",
    shipperPhone: "4607-000",
    shipperGsm: "4607-000",
    shipperAddressType: 0,
    shipperAddressTitle: "OVERSEAS IT&IS",
    shipperAddressText: "",
    shipperAddressCountry: "HR",
    shipperAddressStreet: "ZASTAVNICE 38A",
    shipperAddressCity: "HRVATSKI LESKOVAC",
    shipperAddressZipCode: "10251",
    shipperHouseNumber: null,
    shipperDoorNumber: null,
    shipperSaveAddress: false,
    shipperSaveAddressBookIndex: -1,
    shipperCustomerAlphanumericId: null,
    isWorldWide: false,
    consigneeCustomer: "OVERSEAS IT&IS",
    consigneeName: "OVERSEAS IT&IS",
    consigneeCustomerId: 10330,
    consigneeCustomerCenter: "1",
    consigneePhone: "4607-000",
    consigneeGsm: "4607-000",
    consigneeAddressType: 0,
    consigneeAddressTitle: "OVERSEAS IT&IS",
    consigneeAddressText: "",
    consigneeAddressCountry: "HR",
    consigneeAddressStreet: "ZASTAVNICE 38A",
    consigneeAddressCity: "HRVATSKI LESKOVAC",
    consigneeAddressZipCode: "10251",
    consigneeHouseNumber: null,
    consigneeDoorNumber: null,
    consigneeSaveAddress: false,
    counterLocationConsigneeId: 0,
    consigneeSaveAddressBookIndex: -1,
    parcels,
    parcelCount,
    integrationCode1: null,
    integrationCode2: null,
    integrationCode3: null,
    internationalCode: "",
    parcelType: "PARCEL",
    channel: "Portal",
    billingOption,
    payerType,
    codCurrency: 0,
    services: buildServices(shipmentType, { codAmount }),
    dimCount: null,
    ...(shipmentType === "cod"
      ? { shouldUpdateTransTypeForPriceCalculation: false }
      : {}),
  };
}

/** Nesy unload/ship cevabı: payload üst düzey dizi veya { items } olabilir; PascalCase yaygın. */
function extractFirstUnloadShipmentItem(
  unloadResult: Record<string, unknown>
): Record<string, unknown> | null {
  const raw = unloadResult.payload ?? unloadResult.Payload;
  if (raw == null) return null;
  if (Array.isArray(raw) && raw[0] && typeof raw[0] === "object") {
    return raw[0] as Record<string, unknown>;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const parcels = o.parcels ?? o.Parcels;
    if (Array.isArray(parcels) && parcels.some((x) => x != null && typeof x === "object")) {
      return o;
    }
    const items = o.items ?? o.Items;
    if (Array.isArray(items) && items[0] && typeof items[0] === "object") {
      return items[0] as Record<string, unknown>;
    }
  }
  return null;
}

function getParcelStr(p: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === "string" && v.trim() !== "") return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

/** UI ve merge camelCase kullanır; Nesy Parcel/Barcode gibi PascalCase döndüğünde barcode alanı ezilmiyordu. */
function normalizeParcelForMerge(p: Record<string, unknown>): Record<string, unknown> {
  const barcode = getParcelStr(p, "barcode", "Barcode");
  const customerBarcode = getParcelStr(p, "customerBarcode", "CustomerBarcode");
  const legacy = getParcelStr(p, "legacySystemShortBarcode", "LegacySystemShortBarcode");
  const parcelId = p.parcelId ?? p.ParcelId;
  const order = p.order ?? p.Order;

  return {
    ...p,
    ...(barcode !== undefined ? { barcode } : {}),
    ...(customerBarcode !== undefined ? { customerBarcode } : {}),
    ...(legacy !== undefined ? { legacySystemShortBarcode: legacy } : {}),
    ...(parcelId !== undefined ? { parcelId } : {}),
    ...(order !== undefined ? { order } : {}),
  };
}

function epMatchesUnloadScan(ep: Record<string, unknown>, scannedBarcode: string): boolean {
  if (!scannedBarcode) return false;
  const n = normalizeParcelForMerge(ep);
  const candidates = [
    getParcelStr(n, "barcode"),
    getParcelStr(n, "customerBarcode"),
    getParcelStr(n, "legacySystemShortBarcode"),
  ].filter(Boolean) as string[];
  return candidates.includes(scannedBarcode);
}

function parcelsCorrespond(ep: Record<string, unknown>, up: Record<string, unknown>): boolean {
  const a = normalizeParcelForMerge(ep);
  const b = normalizeParcelForMerge(up);

  const pidA = a.parcelId ?? a.ParcelId;
  const pidB = b.parcelId ?? b.ParcelId;
  if (pidA != null && pidB != null && String(pidA) === String(pidB)) {
    return true;
  }

  const barA = getParcelStr(a, "barcode");
  const barB = getParcelStr(b, "barcode");
  if (barA && barB && barA === barB) {
    return true;
  }

  const legA = getParcelStr(a, "legacySystemShortBarcode");
  const legB = getParcelStr(b, "legacySystemShortBarcode");
  if (legA && legB && legA === legB) {
    return true;
  }

  const custA = getParcelStr(a, "customerBarcode");
  const custB = getParcelStr(b, "customerBarcode");
  if (custA && custB && custA === custB) {
    return true;
  }

  const idsA = [barA, custA, legA].filter(Boolean) as string[];
  const idsB = new Set([barB, custB, legB].filter(Boolean) as string[]);
  for (const id of idsA) {
    if (idsB.has(id)) {
      return true;
    }
  }

  return false;
}

function mergeParcelsFromUnloadResponse(
  existingParcels: Record<string, unknown>[],
  unloadParcels: Record<string, unknown>[],
  scannedBarcode: string
): Record<string, unknown>[] {
  const n = unloadParcels.length;
  const usedUp = new Set<number>();

  const upIndexForEp: (number | undefined)[] = existingParcels.map((ep) => {
    for (let i = 0; i < n; i++) {
      if (usedUp.has(i)) continue;
      if (parcelsCorrespond(ep, unloadParcels[i])) {
        usedUp.add(i);
        return i;
      }
    }
    return undefined;
  });

  for (let j = 0; j < existingParcels.length; j++) {
    if (upIndexForEp[j] !== undefined) continue;
    if (!epMatchesUnloadScan(existingParcels[j], scannedBarcode)) continue;
    for (let i = 0; i < n; i++) {
      if (usedUp.has(i)) continue;
      usedUp.add(i);
      upIndexForEp[j] = i;
      break;
    }
  }

  const merged = existingParcels.map((ep, j) => {
    const ui = upIndexForEp[j];
    if (ui === undefined) return ep;
    return { ...ep, ...normalizeParcelForMerge(unloadParcels[ui]) };
  });

  for (let i = 0; i < n; i++) {
    if (usedUp.has(i)) continue;
    merged.push(normalizeParcelForMerge(unloadParcels[i]));
  }

  return merged;
}

function buildUnloadPayload(barcode: string) {
  return {
    filterList: [{ value: barcode }],
    weight: "1",
    isOversize: false,
    isSpecialHandling: false,
    isEurodisTrasSending: true,
    isOnlySearchFromMipOrder: false,
    isCargoService: false,
    isReGeocoded: false,
    hubName: "OSE Zagreb (Central)",
    hubId: "10",
    eventLocation: {
      lat: 45.75312,
      lon: 15.89509,
      zipCode: "10251",
      city: "HRVATSKI LESKOVAC",
    },
    channel: "Portal",
    unloadChannel: 1,
    CounterId: "d012617d-adbf-49cf-bada-aa679b6f701e",
    checkIfParcelIsUnloaded: true,
    noDataEntry: null,
    isPrintRequired: false,
    isNoDataProcessContinue: true,
    IsComeFromNoDataPage: false,
    isNoneScaleUser: false,
    eventShortCode: "INIT",
    isMultipleUnloadFromSameHubWarningEnabled: false,
    isGrayLabelProcessed: false,
    isCancelShipment: false,
    shipmentIdsToDelete: [],
    multipleUnloadAllowed: false,
    requestTime: new Date().toISOString(),
    isTriggeredAfterUpdateShipment: false,
  };
}

// ─── POST /create ──────────────────────────────────────────────
interface CreateShipmentBody {
  token?: string;
  country?: NesyCountry;
  environment?: NesyEnvironment;
  parcelCount?: number;
  shipmentType?: ShipmentType;
  codAmount?: number;
  codCurrency?: string;
  iban?: string;
  bicSwift?: string;
  integrationCode1?: string;
  receiverName?: string;
  counterLocationConsigneeId?: string;
  customer?: BffCustomerPayload;
  parties?: BffCreateShipmentParties;
  /** Verilmezse portal ile aynı: "CPP in cash" */
  billingOption?: string;
  /** Verilmezse 2 (Nesy staging örnek isteği ile uyumlu) */
  payerType?: number;
}

router.post("/create", async (req, res) => {
  try {
    const body = req.body as CreateShipmentBody;
    const {
      token,
      country,
      environment,
      parcelCount = 1,
      shipmentType = "standard",
      codAmount,
      codCurrency,
      iban,
      bicSwift,
      integrationCode1,
      receiverName,
      counterLocationConsigneeId,
      customer,
      parties,
      billingOption: billingOptionRaw,
      payerType: payerTypeRaw,
    } = body;

    const billingOption =
      typeof billingOptionRaw === "string" && billingOptionRaw.trim() !== ""
        ? billingOptionRaw.trim()
        : "CPP in cash";
    const payerType =
      typeof payerTypeRaw === "number" && !Number.isNaN(payerTypeRaw)
        ? payerTypeRaw
        : 2;

    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }

    if (shipmentType === "cod" && (typeof codAmount !== "number" || Number.isNaN(codAmount))) {
      res.status(400).json({ message: "codAmount is required for COD shipment type." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const billing = { billingOption, payerType };
    const codExtra: Record<string, unknown> =
      shipmentType === "cod"
        ? {
            shouldUpdateTransTypeForPriceCalculation:
              (codCurrency ?? "EUR").toUpperCase() !== "EUR",
          }
        : {};
    if (integrationCode1?.trim()) {
      codExtra.integrationCode1 = integrationCode1.trim();
    }
    if (counterLocationConsigneeId?.trim()) {
      codExtra.counterLocationConsigneeId = counterLocationConsigneeId.trim();
    }

    const services = buildServices(
      shipmentType,
      { codAmount, codCurrency, iban, bicSwift },
      receiverName,
    );

    let payload: Record<string, unknown>;

    if (parties) {
      const parcels = Array.from({ length: parcelCount }, () => ({
        barcode: "",
        customerBarcode: "",
        weight: 1,
        parcelType: "PARCEL",
        pricingUnit: "WeightPerUnit",
        goodCategory: 0,
        integrationCode: "",
      }));
      payload = buildShipmentPayloadFromParties(
        parties,
        parcels,
        parcelCount,
        services,
        billing,
        codExtra,
      );
    } else {
      payload = buildShipmentPayload(parcelCount, shipmentType, codAmount, customer, billing);
      if (integrationCode1?.trim()) {
        payload.integrationCode1 = integrationCode1.trim();
      }
      if (counterLocationConsigneeId?.trim()) {
        payload.counterLocationConsigneeId = counterLocationConsigneeId.trim();
      }
      payload.services = services;
    }

    const createResponse = await fetch(`${baseUrl}/Shipment/ClientSaveShipment`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify(payload),
    });

    if (!createResponse.ok) {
      const errorBody = await createResponse.text();
      res.status(502).json({
        message: "Nesy ClientSaveShipment failed.",
        status: createResponse.status,
        detail: errorBody,
      });
      return;
    }

    const createResult = (await createResponse.json()) as Record<string, unknown>;

    if (process.env.NESY_SHIPMENT_DEBUG === "1") {
      const preview = JSON.stringify(createResult);
      console.info(
        "[ClientSaveShipment] status=%s resultKeys=%s preview=%s",
        createResponse.status,
        Object.keys(createResult).join(","),
        preview.length > 800 ? `${preview.slice(0, 800)}…` : preview
      );
    }

    if (!isNesyResultOk(createResult)) {
      res.status(502).json({
        message: String(
          createResult.resultMessage ?? createResult.ResultMessage ?? "Nesy returned non-200 resultCode."
        ),
        resultCode: createResult.resultCode ?? createResult.ResultCode,
        result: createResult,
      });
      return;
    }

    const shipmentId = extractShipmentIdFromNesySaveResponse(createResult);
    if (!shipmentId) {
      console.warn(
        "[ClientSaveShipment] could not parse shipmentId; topKeys=%s",
        Object.keys(createResult).join(",")
      );
      res.status(502).json({
        message: "Nesy did not return a shipmentId (waybill). Check result shape (camelCase / PascalCase).",
        result: createResult,
      });
      return;
    }

    const searchResponse = await fetch(`${baseUrl}/Shipment/SearchShipment`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({ ShipmentIds: [shipmentId] }),
    });

    let shipmentData: Record<string, unknown> = { shipmentId };

    if (searchResponse.ok) {
      const searchResult = (await searchResponse.json()) as {
        payload?: { items?: unknown[]; Items?: unknown[] };
        Payload?: { items?: unknown[]; Items?: unknown[] };
      };
      const pl = searchResult.payload ?? searchResult.Payload;
      const items = pl?.items ?? pl?.Items;
      if (Array.isArray(items) && items[0] && typeof items[0] === "object") {
        shipmentData = items[0] as Record<string, unknown>;
      }
    }

    const saved = await prisma.shipment.create({
      data: {
        country,
        environment,
        data: shipmentData as Prisma.InputJsonValue,
        unloadStatus: "Pending",
      },
    });

    res.json({ data: saved });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during shipment creation.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─── POST /details (SearchShipment by id) — must be before /:id/unload
interface ShipmentDetailsBody {
  token?: string;
  country?: NesyCountry;
  environment?: NesyEnvironment;
  shipmentId?: string;
}

router.post("/details", async (req, res) => {
  try {
    const body = req.body as ShipmentDetailsBody;
    const { token, country, environment, shipmentId } = body;

    if (!token || !country || !environment || !shipmentId?.trim()) {
      res.status(400).json({ message: "token, country, environment, shipmentId are required." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const searchResponse = await fetch(`${baseUrl}/Shipment/SearchShipment`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({ ShipmentIds: [shipmentId.trim()] }),
    });

    if (!searchResponse.ok) {
      const errorBody = await searchResponse.text();
      res.status(502).json({
        message: "Nesy SearchShipment failed.",
        status: searchResponse.status,
        detail: errorBody,
      });
      return;
    }

    const searchResult = (await searchResponse.json()) as {
      payload?: { items?: Record<string, unknown>[]; Items?: Record<string, unknown>[] };
      Payload?: { items?: Record<string, unknown>[]; Items?: Record<string, unknown>[] };
    };
    const pl = searchResult.payload ?? searchResult.Payload;
    const items = pl?.items ?? pl?.Items;
    const first = Array.isArray(items) ? items[0] ?? null : null;
    if (!first) {
      res.status(404).json({ message: "Shipment not found for the given id." });
      return;
    }

    res.json({ data: first });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error while fetching shipment details.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

interface ShipmentScopedBody {
  token?: string;
  country?: NesyCountry;
  environment?: NesyEnvironment;
  shipmentId?: string;
}

router.post("/events", async (req, res) => {
  try {
    const body = req.body as ShipmentScopedBody;
    const { token, country, environment, shipmentId } = body;

    if (!token || !country || !environment || !shipmentId?.trim()) {
      res.status(400).json({ message: "token, country, environment, shipmentId are required." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const response = await fetch(`${baseUrl}/EventTower/GetEvents`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({ ShipmentId: shipmentId.trim() }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      res.status(502).json({
        message: "Nesy GetEvents failed.",
        status: response.status,
        detail: errorBody,
      });
      return;
    }

    const result = (await response.json()) as Record<string, unknown>;
    res.json({ data: result });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error while fetching shipment events.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/pricing", async (req, res) => {
  try {
    const body = req.body as ShipmentScopedBody;
    const { token, country, environment, shipmentId } = body;

    if (!token || !country || !environment || !shipmentId?.trim()) {
      res.status(400).json({ message: "token, country, environment, shipmentId are required." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const response = await fetch(`${baseUrl}/Shipment/GetShipmentPricing`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({ ShipmentId: shipmentId.trim() }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      res.status(502).json({
        message: "Nesy GetShipmentPricing failed.",
        status: response.status,
        detail: errorBody,
      });
      return;
    }

    const result = (await response.json()) as Record<string, unknown>;
    res.json({ data: result });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error while fetching shipment pricing.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

interface ShipmentDisplayLabelBody {
  token?: string;
  country?: NesyCountry;
  environment?: NesyEnvironment;
}

interface BulkShipmentDisplayLabelBody extends ShipmentDisplayLabelBody {
  ids?: unknown;
}

router.post("/display-label/bulk", async (req, res) => {
  try {
    const body = req.body as BulkShipmentDisplayLabelBody;
    const { token } = body;
    const country = isNesyCountry(body.country) ? body.country : undefined;
    const environment = isNesyEnvironment(body.environment) ? body.environment : undefined;
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id) => String(id).trim()).filter(Boolean)
      : [];

    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    if (ids.length === 0) {
      res.status(400).json({ message: "ids array is required." });
      return;
    }

    const shipments = await prisma.shipment.findMany({ where: { id: { in: ids } } });
    const shipmentIds = shipments
      .map((shipment) => {
        const data = shipment.data as Record<string, unknown>;
        return typeof data.shipmentId === "string" ? data.shipmentId.trim() : "";
      })
      .filter(Boolean);

    if (shipmentIds.length === 0) {
      res.status(400).json({ message: "Selected shipment records do not include Nesy shipment ids." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const searchResponse = await fetch(`${baseUrl}/Shipment/SearchShipment`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({ ShipmentIds: shipmentIds }),
    });

    if (!searchResponse.ok) {
      const errorBody = await searchResponse.text();
      res.status(502).json({
        message: "Nesy SearchShipment failed.",
        status: searchResponse.status,
        detail: errorBody,
      });
      return;
    }

    const searchResult = (await searchResponse.json()) as {
      payload?: { items?: Record<string, unknown>[]; Items?: Record<string, unknown>[] };
      Payload?: { items?: Record<string, unknown>[]; Items?: Record<string, unknown>[] };
    };
    const pl = searchResult.payload ?? searchResult.Payload;
    const items = pl?.items ?? pl?.Items;
    const shipmentModels = Array.isArray(items) ? items.filter(Boolean) : [];
    if (shipmentModels.length === 0) {
      res.status(404).json({ message: "No selected shipments were found in Nesy." });
      return;
    }

    const labelResponse = await fetch(`${baseUrl}/Document/GetShipmentLabel`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({
        LabelFormatType: 1,
        Content: shipmentModels,
      }),
    });

    if (!labelResponse.ok) {
      const errorBody = await labelResponse.text();
      res.status(502).json({
        message: "Nesy GetShipmentLabel failed.",
        status: labelResponse.status,
        detail: errorBody,
      });
      return;
    }

    const labelResult = (await labelResponse.json()) as {
      payload?: { content?: string; Content?: string };
      Payload?: { content?: string; Content?: string };
    };
    const labelPayload = labelResult.payload ?? labelResult.Payload;
    const content = labelPayload?.content ?? labelPayload?.Content;
    if (!content) {
      res.status(502).json({ message: "Nesy GetShipmentLabel did not return PDF content." });
      return;
    }

    res.json({ data: { content, count: shipmentModels.length } });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error while generating bulk shipment labels.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/:id/display-label", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body as ShipmentDisplayLabelBody;
    const { token } = body;
    const country = isNesyCountry(body.country) ? body.country : undefined;
    const environment = isNesyEnvironment(body.environment) ? body.environment : undefined;

    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }

    const shipment = await prisma.shipment.findUnique({ where: { id } });
    if (!shipment) {
      res.status(404).json({ message: "Shipment not found." });
      return;
    }

    const data = shipment.data as Record<string, unknown>;
    const shipmentId = typeof data.shipmentId === "string" ? data.shipmentId.trim() : "";
    if (!shipmentId) {
      res.status(400).json({ message: "Shipment record does not include a Nesy shipment id." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const searchResponse = await fetch(`${baseUrl}/Shipment/SearchShipment`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({ ShipmentIds: [shipmentId] }),
    });

    if (!searchResponse.ok) {
      const errorBody = await searchResponse.text();
      res.status(502).json({
        message: "Nesy SearchShipment failed.",
        status: searchResponse.status,
        detail: errorBody,
      });
      return;
    }

    const searchResult = (await searchResponse.json()) as {
      payload?: { items?: Record<string, unknown>[]; Items?: Record<string, unknown>[] };
      Payload?: { items?: Record<string, unknown>[]; Items?: Record<string, unknown>[] };
    };
    const pl = searchResult.payload ?? searchResult.Payload;
    const items = pl?.items ?? pl?.Items;
    const shipmentModel = Array.isArray(items) ? items[0] ?? null : null;
    if (!shipmentModel) {
      res.status(404).json({ message: "Shipment not found for the given id." });
      return;
    }

    const labelResponse = await fetch(`${baseUrl}/Document/GetShipmentLabel`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({
        LabelFormatType: 1,
        Content: [shipmentModel],
      }),
    });

    if (!labelResponse.ok) {
      const errorBody = await labelResponse.text();
      res.status(502).json({
        message: "Nesy GetShipmentLabel failed.",
        status: labelResponse.status,
        detail: errorBody,
      });
      return;
    }

    const labelResult = (await labelResponse.json()) as {
      payload?: { content?: string; Content?: string };
      Payload?: { content?: string; Content?: string };
    };
    const labelPayload = labelResult.payload ?? labelResult.Payload;
    const content = labelPayload?.content ?? labelPayload?.Content;
    if (!content) {
      res.status(502).json({ message: "Nesy GetShipmentLabel did not return PDF content." });
      return;
    }

    res.json({ data: { content } });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error while generating shipment label.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─── POST /:id/unload ──────────────────────────────────────────
interface UnloadBody {
  token?: string;
  country?: NesyCountry;
  environment?: NesyEnvironment;
  barcode?: string;
  isLastParcel?: boolean;
}

router.post("/:id/unload", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body as UnloadBody;
    const { token, country, environment, barcode, isLastParcel = false } = body;

    if (!token || !country || !environment || !barcode) {
      res.status(400).json({ message: "token, country, environment, barcode are required." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const unloadPayload = buildUnloadPayload(barcode);

    const unloadResponse = await fetch(`${baseUrl}/Shipment/Unload`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify(unloadPayload),
    });

    if (!unloadResponse.ok) {
      const errorBody = await unloadResponse.text();
      res.status(502).json({
        message: "Nesy Unload failed.",
        status: unloadResponse.status,
        detail: errorBody,
      });
      return;
    }

    const unloadResult = await unloadResponse.json() as Record<string, unknown>;
    const unloadItem = extractFirstUnloadShipmentItem(unloadResult);

    const existing = await prisma.shipment.findUnique({ where: { id } });
    const existingData = (existing?.data ?? {}) as Record<string, unknown>;
    const existingRawParcels =
      existingData.parcels ?? (existingData as { Parcels?: unknown }).Parcels;
    const existingParcels = Array.isArray(existingRawParcels)
      ? (existingRawParcels as Record<string, unknown>[])
      : [];

    if (unloadItem) {
      const rawUnloadParcels =
        unloadItem.parcels ?? (unloadItem as { Parcels?: unknown }).Parcels;
      const unloadParcels = Array.isArray(rawUnloadParcels)
        ? (rawUnloadParcels as Record<string, unknown>[])
        : [];

      const mergedParcels = mergeParcelsFromUnloadResponse(
        existingParcels,
        unloadParcels,
        barcode
      );

      const mergedData: Record<string, unknown> = {
        ...existingData,
        parcels: mergedParcels,
      };

      await prisma.shipment.update({
        where: { id },
        data: {
          data: mergedData as Prisma.InputJsonValue,
          ...(isLastParcel ? { unloadStatus: "Completed" } : {}),
        },
      });
    } else if (isLastParcel) {
      await prisma.shipment.update({
        where: { id },
        data: { unloadStatus: "Completed" },
      });
    }

    res.json({ data: unloadResult });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during unload.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─── GET /:id/nesy-url ──────────────────────────────────────────
router.get("/:id/nesy-url", async (req, res) => {
  try {
    const { id } = req.params;
    const shipment = await prisma.shipment.findUnique({ where: { id } });

    if (!shipment) {
      res.status(404).json({ message: "Shipment not found." });
      return;
    }

    const data = shipment.data as Record<string, unknown>;
    const shipmentId = typeof data.shipmentId === "string" ? data.shipmentId : null;
    if (!shipmentId) {
      res.status(400).json({ message: "Shipment record does not include a Nesy shipment id." });
      return;
    }

    const country = isNesyCountry(shipment.country) ? shipment.country : undefined;
    const environment = isNesyEnvironment(shipment.environment) ? shipment.environment : undefined;
    if (!country || !environment) {
      res.status(400).json({ message: "Shipment record does not include country/environment." });
      return;
    }

    const baseUrl = resolveDashboardBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({
        message: `Dashboard base URL not configured for ${country}/${environment}.`,
      });
      return;
    }

    res.json({ data: { url: `${baseUrl}/main/shipment-detail/${encodeURIComponent(shipmentId)}` } });
  } catch (error) {
    res.status(500).json({
      message: "Failed to build Nesy shipment URL.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─── DELETE /bulk ───────────────────────────────────────────────
async function handleShipmentBulkDelete(
  req: { body: unknown },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
    json: (body: unknown) => void;
  },
) {
  try {
    const { ids } = req.body as { ids?: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ message: "ids array is required." });
      return;
    }

    const result = await prisma.shipment.deleteMany({
      where: { id: { in: ids } },
    });

    res.json({ deleted: result.count });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete shipments.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

router.delete("/bulk", (req, res) => void handleShipmentBulkDelete(req, res));
router.post("/bulk/delete", (req, res) => void handleShipmentBulkDelete(req, res));

router.post("/refresh-last-events", async (req, res) => {
  try {
    const body = req.body as NesyCredsBody;
    const { token, country, environment } = body;

    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }

    if (!isNesyCountry(country) || !isNesyEnvironment(environment)) {
      res.status(400).json({ message: "Invalid country or environment." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const shipments = await prisma.shipment.findMany({
      where: { country, environment },
      orderBy: { createdAt: "desc" },
    });

    let updated = 0;
    let failed = 0;
    const errors: { id: string; error: string }[] = [];

    await Promise.all(
      shipments.map(async (shipment) => {
        const data =
          shipment.data && typeof shipment.data === "object" && !Array.isArray(shipment.data)
            ? (shipment.data as Record<string, unknown>)
            : {};
        const nesyId = extractNesyShipmentId(data);

        if (!nesyId) {
          failed += 1;
          errors.push({ id: shipment.id, error: "No Nesy shipment id in stored data." });
          return;
        }

        try {
          const response = await fetch(`${baseUrl}/EventTower/GetEvents`, {
            method: "POST",
            headers: nesyHeaders(token),
            body: JSON.stringify({ ShipmentId: nesyId }),
          });

          if (!response.ok) {
            failed += 1;
            errors.push({
              id: shipment.id,
              error: `GetEvents failed (${response.status}).`,
            });
            return;
          }

          const result = (await response.json()) as Record<string, unknown>;
          const label = resolveLatestEventLabel(result);
          const unloadStatus = label ?? "Pending";

          await prisma.shipment.update({
            where: { id: shipment.id },
            data: { unloadStatus },
          });
          updated += 1;
        } catch (error) {
          failed += 1;
          errors.push({
            id: shipment.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }),
    );

    res.json({
      data: {
        total: shipments.length,
        updated,
        failed,
        errors: errors.slice(0, 20),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error while refreshing shipment last events.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─── GET / ──────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const country = typeof req.query.country === "string" ? req.query.country : undefined;
    const environment =
      typeof req.query.environment === "string" ? req.query.environment : undefined;

    const { shipmentIds: happyPathShipmentIds } = await loadHappyPathLinkedRecordIds();

    const where: Prisma.ShipmentWhereInput = {};
    if (country && environment) {
      where.country = country;
      where.environment = environment;
    }
    if (happyPathShipmentIds.length > 0) {
      where.id = { notIn: happyPathShipmentIds };
    }

    const shipments = await prisma.shipment.findMany({
      ...(Object.keys(where).length > 0 ? { where } : {}),
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: shipments });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    const prismaCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : undefined;
    console.error("[GET /api/shipments] prisma findMany failed:", errMsg, prismaCode ?? "");
    res.status(500).json({
      message:
        "Failed to fetch shipments. Is PostgreSQL running and migrations applied? (DATABASE_URL, prisma migrate)",
      error: errMsg,
      ...(prismaCode ? { prismaCode } : {}),
    });
  }
});

type NesyCredsBody = {
  token?: string;
  country?: NesyCountry;
  environment?: NesyEnvironment;
};

async function proxyNesyPost(
  baseUrl: string,
  token: string,
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: nesyHeaders(token),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: response.ok, status: response.status, json, text };
}

function extractOohItems(json: unknown): unknown[] {
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  const payload = o.payload ?? o.Payload;
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.items)) return p.items;
    if (Array.isArray(p.oohDeliveryPoints)) return p.oohDeliveryPoints;
  }
  if (Array.isArray(o.items)) return o.items;
  return [];
}

// ─── POST /ooh/by-city ─────────────────────────────────────────
router.post("/ooh/by-city", async (req, res) => {
  try {
    const { token, country, environment, city } = req.body as NesyCredsBody & { city?: string };
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    if (!city?.trim()) {
      res.status(400).json({ message: "city is required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }
    const result = await proxyNesyPost(baseUrl, token, "/Shipment/GetOOHDeliveryPointsByCity", {
      City: city.trim(),
    });
    if (!result.ok) {
      res.status(502).json({ message: "Nesy GetOOHDeliveryPointsByCity failed.", detail: result.text });
      return;
    }
    res.json({ data: extractOohItems(result.json) });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error fetching OOH points by city.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─── POST /ooh/by-zip ──────────────────────────────────────────
router.post("/ooh/by-zip", async (req, res) => {
  try {
    const { token, country, environment, zipCode } = req.body as NesyCredsBody & {
      zipCode?: string;
    };
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    if (!zipCode?.trim()) {
      res.status(400).json({ message: "zipCode is required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }
    const result = await proxyNesyPost(
      baseUrl,
      token,
      "/Shipment/GetOOHDeliveryPointsByCityZipCode",
      { ZipCode: zipCode.trim() },
    );
    if (!result.ok) {
      res.status(502).json({
        message: "Nesy GetOOHDeliveryPointsByCityZipCode failed.",
        detail: result.text,
      });
      return;
    }
    res.json({ data: extractOohItems(result.json) });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error fetching OOH points by zip.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─── POST /country/check ───────────────────────────────────────
router.post("/country/check", async (req, res) => {
  try {
    const { token, country, environment, countryCode } = req.body as NesyCredsBody & {
      countryCode?: string;
    };
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    if (!countryCode?.trim()) {
      res.status(400).json({ message: "countryCode is required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }
    const result = await proxyNesyPost(baseUrl, token, "/Shipment/CheckCountryIsEligible", {
      CountryCode: countryCode.trim().toUpperCase(),
    });
    if (!result.ok) {
      res.status(502).json({ message: "Nesy CheckCountryIsEligible failed.", detail: result.text });
      return;
    }
    const json = result.json as Record<string, unknown>;
    const payload = json.payload ?? json.Payload ?? json;
    res.json({ data: payload });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error checking country eligibility.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
