import { prisma } from "@nesy/db";
import { generateWorkflowWorkspace } from "./src/services/yaml-generator.js";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2]!;
const mode = process.argv[3]!; // "route-bound" | "runtime"
const wf = await prisma.workflow.findFirst({
  where: { slug: "00-start-flow" },
  include: { versions: { orderBy: { version: "desc" }, take: 1 } },
});
const v = wf!.versions[0]!;
const preflight =
  mode === "route-bound"
    ? { isLoggedIn: null, routeSelected: true, evidence: "test route-only" }
    : null;
const ws = generateWorkflowWorkspace(
  {
    workflowId: wf!.id, runId: "bench",
    nodes: v.nodes as never, edges: v.edges as never,
    environment: "prod", country: "TR",
    config: (v.config as never) ?? undefined,
  },
  preflight as never,
);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "flows"), { recursive: true });
for (const f of ws.files) {
  const p = path.join(OUT, f.relativePath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, f.content);
}
console.log(`[${mode}] mainFile=${ws.mainFile} skipped=${JSON.stringify(ws.skippedNodeIds)} decisions=${JSON.stringify(ws.conditionDecisions.map((d) => `${d.nodeType}:${d.decision}`))}`);
await prisma.$disconnect();
