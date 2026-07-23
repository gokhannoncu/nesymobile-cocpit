import { describe, expect, it } from "vitest";
import {
  parseAdbBroadcastData,
  parseCourierPrefsXml,
  parseScheduleIdParts,
} from "./device-courier-auth.js";

describe("parseCourierPrefsXml", () => {
  it("reads token, isLogin, route, branchId, and hub name from preferences XML", () => {
    const xml = `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <boolean name="isLogin" value="true" />
    <string name="token">eyJhbGciOiJSUzI1NiJ9.aaa.bbb</string>
    <string name="route">36</string>
    <string name="hubId">CEBeograd</string>
    <int name="branchId" value="11" />
</map>`;
    expect(parseCourierPrefsXml(xml)).toEqual({
      token: "eyJhbGciOiJSUzI1NiJ9.aaa.bbb",
      isLogin: true,
      route: "36",
      branchId: "11",
      hubName: "CEBeograd",
    });
  });

  it("strips whitespace from wrapped JWT strings", () => {
    const xml = `<map><string name="token">eyJhbGc.\naaa.\nbbb</string></map>`;
    expect(parseCourierPrefsXml(xml).token).toBe("eyJhbGc.aaa.bbb");
  });
});

describe("parseScheduleIdParts", () => {
  it("parses hub-zone-date schedule ids", () => {
    expect(parseScheduleIdParts("11-36-20260723-1")).toEqual({
      branchId: "11",
      zone: "36",
    });
  });

  it("returns null for unknown shapes", () => {
    expect(parseScheduleIdParts("abc")).toBeNull();
  });
});

describe("parseAdbBroadcastData", () => {
  it("parses data= from broadcast output", () => {
    const out =
      'Broadcast completed: result=-1, data="abc+def/ghi=", end=0';
    expect(parseAdbBroadcastData(out)).toBe("abc+def/ghi=");
  });
});
