// @ts-nocheck
import {
  formatShipmentEventLabel,
  getShipmentEventName,
  resolveExternalEventShortCode,
} from "./nesy-event-labels";

export const EMPTY = "—";

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : undefined;
}

function asArray(value: unknown): Raw[] {
  return Array.isArray(value)
    ? value.filter((item): item is Raw => !!asRecord(item))
    : [];
}

function str(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return EMPTY;
}

const PAYER_TYPE_LABELS: Record<number, string> = {
  1: "Customer",
  2: "Shipper",
  3: "Consignee",
};

function resolvePayerType(value: unknown): string {
  if (typeof value === "number" && PAYER_TYPE_LABELS[value]) {
    return PAYER_TYPE_LABELS[value];
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const label = PAYER_TYPE_LABELS[Number(trimmed)];
      if (label) return label;
    }
    const normalized =
      trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    if (["Customer", "Shipper", "Consignee"].includes(normalized)) {
      return normalized;
    }
  }
  return str(value);
}

function firstStr(...values: unknown[]): string {
  for (const value of values) {
    const s = str(value);
    if (s !== EMPTY) return s;
  }
  return EMPTY;
}

function formatMoney(value: unknown, currency = "EUR"): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value.toFixed(2)} ${currency}`;
  }
  if (typeof value === "string" && value.trim()) {
    return value.includes(currency) ? value : `${value} ${currency}`;
  }
  return EMPTY;
}

function formatDate(value: unknown): string {
  const s = str(value);
  if (s === EMPTY) return EMPTY;
  return s.replace("T", " ").replace(".000Z", "").replace("Z", "");
}

function formatWeight(value: unknown): string {
  const s = str(value);
  return s === EMPTY ? EMPTY : `${s} kg`;
}

function addressText(addr: Raw | undefined): string {
  if (!addr) return EMPTY;
  const direct = str(addr.addressText ?? addr.AddressText);
  if (direct !== EMPTY) return direct;
  const parts = [
    addr.street ?? addr.Street,
    addr.zipCode ?? addr.ZipCode,
    addr.city ?? addr.City,
    addr.countryCode ?? addr.countryPrefix ?? addr.CountryCode,
  ]
    .map(str)
    .filter((p) => p !== EMPTY);
  return parts.length > 0 ? parts.join(", ") : EMPTY;
}

function parcelWeight(parcel: Raw): string {
  const measurements = asArray(parcel.measurements ?? parcel.Measurements);
  const fromMeasurement = measurements.find(
    (m) => m.weight != null || m.Weight != null,
  );
  return formatWeight(
    parcel.weight ??
      parcel.Weight ??
      fromMeasurement?.weight ??
      fromMeasurement?.Weight,
  );
}

export interface ShipmentDetailParcel {
  index: number;
  barcode: string;
  legacyCargoId: string;
  status: string;
  weight: string;
}

export interface ShipmentDetailService {
  name: string;
  price: string;
  legacySystemServiceId: string;
  isPassive: boolean;
}

export interface ShipmentDetailPricingLine {
  label: string;
  amount: string;
}

export interface ShipmentDetailEvent {
  label: string;
  date: string;
  description: string;
}

export interface ShipmentHistoryEvent {
  parcelInfo: string;
  eventCode: string;
  weight: string;
  eventName: string;
  eventDescription: string;
  eventDetail: string;
  timestamp: string;
  hubName: string;
  user: string;
  channel: string;
}

export interface ShipmentDetailView {
  shipmentId: string;
  internalRef: string;
  shipmentType: string;
  parcelCount: string;
  totalCost: string;
  freightCost: string;
  codAmount: string;
  deliveryCode: string;
  lastStatus: string;
  channel: string;
  international: string;
  legacyCargoId: string;
  pricingUnit: string;
  actualTotalWeight: string;
  declaredTotalWeight: string;
  lastMeasuredTotalWeight: string;
  customer: {
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    billingOption: string;
    payer: string;
  };
  shipper: {
    name: string;
    originCenter: string;
    address: string;
    plannedPickupDate: string;
    actualPickupDate: string;
    phone: string;
    counterLocationType: string;
  };
  consignee: {
    name: string;
    destinationCenter: string;
    address: string;
    declaredDeliveryDate: string;
    plannedDeliveryDate: string;
    actualDeliveryDate: string;
    phone: string;
    counterLocationType: string;
  };
  parcels: ShipmentDetailParcel[];
  services: ShipmentDetailService[];
  pricingLines: ShipmentDetailPricingLine[];
  events: ShipmentDetailEvent[];
}

export function extractNesyShipmentId(data: Raw): string {
  return firstStr(
    data.shipmentId,
    data.ShipmentId,
    data.nesyShipmentId,
    data.waybillNumber,
    data.WaybillNumber,
  );
}

function detectShipmentType(services: Raw[]): string {
  const hasCod = services.some(
    (s) =>
      s.serviceType === 20 ||
      s.ServiceType === 20 ||
      s.legacySystemServiceId === "8" ||
      s.LegacySystemServiceId === "8" ||
      s.serviceName === "Cash on Delivery",
  );
  const hasRdoc = services.some(
    (s) =>
      s.serviceType === 27 ||
      s.ServiceType === 27 ||
      s.legacySystemServiceId === "64" ||
      s.LegacySystemServiceId === "64" ||
      s.serviceName === "Document Collection",
  );
  if (hasCod) return "COD";
  if (hasRdoc) return "RDOC";
  return "Standard";
}

function codAmountFromServices(services: Raw[]): string {
  const cod = services.find(
    (s) =>
      s.legacySystemServiceId === "8" ||
      s.LegacySystemServiceId === "8" ||
      s.serviceType === 20 ||
      s.ServiceType === 20,
  );
  return formatMoney(
    cod?.servicePrice ??
      cod?.ServicePrice ??
      cod?.amount ??
      cod?.Amount ??
      cod?.price ??
      cod?.Price,
  );
}

function extractEventList(raw: Raw | null | undefined): Raw[] {
  if (!raw) return [];
  const payload = asRecord(raw.payload ?? raw.Payload) ?? raw;
  return asArray(
    payload.eventDetailList ??
      payload.EventDetailList ??
      raw.eventDetailList ??
      raw.EventDetailList ??
      payload.eventList ??
      payload.EventList,
  );
}

function eventTimestamp(event: Raw): number {
  const scanDateTime = event.scanDateTime ?? event.ScanDateTime;
  if (typeof scanDateTime === "string" && scanDateTime.trim()) {
    const parsed = Date.parse(scanDateTime.split("\n")[0].trim());
    if (!Number.isNaN(parsed)) return parsed;
  }
  const ts =
    event.timeStamp ??
    event.TimeStamp ??
    event.eventDate ??
    event.EventDate ??
    event.createdDate ??
    event.CreatedDate;
  const parsed = Date.parse(String(ts ?? ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortEventsChronologically(events: Raw[]): Raw[] {
  const copy = events.slice();
  const hasAnyTimestamp = copy.some((event) => eventTimestamp(event) > 0);

  if (hasAnyTimestamp) {
    return copy
      .map((event, index) => ({ event, index, ts: eventTimestamp(event) }))
      .sort((a, b) => {
        if (a.ts > 0 && b.ts > 0) return a.ts - b.ts;
        if (a.ts > 0) return -1;
        if (b.ts > 0) return 1;
        return a.index - b.index;
      })
      .map(({ event }) => event);
  }

  return copy.reverse();
}

function formatEventTimestamp(event: Raw): string {
  const scanDateTime = event.scanDateTime ?? event.ScanDateTime;
  if (typeof scanDateTime === "string" && scanDateTime.trim()) {
    return formatDate(scanDateTime.split("\n")[0].trim());
  }
  return formatDate(
    event.timeStamp ??
      event.TimeStamp ??
      event.eventDate ??
      event.EventDate ??
      event.createdDate ??
      event.CreatedDate,
  );
}

function barcodeMatchKey(barcode: string): string {
  const trimmed = barcode.trim();
  if (trimmed.length === 66) return trimmed.slice(45, 65).trim().toLowerCase();
  return trimmed.toLowerCase();
}

function parcelInfoFromEventRaw(event: Raw): string {
  const list = asArray(event.barcodeList ?? event.BarcodeList);
  if (list.length > 0) {
    return list
      .map((item) => {
        const value = String(item).trim();
        return value.length === 66 ? value.slice(35) : value;
      })
      .join("-");
  }
  const parcelInfo = event.parcelInfo ?? event.ParcelInfo;
  if (Array.isArray(parcelInfo) && parcelInfo.length > 0) {
    return parcelInfo.map((item) => String(item)).join("-");
  }
  if (typeof parcelInfo === "string" && parcelInfo.trim()) return parcelInfo.trim();
  return EMPTY;
}

function formatEventParcelDisplay(
  event: Raw,
  parcels: ShipmentDetailParcel[],
): string {
  const parcelInfo = event.parcelInfo ?? event.ParcelInfo;
  if (typeof parcelInfo === "string" && /^\d+(-\d+)*$/.test(parcelInfo.trim())) {
    return parcelInfo.trim();
  }

  const barcodeList = asArray(event.barcodeList ?? event.BarcodeList).map(String);
  if (barcodeList.length === 0) {
    const rawInfo = parcelInfoFromEventRaw(event);
    if (rawInfo !== EMPTY && parcels.length > 0) return String(parcels.length);
    return rawInfo;
  }

  const legacyShortBarcodes = parcels
    .map((parcel) => parcel.legacyCargoId)
    .filter((id) => id !== EMPTY);
  const parcelShortBarcodes = asArray(
    event.parcelShortBarcodes ?? event.ParcelShortBarcodes,
  ).map(String);
  const titles = parcels.flatMap((parcel) =>
    [parcel.barcode, parcel.legacyCargoId].filter((value) => value !== EMPTY),
  );

  const formattedIndexes = barcodeList
    .map((barcode) => {
      const formattedBarcode = barcodeMatchKey(barcode);
      const indexInTitles =
        titles.findIndex((title) =>
          title.trim().toLowerCase().includes(formattedBarcode),
        ) + 1;

      if (indexInTitles === 0 && parcelShortBarcodes.length > 0) {
        const shortIdx = legacyShortBarcodes.findIndex(
          (shortBarcode) => shortBarcode === parcelShortBarcodes[0],
        );
        if (shortIdx >= 0) return shortIdx + 1;
      }

      return indexInTitles;
    })
    .filter((index) => index > 0);

  if (formattedIndexes.length === 0) {
    return parcels.length > 0 ? String(parcels.length) : parcelInfoFromEventRaw(event);
  }

  return [...new Set(formattedIndexes)].join("-");
}

function parcelInfoFromEvent(
  event: Raw,
  parcels: ShipmentDetailParcel[] = [],
): string {
  const display = formatEventParcelDisplay(event, parcels);
  if (display !== EMPTY) return display;
  return parcelInfoFromEventRaw(event);
}

function historyEventDescription(event: Raw): string {
  const nested = asRecord(event.eventDescription ?? event.EventDescription);
  return firstStr(
    event.invoiceNumber,
    event.InvoiceNumber,
    nested?.carrierCompanyEventDescription,
    nested?.CarrierCompanyEventDescription,
    typeof event.eventDescription === "string" ? event.eventDescription : null,
    typeof event.EventDescription === "string" ? event.EventDescription : null,
  );
}

function historyEventDetail(event: Raw): string {
  return firstStr(
    event.deliveryRemark,
    event.DeliveryRemark,
    event.eventText,
    event.EventText,
    event.remark,
    event.Remark,
  );
}

function historyEventWeight(event: Raw): string {
  const legacyCode = resolveExternalEventShortCode(
    event.legacySystemShortEventCode ??
      event.LegacySystemShortEventCode ??
      event.eventShortCode ??
      event.EventShortCode,
  );
  if (legacyCode !== "INIT" && legacyCode !== "WGTU" && legacyCode !== "ENTY") {
    return EMPTY;
  }
  const weight = event.weight ?? event.Weight;
  if (weight == null || String(weight).trim() === "") return EMPTY;
  return `${weight} kg`;
}

function historyEventCode(event: Raw): string {
  const legacy = resolveExternalEventShortCode(
    event.legacySystemShortEventCode ?? event.LegacySystemShortEventCode,
  );
  if (legacy) return legacy;
  return (
    resolveExternalEventShortCode(event.eventShortCode ?? event.EventShortCode) ??
    EMPTY
  );
}

export function mapShipmentEventHistory(
  raw: Raw | null | undefined,
  parcels: ShipmentDetailParcel[] = [],
): ShipmentHistoryEvent[] {
  return sortEventsChronologically(extractEventList(raw)).map((event) => ({
      parcelInfo: parcelInfoFromEvent(event, parcels),
      eventCode: historyEventCode(event),
      weight: historyEventWeight(event),
      eventName: getShipmentEventName({
        eventType: event.eventType ?? event.EventType,
        eventShortCode: event.eventShortCode ?? event.EventShortCode,
      }),
      eventDescription: historyEventDescription(event),
      eventDetail: historyEventDetail(event),
      timestamp: formatEventTimestamp(event),
      hubName: firstStr(event.hubName, event.HubName, event.hubShortName, event.HubShortName),
      user: firstStr(
        event.legacySystemUser,
        event.LegacySystemUser,
        event.courierName,
        event.CourierName,
        event.userName,
        event.UserName,
      ),
      channel: firstStr(event.channel, event.Channel),
    }));
}

function mapEvents(raw: Raw | null | undefined): ShipmentDetailEvent[] {
  if (!raw) return [];
  const list = sortEventsChronologically(extractEventList(raw)).reverse();
  return list.map((event) => ({
    label: formatShipmentEventLabel({
      eventType: event.eventType ?? event.EventType,
      eventShortCode: event.eventShortCode ?? event.EventShortCode,
    }),
    date: formatEventTimestamp(event),
    description: firstStr(
      event.eventDescription,
      event.EventDescription,
      event.description,
      event.Description,
      event.remark,
      event.Remark,
    ),
  }));
}

function mapPricingLines(pricing: Raw | null | undefined): ShipmentDetailPricingLine[] {
  if (!pricing) return [];
  const lines: ShipmentDetailPricingLine[] = [];
  const payload = asRecord(pricing.payload ?? pricing.Payload) ?? pricing;

  for (const fee of asArray(payload.shippingFees ?? payload.ShippingFees)) {
    lines.push({
      label: firstStr(fee.name, fee.Name, fee.description, fee.Description, "Shipping fee"),
      amount: formatMoney(fee.amount ?? fee.Amount ?? fee.price ?? fee.Price),
    });
  }
  for (const surcharge of asArray(
    payload.servicesSurcharges ?? payload.ServicesSurcharges,
  )) {
    lines.push({
      label: firstStr(
        surcharge.serviceName,
        surcharge.ServiceName,
        surcharge.name,
        surcharge.Name,
        "Surcharge",
      ),
      amount: formatMoney(
        surcharge.surcharge ??
          surcharge.Surcharge ??
          surcharge.amount ??
          surcharge.Amount,
      ),
    });
  }

  const taxRate = payload.taxRate ?? payload.TaxRate;
  const taxAmount = payload.taxAmount ?? payload.TaxAmount;
  if (taxRate != null || taxAmount != null) {
    lines.push({
      label: `Tax (${str(taxRate)}%)`,
      amount: formatMoney(taxAmount),
    });
  }

  return lines;
}

export function mapShipmentDetailView(input: {
  search: Raw;
  pricing?: Raw | null;
  events?: Raw | null;
  customerDetails?: unknown;
  unloadStatus?: string;
  createdAt?: string;
}): ShipmentDetailView {
  const search = input.search;
  const customer = asRecord(search.customer ?? search.Customer);
  const shipper = asRecord(search.shipper ?? search.Shipper);
  const consignee = asRecord(search.consignee ?? search.Consignee);
  const consigneeAddress =
    asRecord(consignee?.currentAddress ?? consignee?.CurrentAddress) ??
    asRecord(consignee?.address ?? consignee?.Address);
  const shipperAddress = asRecord(shipper?.address ?? shipper?.Address);
  const customerAddress = asRecord(customer?.address ?? customer?.Address);
  const pickupLocation = asRecord(search.pickupLocation ?? search.PickupLocation);
  const deliveryLocation = asRecord(search.deliveryLocation ?? search.DeliveryLocation);
  const pricingModel = asRecord(search.pricingModel ?? search.PricingModel);
  const pricingPayload =
    asRecord(input.pricing?.payload ?? input.pricing?.Payload) ?? input.pricing ?? null;

  const services = asArray(
    search.filteredServices ??
      search.FilteredServices ??
      search.services ??
      search.Services,
  );
  const parcelsRaw = asArray(search.parcels ?? search.Parcels);

  const customerDetailsRaw = asRecord(
    asRecord(asRecord(input.customerDetails)?.payload)?.customer ??
      asRecord(input.customerDetails)?.customer ??
      input.customerDetails,
  );

  const freightCost = formatMoney(
    pricingPayload?.totalFreightCost ??
      pricingPayload?.TotalFreightCost ??
      search.totalFreightCost ??
      search.TotalFreightCost,
  );
  const totalCost = formatMoney(
    pricingPayload?.totalFreightCostWithTax ??
      pricingPayload?.TotalFreightCostWithTax ??
      pricingPayload?.totalFreightCost ??
      pricingPayload?.TotalFreightCost ??
      search.totalFreightCostWithTax ??
      search.TotalFreightCostWithTax,
  );

  const events = mapEvents(input.events);
  if (events.length === 0 && input.createdAt) {
    events.push({
      label: "Save Shipment",
      date: formatDate(input.createdAt),
      description: "Shipment saved",
    });
  }

  const latestEventLabel =
    events.length > 0 ? events[0].label : EMPTY;
  const lastEventRecord = asRecord(search.lastEvent ?? search.LastEvent);
  const shipmentStatusLabel = firstStr(
    search.shipmentStatus,
    search.ShipmentStatus,
    search.lastStatus,
    search.LastStatus,
  );
  const lastStatus = firstStr(
    latestEventLabel !== EMPTY ? latestEventLabel : null,
    input.unloadStatus,
    formatShipmentEventLabel({
      eventType: lastEventRecord?.eventType ?? lastEventRecord?.EventType,
      eventShortCode:
        lastEventRecord?.eventShortCode ?? lastEventRecord?.EventShortCode,
    }),
    resolveExternalEventShortCode(
      lastEventRecord?.eventShortCode ?? lastEventRecord?.EventShortCode,
    ),
    shipmentStatusLabel,
  );
  const parcelStatusFallback = firstStr(
    input.unloadStatus,
    resolveExternalEventShortCode(
      lastEventRecord?.eventShortCode ?? lastEventRecord?.EventShortCode,
    ),
    shipmentStatusLabel,
  );

  const legacyCargoId = firstStr(
    search.legacySystemCargoId,
    search.LegacySystemCargoId,
    parcelsRaw[0]?.legacySystemShortBarcode,
    parcelsRaw[0]?.LegacySystemShortBarcode,
    parcelsRaw[0]?.legacySystemCargoId,
    parcelsRaw[0]?.LegacySystemCargoId,
  );

  const parcels: ShipmentDetailParcel[] = parcelsRaw.map((parcel, index) => ({
    index: index + 1,
    barcode: firstStr(
      parcel.barcode,
      parcel.Barcode,
      parcel.customerBarcode,
      parcel.CustomerBarcode,
    ),
    legacyCargoId: firstStr(
      parcel.legacySystemCargoId,
      parcel.LegacySystemCargoId,
      parcel.legacySystemShortBarcode,
      parcel.LegacySystemShortBarcode,
      legacyCargoId,
    ),
    status: firstStr(parcel.status, parcel.Status, parcelStatusFallback),
    weight: parcelWeight(parcel),
  }));

  const mappedServices: ShipmentDetailService[] = services.map((service) => ({
    name: firstStr(service.serviceName, service.ServiceName, service.name, service.Name),
    price: formatMoney(
      service.servicePrice ??
        service.ServicePrice ??
        service.amount ??
        service.Amount,
      typeof service.currency === "string"
        ? service.currency
        : typeof service.Currency === "string"
          ? service.Currency
          : "EUR",
    ),
    legacySystemServiceId: firstStr(
      service.legacySystemServiceId,
      service.LegacySystemServiceId,
    ),
    isPassive:
      service.serviceStatus === "Passive" ||
      service.ServiceStatus === "Passive" ||
      service.serviceStatus === 1 ||
      service.ServiceStatus === 1,
  }));

  return {
    shipmentId: extractNesyShipmentId(search),
    internalRef: firstStr(
      search.integrationCode,
      search.IntegrationCode,
      search.customerShipmentNumber,
      search.CustomerShipmentNumber,
      search.internalRef,
      search.InternalRef,
    ),
    shipmentType: detectShipmentType(services),
    parcelCount: str(parcelsRaw.length > 0 ? parcelsRaw.length : search.parcelCount),
    totalCost,
    freightCost,
    codAmount: codAmountFromServices(services),
    deliveryCode: firstStr(search.deliveryCode, search.DeliveryCode),
    lastStatus,
    channel: firstStr(search.channel, search.Channel),
    international:
      search.isWorldWide === false || search.isWorldWide === "false"
        ? "Domestic"
        : firstStr(search.international, search.International, "International"),
    legacyCargoId,
    pricingUnit: firstStr(
      pricingModel?.pricingUnit,
      pricingModel?.PricingUnit,
      parcelsRaw[0]?.pricingUnit,
      parcelsRaw[0]?.PricingUnit,
    ),
    actualTotalWeight: formatWeight(
      search.actualTotalWeight ?? search.ActualTotalWeight,
    ),
    declaredTotalWeight: formatWeight(
      search.declaredTotalWeight ?? search.DeclaredTotalWeight,
    ),
    lastMeasuredTotalWeight: formatWeight(
      search.lastMeasuredTotalWeight ?? search.LastMeasuredTotalWeight,
    ),
    customer: {
      id: firstStr(
        customer?.customerId,
        customer?.CustomerId,
        customerDetailsRaw?.customerId,
        customerDetailsRaw?.CustomerId,
      ),
      name: firstStr(
        customer?.name,
        customer?.Name,
        customerDetailsRaw?.name,
        customerDetailsRaw?.Name,
      ),
      address: addressText(customerAddress),
      phone: firstStr(
        customer?.phone,
        customer?.Phone,
        customer?.gsm,
        customer?.Gsm,
        customerDetailsRaw?.phone,
        customerDetailsRaw?.Phone,
      ),
      email: firstStr(
        customer?.email,
        customer?.Email,
        customerDetailsRaw?.email,
        customerDetailsRaw?.Email,
      ),
      billingOption: firstStr(
        search.billingOption,
        search.BillingOption,
        customerDetailsRaw?.standartInvoicePeriod,
        customerDetailsRaw?.StandartInvoicePeriod,
      ),
      payer: resolvePayerType(
        search.payerType ?? search.PayerType ?? search.payer ?? search.Payer,
      ),
    },
    shipper: {
      name: firstStr(shipper?.name, shipper?.Name),
      originCenter: firstStr(
        pickupLocation?.hubName,
        pickupLocation?.HubName,
        pickupLocation?.hubShortName,
        shipper?.customerCenter,
        shipper?.CustomerCenter,
      ),
      address: addressText(shipperAddress),
      plannedPickupDate: formatDate(
        search.planedPickupDate ??
          search.PlanedPickupDate ??
          search.plannedPickupDate,
      ),
      actualPickupDate: formatDate(
        search.actualPickupDate ?? search.ActualPickupDate,
      ),
      phone: firstStr(
        shipper?.phone,
        shipper?.Phone,
        shipper?.gsm,
        shipper?.Gsm,
      ),
      counterLocationType: firstStr(
        shipper?.addressType,
        shipper?.AddressType,
        search.counterLocationShipperType,
      ),
    },
    consignee: {
      name: firstStr(consignee?.name, consignee?.Name),
      destinationCenter: firstStr(
        deliveryLocation?.hubName,
        deliveryLocation?.HubName,
        deliveryLocation?.hubShortName,
        consignee?.customerCenter,
        consignee?.CustomerCenter,
      ),
      address: addressText(consigneeAddress),
      declaredDeliveryDate: formatDate(
        search.declaredDeliveryDate ?? search.DeclaredDeliveryDate,
      ),
      plannedDeliveryDate: formatDate(
        search.planedDeliveryDate ??
          search.PlanedDeliveryDate ??
          search.plannedDeliveryDate,
      ),
      actualDeliveryDate: formatDate(
        search.actualDeliveryDate ?? search.ActualDeliveryDate,
      ),
      phone: firstStr(
        consignee?.phone,
        consignee?.Phone,
        consignee?.gsm,
        consignee?.Gsm,
      ),
      counterLocationType: firstStr(
        consignee?.addressType,
        consignee?.AddressType,
        search.counterLocationConsigneeType,
      ),
    },
    parcels,
    services: mappedServices,
    pricingLines: mapPricingLines(input.pricing ?? null),
    events,
  };
}
