const API = "http://localhost:4001/api";
const runId = process.argv[2] || "cmrxp8s8g000bo1f86a8o3fpm";
const j = await fetch(`${API}/workflows/01-load-tour-flow/runs/${runId}`).then((r) => r.json());
const out = (j.data?.maestroOutput || "").split("\n");
const interesting = out.filter((l) =>
  /FAIL|Error|Assert that "|Time Range|NESY_STEP|FAILED|COMPLETED/.test(l),
);
console.log(interesting.slice(-60).join("\n"));
