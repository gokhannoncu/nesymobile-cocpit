import { describe, expect, it } from "vitest";
import { parseAdbBroadcastData, parseCourierPrefsXml } from "./device-courier-auth.js";

describe("parseCourierPrefsXml", () => {
  it("reads token, isLogin, and route from preferences XML", () => {
    const xml = `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <boolean name="isLogin" value="true" />
    <string name="token">eyJhbGciOiJSUzI1NiJ9.aaa.bbb</string>
    <string name="route">36</string>
</map>`;
    expect(parseCourierPrefsXml(xml)).toEqual({
      token: "eyJhbGciOiJSUzI1NiJ9.aaa.bbb",
      isLogin: true,
      route: "36",
    });
  });

  it("strips whitespace from wrapped JWT strings", () => {
    const xml = `<map><string name="token">eyJhbGc.\naaa.\nbbb</string></map>`;
    expect(parseCourierPrefsXml(xml).token).toBe("eyJhbGc.aaa.bbb");
  });
});

describe("parseAdbBroadcastData", () => {
  it("parses data= from broadcast output", () => {
    const out =
      'Broadcast completed: result=-1, data="abc+def/ghi=", end=0';
    expect(parseAdbBroadcastData(out)).toBe("abc+def/ghi=");
  });
});
