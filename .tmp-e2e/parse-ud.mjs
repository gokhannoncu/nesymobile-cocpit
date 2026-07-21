import fs from "node:fs";
const file = process.argv[2] || ".tmp-e2e/ud-phase3.xml";
const x = fs.readFileSync(file, "utf8");
const ids = [...x.matchAll(/resource-id="([^"]+)"/g)].map((m) => m[1]);
const texts = [...x.matchAll(/text="([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
console.log("ids", [...new Set(ids)]);
console.log("texts", [...new Set(texts)].slice(0, 40));
