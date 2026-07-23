import { describe, expect, it } from "vitest";
import { extractZimmetBarcodes } from "./load-tour-barcodes";

describe("extractZimmetBarcodes", () => {
  it("prefers legacySystemShortBarcode over full barcode", () => {
    expect(
      extractZimmetBarcodes({
        parcels: [
          {
            barcode: "NRSFULL0001",
            legacySystemShortBarcode: "6880051000263216",
          },
        ],
      }),
    ).toEqual(["6880051000263216"]);
  });

  it("returns all multicolli shorts", () => {
    expect(
      extractZimmetBarcodes({
        parcels: [
          { barcode: "A", legacySystemShortBarcode: "6880051000000001" },
          { barcode: "B", legacySystemShortBarcode: "6880051000000002" },
        ],
      }),
    ).toEqual(["6880051000000001", "6880051000000002"]);
  });

  it("falls back to full barcode when short missing", () => {
    expect(extractZimmetBarcodes({ parcels: [{ barcode: "NRSONLY" }] })).toEqual([
      "NRSONLY",
    ]);
  });
});
