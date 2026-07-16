import {
  buildDefaultPartySelection,
  buildInitialPartySelection,
  buildPartiesFromDetails,
  findAddressForAssignmentLine,
  mapNesyCustomerDetails,
} from "@/lib/nesy-customer-details";
import {
  bffCustomerFromConsigneeParty,
  mapNesyDetailsToBffPayload,
} from "@/lib/nesy-customer-mapper";
import { getCustomerDetails } from "@/services/customer";
import { createPickup } from "@/services/pickup";
import { createSingleShipment, type ShipmentRecord } from "@/services/shipment";
import {
  getDefaultExwBillingOption,
  type NesyCountryCode,
} from "./shipment-group-settings";
import { HAPPY_PATH_TYPE_CONFIG } from "./happy-path-types";
import type { GenerationJob } from "./happy-path-generation";

interface ExecuteContext {
  token: string;
  country: string;
  environment: string;
}

const customerDetailsCache = new Map<string, ReturnType<typeof mapNesyCustomerDetails>>();

async function resolveParties(
  job: GenerationJob,
  ctx: ExecuteContext,
): Promise<ReturnType<typeof buildPartiesFromDetails>> {
  const cacheKey = `${job.assignment.customerNo}`;
  let details = customerDetailsCache.get(cacheKey);

  if (!details) {
    const raw = await getCustomerDetails({
      token: ctx.token,
      country: ctx.country,
      environment: ctx.environment,
      customerId: job.assignment.customerNo,
      customerCenter: "1",
    });
    details = mapNesyCustomerDetails(raw);
    customerDetailsCache.set(cacheKey, details);
  }

  const shipper = buildInitialPartySelection(details, { selectFirstStandardAddress: true });

  let consignee = buildInitialPartySelection(details, { selectFirstStandardAddress: true });
  if (job.typeId === "delivery-pick") {
    const consigneeAddress = findAddressForAssignmentLine(
      details,
      job.assignment.addressLine,
    );
    if (consigneeAddress) {
      consignee = buildDefaultPartySelection(details, consigneeAddress, "existing");
    }
  }

  const oohPoint = job.settings.oohPoint as
    | { oohPointId?: string; oohName?: string; city?: string; zipCode?: string }
    | undefined;

  if (oohPoint?.oohPointId) {
    consignee.mode = "parcelshop";
    consignee.parcelShop = {
      oohId: oohPoint.oohPointId,
      oohType: "parcelshop",
      name: oohPoint.oohName ?? "OOH Point",
      address: {
        addressType: 10,
        street: "",
        city: oohPoint.city ?? "",
        zipCode: oohPoint.zipCode ?? "",
        countryCode: details.addresses[0]?.countryCode ?? "HR",
      },
    };
  }

  return buildPartiesFromDetails(details, shipper, consignee);
}

export interface ExecuteJobResult {
  recordId: string;
  record?: ShipmentRecord;
  linkedPickupId?: string;
}

export async function executeGenerationJob(
  job: GenerationJob,
  ctx: ExecuteContext,
): Promise<ExecuteJobResult> {
  if (job.route === "skip") {
    throw new Error("Cannot execute skipped job");
  }

  const config = HAPPY_PATH_TYPE_CONFIG[job.typeId];

  if (job.route === "pickup") {
    const raw = await getCustomerDetails({
      token: ctx.token,
      country: ctx.country,
      environment: ctx.environment,
      customerId: job.assignment.customerNo,
      customerCenter: "1",
    });
    const customer = mapNesyDetailsToBffPayload(raw);
    const pickupType = config.pickupType ?? "remote";
    const shipmentCount =
      typeof job.settings.shipmentCount === "number" ? job.settings.shipmentCount : 1;
    const pickUpDateOffsetDays =
      typeof job.settings.pickUpDateOffsetDays === "number"
        ? job.settings.pickUpDateOffsetDays
        : undefined;
    const pickupEndTime =
      typeof job.settings.pickupEndTime === "string" ? job.settings.pickupEndTime : undefined;
    const parcelWeight =
      typeof job.settings.parcelWeight === "number" ? job.settings.parcelWeight : undefined;

    const record = await createPickup({
      token: ctx.token,
      country: ctx.country,
      environment: ctx.environment,
      pickupType,
      shipmentCount,
      happyPathOrigin: true,
      ...(pickUpDateOffsetDays !== undefined ? { pickUpDateOffsetDays } : {}),
      ...(pickupEndTime ? { pickupEndTime } : {}),
      ...(parcelWeight !== undefined ? { parcelWeight } : {}),
      customer,
    });

    return { recordId: record.id };
  }

  const parties = await resolveParties(job, ctx);
  const parcelCount =
    typeof job.settings.parcelCount === "number" ? job.settings.parcelCount : 1;

  const body: Parameters<typeof createSingleShipment>[0] = {
    token: ctx.token,
    country: ctx.country,
    environment: ctx.environment,
    parcelCount,
    shipmentType: config.bffShipmentType ?? "standard",
    parties,
    happyPathOrigin: true,
  };

  if (config.bffShipmentType === "cod") {
    body.codAmount =
      typeof job.settings.codAmount === "number" ? job.settings.codAmount : 10;
    body.codCurrency =
      typeof job.settings.codCurrency === "string" ? job.settings.codCurrency : "EUR";
    body.iban = typeof job.settings.iban === "string" ? job.settings.iban : "";
    body.bicSwift =
      typeof job.settings.bicSwift === "string" ? job.settings.bicSwift : "";
  }

  if (typeof job.settings.integrationCode1 === "string" && job.settings.integrationCode1) {
    body.integrationCode1 = job.settings.integrationCode1;
  }

  if (typeof job.settings.receiverName === "string" && job.settings.receiverName) {
    body.receiverName = job.settings.receiverName;
  }

  if (job.typeId === "exw-delivery") {
    const billingOption =
      job.settings.billingOption === "EXWORKS on invoice" ||
      job.settings.billingOption === "EXWORKS in cash"
        ? job.settings.billingOption
        : getDefaultExwBillingOption((ctx.country as NesyCountryCode) || "RS");
    body.billingOption = billingOption;
    body.payerType = 1;
  }

  const oohPoint = job.settings.oohPoint as { oohPointId?: string } | undefined;
  if (oohPoint?.oohPointId) {
    body.counterLocationConsigneeId = oohPoint.oohPointId;
  }

  const record = await createSingleShipment(body);

  let linkedPickupId: string | undefined;

  if (job.typeId === "delivery-pick") {
    const linkedPickupCustomer = bffCustomerFromConsigneeParty(parties);
    const pickUpDateOffsetDays =
      typeof job.settings.pickUpDateOffsetDays === "number"
        ? job.settings.pickUpDateOffsetDays
        : undefined;
    const pickupEndTime =
      typeof job.settings.pickupEndTime === "string" ? job.settings.pickupEndTime : undefined;
    const parcelWeight =
      typeof job.settings.parcelWeight === "number" ? job.settings.parcelWeight : undefined;
    const shipmentCount =
      typeof job.settings.shipmentCount === "number" ? job.settings.shipmentCount : 1;

    try {
      const pickupRecord = await createPickup({
        token: ctx.token,
        country: ctx.country,
        environment: ctx.environment,
        pickupType: "remote",
        shipmentCount,
        happyPathOrigin: true,
        ...(pickUpDateOffsetDays !== undefined ? { pickUpDateOffsetDays } : {}),
        ...(pickupEndTime ? { pickupEndTime } : {}),
        ...(parcelWeight !== undefined ? { parcelWeight } : {}),
        customer: linkedPickupCustomer,
      });
      linkedPickupId = pickupRecord.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Delivery created but linked pickup failed: ${message}`);
    }
  }

  return { recordId: record.id, record, linkedPickupId };
}

export function clearCustomerDetailsCache() {
  customerDetailsCache.clear();
}
