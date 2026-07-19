// @ts-nocheck
import { Router, type Router as RouterType } from "express";
import { prisma, type Prisma } from "@nesy/db";
import type { BffCustomerPayload } from "./nesy-customer-payload.js";
import {
  type NesyCountry,
  type NesyEnvironment,
  resolveDashboardBaseUrl,
  resolveBaseUrl,
  nesyHeaders,
  formatDateOnly,
} from "../nesy-env.js";
import { extractShipmentIdFromNesySaveResponse, isNesyResultOk } from "./nesy-save-response.js";
import {
  ensureHappyPathRecordTagsBackfill,
  loadHappyPathLinkedRecordIds,
  mergeHappyPathOrigin,
} from "./happy-path-list-exclusions.js";

const router: RouterType = Router();

const nesyCountries = new Set<NesyCountry>(["HR", "SI", "RS", "BA", "ME", "SK", "AZ"]);
const nesyEnvironments = new Set<NesyEnvironment>(["stage", "prod"]);

function isNesyCountry(value: unknown): value is NesyCountry {
  return typeof value === "string" && nesyCountries.has(value as NesyCountry);
}

function isNesyEnvironment(value: unknown): value is NesyEnvironment {
  return typeof value === "string" && nesyEnvironments.has(value as NesyEnvironment);
}

type BffPickupType = "remote" | "customer";

const NESY_PICKUP_TYPE: Record<BffPickupType, number> = {
  remote: 2,
  customer: 3,
};

interface PickupScheduleOptions {
  pickUpDateOffsetDays?: number;
  pickupEndTime?: string;
  parcelWeight?: number;
}

function parseTimeHHmm(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function buildPickupSchedule(options?: PickupScheduleOptions) {
  const offsetDays = options?.pickUpDateOffsetDays ?? 3;
  const endTime = parseTimeHHmm(options?.pickupEndTime ?? "21:00") ?? {
    hours: 21,
    minutes: 0,
  };

  const now = new Date();
  const pickupDate = new Date(now);
  pickupDate.setDate(pickupDate.getDate() + offsetDays);

  const pickupEndDate = new Date(pickupDate);
  pickupEndDate.setHours(endTime.hours, endTime.minutes, 0, 0);

  const pickupTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const pickupEndTime = `${String(endTime.hours).padStart(2, "0")}:${String(endTime.minutes).padStart(2, "0")}`;

  return {
    pickUpDate: pickupDate.toISOString(),
    pickupEndDate: pickupEndDate.toISOString(),
    pickupTime,
    pickupEndTime,
  };
}

function buildDefaultParcel(weight: number) {
  return {
    barcode: "",
    customerBarcode: "",
    weight,
    parcelType: "PARCEL",
    pricingUnit: "WeightPerUnit",
    goodCategory: 0,
    integrationCode: "",
    isOverweight: false,
  };
}

function getPickupFields(
  shipmentCount: number,
  pickupType: BffPickupType,
  parcelWeight = 5,
) {
  const isPac = pickupType === "customer";
  return {
    parcels: isPac
      ? []
      : Array.from({ length: shipmentCount }, () => buildDefaultParcel(parcelWeight)),
    parcelCount: isPac ? 0 : shipmentCount,
    pickupFlag: isPac ? "x" : "+",
    pickupType: NESY_PICKUP_TYPE[pickupType],
    ...(isPac && shipmentCount > 0 ? { pickupRemark: `${shipmentCount}x` } : {}),
  };
}

function buildPickupShipmentPayload(
  shipmentCount: number,
  pickupType: BffPickupType = "remote",
  customer?: BffCustomerPayload,
  schedule?: PickupScheduleOptions,
) {
  const parcelWeight = schedule?.parcelWeight ?? 5;
  const pickupFields = getPickupFields(shipmentCount, pickupType, parcelWeight);
  const pickupSchedule = buildPickupSchedule(schedule);

  if (customer) {
    const raw = customer.name.trim();
    const withUnderscore = raw.startsWith("_") ? raw : `_${raw}`;
    const noUnderscore = raw.replace(/^_/, "");
    const addressTitle = customer.addressTitle?.trim() || noUnderscore;

    return {
      customerCustomer: withUnderscore,
      customerCustomerId: customer.customerId,
      customerName: withUnderscore,
      customerCustomerCenter: customer.customerCenter,
      customerIdentityNumber: null,
      customerContactPerson: null,
      customerPhone: customer.phone,
      customerGsm: customer.gsm,
      customerEmail: customer.email ?? null,
      codReturnBankCode: null,
      customerAddressType: 0,
      customerAddressTitle: addressTitle,
      customerAddressText: "",
      customerAddressCountry: customer.addressCountry,
      customerAddressStreet: customer.addressStreet,
      customerAddressCity: customer.addressCity,
      customerAddressZipCode: customer.addressZipCode,
      customerHouseNumber: null,
      customerDoorNumber: null,
      customerSaveAddress: false,
      counterLocationShipperId: 0,
      customerSaveAddressBookIndex: -1,
      shipperCustomer: withUnderscore,
      shipperCustomerId: customer.customerId,
      shipperName: withUnderscore,
      shipperCustomerCenter: customer.customerCenter,
      shipperIdentityNumber: null,
      shipperContactPerson: null,
      shipperRemark: "",
      shipperPhone: customer.phone,
      shipperGsm: customer.gsm,
      shipperEmail: customer.email ?? null,
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
      isWorldWide: false,
      consigneeCustomer: withUnderscore,
      consigneeName: withUnderscore,
      consigneeCustomerId: customer.customerId,
      consigneeIdentityNumber: null,
      consigneeCustomerCenter: customer.customerCenter,
      consigneeContactPerson: null,
      consigneeRemark: "",
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
      ...pickupFields,
      parcelType: "PARCEL",
      ...pickupSchedule,
      payerType: 1,
      channel: "Portal",
      codCurrency: 0,
      billingOption: "CPP on invoice",
      services: [
        {
          servicePrice: 0,
          localServicePrice: 0,
          serviceName: "Pickup Order",
          serviceType: 34,
          legacySystemServiceId: "0",
        },
        {
          servicePrice: 0,
          localServicePrice: 0,
          serviceName: "Standard",
          serviceType: 24,
          legacySystemServiceId: "1",
        },
      ],
    };
  }

  return {
    customerCustomer: "_OVERSEAS IT&IS",
    customerCustomerId: 10330,
    customerName: "_OVERSEAS IT&IS",
    customerCustomerCenter: "1",
    customerIdentityNumber: null,
    customerContactPerson: null,
    customerPhone: "4607-000",
    customerGsm: "4607-000",
    customerEmail: null,
    codReturnBankCode: null,
    customerAddressType: 0,
    customerAddressTitle: "OVERSEAS IT&IS",
    customerAddressText: "",
    customerAddressCountry: "HR",
    customerAddressStreet: "ZASTAVNICE 38A",
    customerAddressCity: "HRVATSKI LESKOVAC",
    customerAddressZipCode: "10251",
    customerHouseNumber: null,
    customerDoorNumber: null,
    customerSaveAddress: false,
    counterLocationShipperId: 0,
    customerSaveAddressBookIndex: -1,
    shipperCustomer: "_OVERSEAS IT&IS",
    shipperCustomerId: 10330,
    shipperName: "_OVERSEAS IT&IS",
    shipperCustomerCenter: "1",
    shipperIdentityNumber: null,
    shipperContactPerson: null,
    shipperRemark: "",
    shipperPhone: "4607-000",
    shipperGsm: "4607-000",
    shipperEmail: null,
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
    isWorldWide: false,
    consigneeCustomer: "_OVERSEAS IT&IS",
    consigneeName: "_OVERSEAS IT&IS",
    consigneeCustomerId: 10330,
    consigneeIdentityNumber: null,
    consigneeCustomerCenter: "1",
    consigneeContactPerson: null,
    consigneeRemark: "",
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
    ...pickupFields,
    parcelType: "PARCEL",
    ...pickupSchedule,
    payerType: 1,
    channel: "Portal",
    codCurrency: 0,
    billingOption: "CPP on invoice",
    services: [
      {
        servicePrice: 0,
        localServicePrice: 0,
        serviceName: "Pickup Order",
        serviceType: 34,
        legacySystemServiceId: "0",
      },
      {
        servicePrice: 0,
        localServicePrice: 0,
        serviceName: "Standard",
        serviceType: 24,
        legacySystemServiceId: "1",
      },
    ],
  };
}

interface PickupListItem {
  id: string;
  createdAt: string;
  date: string;
  courierZoneCode: string;
  hubId: string;
  taskType: number;
  sender: string;
  campaignCode: string;
  pickupAddress: string;
  pickupFromTime: string;
  pickupToTime: string;
  pickUpType: number;
  isSeriesPickup: boolean;
  consigneeCustomerId: string;
  consigneeName: string;
}

interface CreatePickupBody {
  token?: string;
  country?: NesyCountry;
  environment?: NesyEnvironment;
  pickupType?: "remote" | "customer";
  shipmentCount?: number;
  pickUpDateOffsetDays?: number;
  pickupEndTime?: string;
  parcelWeight?: number;
  branchId?: string;
  courierZoneCode?: string;
  customer?: BffCustomerPayload;
  happyPathOrigin?: boolean;
}

router.post("/create", async (req, res) => {
  try {
    const body = req.body as CreatePickupBody;
    const {
      token,
      country,
      environment,
      pickupType = "remote",
      shipmentCount = 1,
      pickUpDateOffsetDays,
      pickupEndTime,
      parcelWeight,
      branchId,
      courierZoneCode,
      customer,
      happyPathOrigin,
    } = body;

    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const payload = buildPickupShipmentPayload(shipmentCount, pickupType, customer, {
      pickUpDateOffsetDays,
      pickupEndTime,
      parcelWeight,
    });

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
    if (!isNesyResultOk(createResult)) {
      res.status(502).json({
        message: String(createResult.resultMessage ?? "Nesy returned non-200 resultCode."),
        resultCode: createResult.resultCode,
        result: createResult,
      });
      return;
    }
    const waybillNumber = extractShipmentIdFromNesySaveResponse(createResult);
    if (!waybillNumber) {
      res.status(502).json({
        message: "Nesy did not return a shipmentId (waybill).",
        result: createResult,
      });
      return;
    }

    const searchResponse = await fetch(`${baseUrl}/Shipment/SearchShipment`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({ ShipmentIds: [waybillNumber] }),
    });

    let shipmentData: Record<string, unknown> = { shipmentId: waybillNumber };

    if (searchResponse.ok) {
      const searchResult = (await searchResponse.json()) as {
        payload?: { items?: Record<string, unknown>[] };
      };
      if (searchResult.payload?.items?.[0]) {
        shipmentData = searchResult.payload.items[0];
      }
    }

    let resolvedTaskId: string | null = null;

    const declaredPickupDate = shipmentData.declaredPickupDate as string | undefined;
    let pickupDateStr: string;
    if (declaredPickupDate) {
      pickupDateStr = formatDateOnly(new Date(declaredPickupDate));
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      pickupDateStr = formatDateOnly(d);
    }

    const pickupListBody = {
      startDate: pickupDateStr,
      endDate: pickupDateStr,
      hubId: "100",
      pickupFromTime: null,
      pickupToTime: null,
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 3000));
        const listResponse = await fetch(`${baseUrl}/Task/GetPickupList`, {
          method: "POST",
          headers: nesyHeaders(token),
          body: JSON.stringify(pickupListBody),
        });
        if (!listResponse.ok) continue;
        const listResult = (await listResponse.json()) as {
          payload?: Array<Record<string, unknown>>;
        };
        const match = (listResult.payload ?? []).find(
          (p) => (p.campaignCode ?? p.CampaignCode) === waybillNumber
        );
        if (match) {
          resolvedTaskId = (match.id ?? match.Id) as string | null;
          break;
        }
      } catch {
        // retry
      }
    }

    const saved = await prisma.pickup.create({
      data: {
        pickupType,
        shipmentId: waybillNumber,
        assignStatus: "Pending",
        taskId: resolvedTaskId,
        branchId: branchId?.trim() || null,
        courierZoneCode: courierZoneCode?.trim() || null,
        country,
        environment,
        data: mergeHappyPathOrigin(
          shipmentData as Record<string, unknown>,
          happyPathOrigin,
        ) as Prisma.InputJsonValue,
      },
    });

    res.json({ data: saved });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during pickup creation.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

interface PickupTaskDetailBody {
  token?: string;
  country?: NesyCountry;
  environment?: NesyEnvironment;
  shipmentId?: string;
  startDate?: string;
  endDate?: string;
}

router.post("/task-detail", async (req, res) => {
  try {
    const body = req.body as PickupTaskDetailBody;
    const { token, country, environment, shipmentId, startDate, endDate } = body;

    if (!token || !country || !environment || !shipmentId?.trim()) {
      res.status(400).json({ message: "token, country, environment, shipmentId are required." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const waybill = shipmentId.trim();
    let pickupDateStr: string;

    if (startDate?.trim() && endDate?.trim()) {
      pickupDateStr = startDate.trim();
      const end = endDate.trim();
      const pickupListResponse = await fetch(`${baseUrl}/Task/GetPickupList`, {
        method: "POST",
        headers: nesyHeaders(token),
        body: JSON.stringify({
          startDate: pickupDateStr,
          endDate: end,
          hubId: "100",
          pickupFromTime: null,
          pickupToTime: null,
        }),
      });

      if (!pickupListResponse.ok) {
        const text = await pickupListResponse.text();
        res.status(502).json({
          message: "Nesy GetPickupList failed.",
          status: pickupListResponse.status,
          detail: text,
        });
        return;
      }

      const listResult = (await pickupListResponse.json()) as { payload?: Array<PickupListItem> };
      const match = (listResult.payload ?? []).find((p) => p.campaignCode === waybill) ?? null;
      if (!match) {
        res.status(404).json({ message: "Pickup task not found for this shipment in the given date range." });
        return;
      }

      res.json({
        data: {
          taskId: match.id,
          branchId: match.hubId,
          courierZoneCode: match.courierZoneCode,
          waybillNumber: waybill,
          match,
        },
      });
      return;
    }

    const searchResponse = await fetch(`${baseUrl}/Shipment/SearchShipment`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({ ShipmentIds: [waybill] }),
    });

    let declaredPickupDate: string | undefined;
    if (searchResponse.ok) {
      const searchResult = (await searchResponse.json()) as {
        payload?: { items?: Array<Record<string, unknown>> };
      };
      const first = searchResult.payload?.items?.[0];
      if (first?.declaredPickupDate) {
        declaredPickupDate = first.declaredPickupDate as string;
      }
    }

    if (declaredPickupDate) {
      pickupDateStr = formatDateOnly(new Date(declaredPickupDate));
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      pickupDateStr = formatDateOnly(d);
    }

    const pickupListResponse = await fetch(`${baseUrl}/Task/GetPickupList`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({
        startDate: pickupDateStr,
        endDate: pickupDateStr,
        hubId: "100",
        pickupFromTime: null,
        pickupToTime: null,
      }),
    });

    if (!pickupListResponse.ok) {
      const text = await pickupListResponse.text();
      res.status(502).json({
        message: "Nesy GetPickupList failed.",
        status: pickupListResponse.status,
        detail: text,
      });
      return;
    }

    const listResult = (await pickupListResponse.json()) as { payload?: Array<PickupListItem> };
    const match = (listResult.payload ?? []).find((p) => p.campaignCode === waybill) ?? null;
    if (!match) {
      res.status(404).json({ message: "Pickup task not found in Nesy pickup list for the resolved date." });
      return;
    }

    res.json({
      data: {
        taskId: match.id,
        branchId: match.hubId,
        courierZoneCode: match.courierZoneCode,
        waybillNumber: waybill,
        resolvedDate: pickupDateStr,
        match,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error while fetching pickup task detail.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

interface AssignBody {
  token?: string;
  country?: NesyCountry;
  environment?: NesyEnvironment;
  branchId?: string;
  courierZoneCode?: string;
  date?: string;
}

router.post("/:id/assign", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body as AssignBody;
    const { token, country, environment } = body;

    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }

    const pickup = await prisma.pickup.findUnique({ where: { id } });
    if (!pickup) {
      res.status(404).json({ message: "Pickup not found." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const shipmentData = pickup.data as Record<string, unknown>;
    const waybillNumber = pickup.shipmentId;
    const branchId = body.branchId?.trim() || pickup.branchId;
    const courierZoneCode = body.courierZoneCode?.trim() || pickup.courierZoneCode;

    if (!branchId || !courierZoneCode) {
      res.status(400).json({
        message: "branchId and courierZoneCode are required. Provide them in the request or ensure they exist on the pickup record.",
      });
      return;
    }

    const declaredPickupDate = shipmentData.declaredPickupDate as string | undefined;
    let pickupDateStr: string;
    if (declaredPickupDate) {
      pickupDateStr = formatDateOnly(new Date(declaredPickupDate));
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      pickupDateStr = formatDateOnly(d);
    }

    const pickupListResponse = await fetch(`${baseUrl}/Task/GetPickupList`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({
        startDate: pickupDateStr,
        endDate: pickupDateStr,
        hubId: "100",
        pickupFromTime: null,
        pickupToTime: null,
      }),
    });

    if (!pickupListResponse.ok) {
      await prisma.pickup.update({ where: { id }, data: { assignStatus: "PickupListFailed" } });
      res.status(502).json({ message: "Failed to get pickup list from Nesy." });
      return;
    }

    const pickupListResult = (await pickupListResponse.json()) as {
      payload?: Array<PickupListItem>;
    };

    const pickups = pickupListResult.payload ?? [];
    const match = pickups.find((p) => p.campaignCode === waybillNumber);

    if (!match) {
      await prisma.pickup.update({ where: { id }, data: { assignStatus: "TaskNotFound" } });
      res.status(404).json({ message: "Pickup not found in Nesy pickup list." });
      return;
    }

    const nesyPickupId = match.id;

    const todayIso = new Date().toISOString();
    const assignDate = body.date ? new Date(body.date).toISOString() : todayIso;

    const updatePayload = {
      ...match,
      hubId: branchId,
      courierZoneCode,
      date: assignDate,
      shipperCustomerId: match.consigneeCustomerId,
    };

    const updateResponse = await fetch(`${baseUrl}/Task/UpdatePickup`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify(updatePayload),
    });

    const updateResult = updateResponse.ok ? await updateResponse.json() : await updateResponse.text();

    if (!updateResponse.ok) {
      await prisma.pickup.update({ where: { id }, data: { assignStatus: "UpdatePickupFailed" } });
      res.status(502).json({ message: "Task/UpdatePickup failed.", detail: updateResult });
      return;
    }

    const scheduleCheckResponse = await fetch(`${baseUrl}/Task/GetTodayScheduleByCourierZone`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify(courierZoneCode),
    });

    const scheduleCheckResult = scheduleCheckResponse.ok
      ? await scheduleCheckResponse.json()
      : await scheduleCheckResponse.text();

    const hasSchedule = scheduleCheckResponse.ok
      && scheduleCheckResult
      && (scheduleCheckResult as Record<string, unknown>).resultCode === 200
      && (scheduleCheckResult as Record<string, unknown>).payload != null;

    if (!hasSchedule) {
      await prisma.pickup.update({
        where: { id },
        data: { assignStatus: "NoSchedule", taskId: nesyPickupId },
      });
      res.status(409).json({
        message: `No active courier/schedule found on route ${courierZoneCode} for today. The pickup has been updated (hub/route set) but cannot be assigned to a schedule yet.`,
        scheduleCheckResult,
      });
      return;
    }

    const assignResponse = await fetch(`${baseUrl}/Task/AssignPickupToCourier`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({ id: nesyPickupId }),
    });

    const assignResult = assignResponse.ok ? await assignResponse.json() : await assignResponse.text();

    if (assignResponse.ok) {
      await prisma.pickup.update({
        where: { id },
        data: { assignStatus: "Assigned", taskId: nesyPickupId },
      });
      res.json({ data: { assignStatus: "Assigned", taskId: nesyPickupId } });
    } else {
      await prisma.pickup.update({
        where: { id },
        data: { assignStatus: "AssignFailed", taskId: nesyPickupId },
      });
      res.status(502).json({
        message: "Task/AssignPickupToCourier failed.",
        status: assignResponse.status,
        detail: assignResult,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during pickup assign.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/:id/nesy-url", async (req, res) => {
  try {
    const { id } = req.params;
    const pickup = await prisma.pickup.findUnique({ where: { id } });

    if (!pickup) {
      res.status(404).json({ message: "Pickup not found." });
      return;
    }

    const country = isNesyCountry(pickup.country) ? pickup.country : undefined;
    const environment = isNesyEnvironment(pickup.environment) ? pickup.environment : undefined;
    if (!country || !environment) {
      res.status(400).json({ message: "Pickup record does not include country/environment." });
      return;
    }

    const baseUrl = resolveDashboardBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({
        message: `Dashboard base URL not configured for ${country}/${environment}.`,
      });
      return;
    }

    res.json({
      data: {
        url: `${baseUrl}/main/shipment-detail/${encodeURIComponent(pickup.shipmentId)}`,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to build Nesy pickup shipment URL.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─── GET /:id ───────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pickup = await prisma.pickup.findUnique({ where: { id } });

    if (!pickup) {
      res.status(404).json({ message: "Pickup not found." });
      return;
    }

    res.json({ data: pickup });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch pickup.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

async function handlePickupBulkDelete(
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

    const result = await prisma.pickup.deleteMany({
      where: { id: { in: ids } },
    });

    res.json({ deleted: result.count });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete pickups.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

router.delete("/bulk", (req, res) => void handlePickupBulkDelete(req, res));
router.post("/bulk/delete", (req, res) => void handlePickupBulkDelete(req, res));

router.get("/", async (req, res) => {
  try {
    await ensureHappyPathRecordTagsBackfill();

    const country = typeof req.query.country === "string" ? req.query.country : undefined;
    const environment =
      typeof req.query.environment === "string" ? req.query.environment : undefined;

    const { pickupIds: happyPathPickupIds } = await loadHappyPathLinkedRecordIds();

    const where: Prisma.PickupWhereInput = {};
    if (country && environment) {
      where.country = country;
      where.environment = environment;
    }
    if (happyPathPickupIds.length > 0) {
      where.id = { notIn: happyPathPickupIds };
    }

    const pickups = await prisma.pickup.findMany({
      ...(Object.keys(where).length > 0 ? { where } : {}),
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: pickups });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch pickups.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
