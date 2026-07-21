#!/usr/bin/env node
import fs from "node:fs";

function parsePayload(p) {
  if (typeof p === "string") return JSON.parse(p);
  if (p && typeof p === "object" && p["0"] !== undefined) {
    return JSON.parse(
      Object.keys(p)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => p[k])
        .join(""),
    );
  }
  return p;
}

const j = JSON.parse(fs.readFileSync(".tmp-e2e/create-instant-probe.json", "utf8"));
const p = parsePayload(j.payload);
console.log({ IsSuccess: p.IsSuccess, Message: p.Message });
const item = p.CreateInstantTaskRequestData?.RawShipmentItemModelList?.[0];
console.log({
  CourierZoneCode: item?.CourierZoneCode,
  BranchId: item?.BranchId,
  BranchName: item?.BranchName,
  LegacySystemShortBarcode: item?.LegacySystemShortBarcode,
  Deci: item?.Deci,
  Weight: item?.Weight,
  TaskType: item?.TaskType,
});
