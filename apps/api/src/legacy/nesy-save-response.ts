/**
 * Shipment/ClientSaveShipment cevabından waybill / shipmentId çıkarır.
 * (.NET cevabı bazen camelCase, bazen PascalCase gelir; ikisi de desteklenir.)
 */
export function extractShipmentIdFromNesySaveResponse(body: unknown): string | null {
  if (body == null || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  const asStr = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    return null;
  };

  const tryKeys = (rec: Record<string, unknown>) =>
    asStr(
      rec.shipmentId ??
        rec.ShipmentId ??
        rec.waybillNumber ??
        rec.WaybillNumber ??
        rec.itemShipmentId ??
        rec.ItemShipmentId
    );

  const direct = tryKeys(o);
  if (direct) return direct;

  const rawPayload = o.payload ?? o.Payload;
  if (rawPayload && typeof rawPayload === "object") {
    const p = rawPayload as Record<string, unknown>;
    const fromPayload = tryKeys(p);
    if (fromPayload) return fromPayload;
    const nestedShip = p.shipment ?? p.Shipment;
    if (nestedShip && typeof nestedShip === "object") {
      const fromNested = tryKeys(nestedShip as Record<string, unknown>);
      if (fromNested) return fromNested;
    }
    const items = p.items ?? p.Items;
    if (Array.isArray(items) && items[0] && typeof items[0] === "object") {
      const fromItem = tryKeys(items[0] as Record<string, unknown>);
      if (fromItem) return fromItem;
    }
  }

  const resObj = o.result ?? o.Result;
  if (resObj && typeof resObj === "object") {
    const fromRes = tryKeys(resObj as Record<string, unknown>);
    if (fromRes) return fromRes;
  }

  return null;
}

export function isNesyResultOk(result: Record<string, unknown>): boolean {
  const rc = result.resultCode ?? result.ResultCode;
  if (rc == null) return true;
  return Number(rc) === 200;
}
