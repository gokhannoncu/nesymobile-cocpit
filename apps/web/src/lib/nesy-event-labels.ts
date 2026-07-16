import {
  EVENT_LOOKUPS,
  EVENT_NAME_BY_DESC_KEY,
  EXTERNAL_EVENT_CODE_BY_NUMBER,
} from "./nesy-event-labels.generated";

const lookupByKey = new Map(
  EVENT_LOOKUPS.map((entry) => [
    `${entry.eventType}|${entry.externalEvent}`,
    entry.descKey,
  ]),
);

function humanizeEventType(eventType: string): string {
  return eventType
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

function toShortCode(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      return EXTERNAL_EVENT_CODE_BY_NUMBER[num] ?? trimmed;
    }
    return trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return EXTERNAL_EVENT_CODE_BY_NUMBER[value] ?? String(value);
  }
  return null;
}

function toExternalEventNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  if (typeof value === "string" && value.trim()) {
    const entry = Object.entries(EXTERNAL_EVENT_CODE_BY_NUMBER).find(
      ([, code]) => code === value.trim(),
    );
    return entry ? Number(entry[0]) : null;
  }
  return null;
}

export function resolveExternalEventShortCode(value: unknown): string | null {
  return toShortCode(value);
}

export function getShipmentEventName(input: {
  eventType?: unknown;
  eventShortCode?: unknown;
}): string {
  const eventType =
    typeof input.eventType === "string" && input.eventType.trim()
      ? input.eventType.trim()
      : null;
  const externalEvent = toExternalEventNumber(input.eventShortCode);

  if (eventType && externalEvent != null) {
    const descKey = lookupByKey.get(`${eventType}|${externalEvent}`);
    if (descKey) {
      const name = EVENT_NAME_BY_DESC_KEY[descKey];
      if (name) return name;
    }
  }

  if (eventType) return humanizeEventType(eventType);
  return "Event";
}

export function formatShipmentEventLabel(input: {
  eventType?: unknown;
  eventShortCode?: unknown;
}): string {
  const shortCode = toShortCode(input.eventShortCode);
  const eventName = getShipmentEventName(input);

  if (eventName && shortCode) {
    return `${eventName} - ${shortCode}`;
  }
  if (eventName) return eventName;
  if (shortCode) return shortCode;
  return "Event";
}
