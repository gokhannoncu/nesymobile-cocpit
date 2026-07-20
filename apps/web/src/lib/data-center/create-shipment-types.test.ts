import { describe, expect, it } from "vitest";
import {
  CREATE_SHIPMENT_TYPES,
  getCreateShipmentExtras,
  getCreateShipmentUnloadDefaults,
  mapCreateShipmentTypeToBff,
} from "./create-shipment-types";

describe("create-shipment-types", () => {
  it("lists all creatable shipment types in UI order", () => {
    expect(CREATE_SHIPMENT_TYPES.map((t) => t.id)).toEqual([
      "standard",
      "cod",
      "exw",
      "deps",
      "d4me",
      "multicolli",
      "rdoc",
      "delivery-pick",
      "doco",
      "cpp",
      "ovsz",
      "ddef",
    ]);
  });

  it("maps UI ids to BFF shipmentType values", () => {
    expect(mapCreateShipmentTypeToBff("standard")).toBe("standard");
    expect(mapCreateShipmentTypeToBff("cod")).toBe("cod");
    expect(mapCreateShipmentTypeToBff("exw")).toBe("exw");
    expect(mapCreateShipmentTypeToBff("deps")).toBe("deps");
    expect(mapCreateShipmentTypeToBff("d4me")).toBe("d4me");
    expect(mapCreateShipmentTypeToBff("multicolli")).toBe("multicolli");
    expect(mapCreateShipmentTypeToBff("rdoc")).toBe("return-document");
    expect(mapCreateShipmentTypeToBff("delivery-pick")).toBe("delivery-pick");
    expect(mapCreateShipmentTypeToBff("doco")).toBe("doco");
    expect(mapCreateShipmentTypeToBff("cpp")).toBe("standard");
    expect(mapCreateShipmentTypeToBff("ovsz")).toBe("standard");
    expect(mapCreateShipmentTypeToBff("ddef")).toBe("standard");
  });

  it("declares extras per type", () => {
    expect(getCreateShipmentExtras("standard")).toEqual([]);
    expect(getCreateShipmentExtras("cod")).toEqual(["cod"]);
    expect(getCreateShipmentExtras("exw")).toEqual(["exw"]);
    expect(getCreateShipmentExtras("deps")).toEqual(["deps"]);
    expect(getCreateShipmentExtras("d4me")).toEqual(["d4me"]);
    expect(getCreateShipmentExtras("multicolli")).toEqual(["multicolli"]);
    expect(getCreateShipmentExtras("rdoc")).toEqual([]);
    expect(getCreateShipmentExtras("delivery-pick")).toEqual([]);
    expect(getCreateShipmentExtras("doco")).toEqual([]);
    expect(getCreateShipmentExtras("cpp")).toEqual([]);
    expect(getCreateShipmentExtras("ovsz")).toEqual([]);
    expect(getCreateShipmentExtras("ddef")).toEqual([]);
  });

  it("declares unload defaults for OVSZ and DDEF", () => {
    expect(getCreateShipmentUnloadDefaults("ovsz")).toEqual({
      forceUnload: true,
      isOversize: true,
    });
    expect(getCreateShipmentUnloadDefaults("ddef")).toEqual({ forceNoUnload: true });
    expect(getCreateShipmentUnloadDefaults("standard")).toEqual({});
  });
});
