// @ts-nocheck
import { formatShipmentEventLabel } from "./nesy-event-labels.js";

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

export function extractNesyShipmentId(data: Raw): string | null {
  for (const value of [
    data.shipmentId,
    data.ShipmentId,
    data.nesyShipmentId,
    data.waybillNumber,
    data.WaybillNumber,
  ]) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

export function resolveLatestEventLabel(eventsRaw: Raw | null | undefined): string | null {
  const events = sortEventsChronologically(extractEventList(eventsRaw));
  if (events.length === 0) return null;

  const lastEvent = events[events.length - 1];
  const label = formatShipmentEventLabel({
    eventType: lastEvent.eventType ?? lastEvent.EventType,
    eventShortCode: lastEvent.eventShortCode ?? lastEvent.EventShortCode,
  });

  return label === "Event" ? null : label;
}
