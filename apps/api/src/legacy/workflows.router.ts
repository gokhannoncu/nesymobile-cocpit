import { Router, type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { prisma, Prisma } from "@nesy/db";
import { RunStore } from "../services/run-store.js";
import { dispatchRun, removeRunFromQueues, DeviceWorkerRegistry } from "../services/device-worker.js";
import { generateWorkflowWorkspace } from "../services/yaml-generator.js";

const router: ReturnType<typeof Router> = Router();

/**
 * Coerces a request body `runInput` into a flat string map. Run-time inputs
 * (barcode, shipmentId, ...) are substituted into node config as {{key}} tokens
 * and exposed as Maestro env vars, so only string-valued scalars are kept.
 */
function sanitizeRunInput(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") out[key] = raw;
    else if (typeof raw === "number" || typeof raw === "boolean") out[key] = String(raw);
  }
  return Object.keys(out).length > 0 ? out : null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function workflowDraftFrom(workflow: {
  draftNodes?: unknown;
  draftEdges?: unknown;
  draftConfig?: unknown;
  draftBaseVersionId?: string | null;
  draftUpdatedAt?: Date | null;
}) {
  if (!Array.isArray(workflow.draftNodes) || !Array.isArray(workflow.draftEdges)) return null;

  return {
    nodes: workflow.draftNodes,
    edges: workflow.draftEdges,
    config: workflow.draftConfig ?? null,
    baseVersionId: workflow.draftBaseVersionId ?? null,
    updatedAt: workflow.draftUpdatedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workflows - List all workflows
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { status, category, search } = req.query;

    const where: Record<string, unknown> = {};
    if (status && typeof status === "string") where.status = status;
    if (category && typeof category === "string") where.category = category;
    if (search && typeof search === "string") {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const workflows = await prisma.workflow.findMany({
      where,
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, version: true, createdAt: true },
        },
        runs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, createdAt: true, duration: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const data = workflows.map((w) => ({
      id: w.id,
      slug: w.slug,
      name: w.name,
      description: w.description,
      status: w.status,
      category: w.category,
      icon: w.icon,
      iconClassName: w.iconClassName,
      currentVersionId: w.currentVersionId,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      latestVersion: w.versions[0] ?? null,
      lastRun: w.runs[0] ?? null,
    }));

    res.json({ data });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch workflows",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workflows - Create a new workflow
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { name, description, category, icon, iconClassName } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ message: "name is required" });
      return;
    }

    let slug = slugify(name);
    const existing = await prisma.workflow.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const workflow = await prisma.workflow.create({
      data: {
        slug,
        name,
        description: description ?? null,
        category: category ?? null,
        icon: icon ?? "Workflow",
        iconClassName: iconClassName ?? "",
      },
    });

    res.status(201).json({ data: workflow });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create workflow",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workflows/runs - List all runs (history page)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/runs", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const where: {
      status?: string;
      workflow?: { OR: Array<{ name: { contains: string; mode: "insensitive" } } | { slug: { contains: string; mode: "insensitive" } }> };
    } = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.workflow = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [runs, total] = await Promise.all([
      prisma.workflowRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          workflow: { select: { id: true, slug: true, name: true } },
          version: { select: { version: true } },
        },
      }),
      prisma.workflowRun.count({ where }),
    ]);

    res.json({
      data: runs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch run history",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workflows/:id - Get single workflow with current version
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workflows/device-workers - Device worker health/queue status
// (must be registered before /:id)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/device-workers", (_req, res) => {
  res.json({ data: DeviceWorkerRegistry.list() });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workflows/yaml-preview - Compile the editor graph with the SAME
// compiler the runner uses (single source of truth for YAML generation).
// (must be registered before /:id routes)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/yaml-preview", (req, res) => {
  try {
    const { nodes, edges, config, country, environment, runInput } = req.body as {
      nodes?: unknown;
      edges?: unknown;
      config?: Record<string, unknown>;
      country?: string;
      environment?: string;
      runInput?: unknown;
    };

    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      res.status(400).json({ message: "nodes and edges arrays are required" });
      return;
    }

    const workspace = generateWorkflowWorkspace({
      workflowId: "preview",
      runId: "preview",
      nodes: nodes as never,
      edges: edges as never,
      config,
      country,
      environment,
      runInput: sanitizeRunInput(runInput) ?? undefined,
    });

    res.json({
      data: {
        yaml: workspace.combinedYaml,
        files: workspace.files,
        mainFile: workspace.mainFile,
        conditionDecisions: workspace.conditionDecisions,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to generate YAML preview",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await prisma.workflow.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    const { versions, ...workflowData } = workflow;

    res.json({
      data: {
        ...workflowData,
        currentVersion: versions[0] ?? null,
        draft: workflowDraftFrom(workflow),
        draftNodes: undefined,
        draftEdges: undefined,
        draftConfig: undefined,
        draftBaseVersionId: undefined,
        draftUpdatedAt: undefined,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch workflow",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/workflows/:id - Update workflow metadata
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status, category, icon, iconClassName } = req.body;

    const existing = await prisma.workflow.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!existing) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (category !== undefined) updateData.category = category;
    if (icon !== undefined) updateData.icon = icon;
    if (iconClassName !== undefined) updateData.iconClassName = iconClassName;

    if (name && name !== existing.name) {
      let newSlug = slugify(name);
      const slugConflict = await prisma.workflow.findFirst({
        where: { slug: newSlug, id: { not: existing.id } },
      });
      if (slugConflict) newSlug = `${newSlug}-${Date.now().toString(36)}`;
      updateData.slug = newSlug;
    }

    const workflow = await prisma.workflow.update({
      where: { id: existing.id },
      data: updateData,
    });

    res.json({ data: workflow });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update workflow",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/workflows/:id/draft - Autosave draft without creating a version
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id/draft", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nodes, edges, config, baseVersionId } = req.body;

    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      res.status(400).json({ message: "nodes and edges arrays are required" });
      return;
    }

    const workflow = await prisma.workflow.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, currentVersionId: true },
    });

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    const draftUpdatedAt = new Date();
    const updated = await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        draftNodes: nodes,
        draftEdges: edges,
        draftConfig: config ?? null,
        draftBaseVersionId: baseVersionId ?? workflow.currentVersionId,
        draftUpdatedAt,
      },
    });

    res.json({ data: { draft: workflowDraftFrom(updated) } });
  } catch (error) {
    res.status(500).json({
      message: "Failed to save workflow draft",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/workflows/:id/draft - Clear autosaved draft
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id/draft", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const workflow = await prisma.workflow.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true },
    });

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        draftNodes: Prisma.DbNull,
        draftEdges: Prisma.DbNull,
        draftConfig: Prisma.DbNull,
        draftBaseVersionId: null,
        draftUpdatedAt: null,
      },
    });

    res.json({ message: "Workflow draft cleared" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to clear workflow draft",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/workflows/:id - Delete workflow (cascade)
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.workflow.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!existing) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    await prisma.workflow.delete({ where: { id: existing.id } });

    res.json({ message: "Workflow deleted", data: { id: existing.id } });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete workflow",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workflows/:id/versions - List all versions
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id/versions", async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await prisma.workflow.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    const versions = await prisma.workflowVersion.findMany({
      where: { workflowId: workflow.id },
      orderBy: { version: "desc" },
    });

    res.json({ data: versions });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch versions",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workflows/:id/versions - Save new version (nodes, edges, config)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/versions", async (req, res) => {
  try {
    const { id } = req.params;
    const { nodes, edges, config, changelog } = req.body;

    if (!nodes || !edges) {
      res.status(400).json({ message: "nodes and edges are required" });
      return;
    }

    const workflow = await prisma.workflow.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    const version = await prisma.$transaction(async (tx) => {
      const latestVersion = await tx.workflowVersion.findFirst({
        where: { workflowId: workflow.id },
        orderBy: { version: "desc" },
      });

      const nextVersion = (latestVersion?.version ?? 0) + 1;

      const createdVersion = await tx.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: nextVersion,
          nodes,
          edges,
          config: config ?? null,
          changelog: changelog ?? null,
        },
      });

      await tx.workflow.update({
        where: { id: workflow.id },
        data: {
          currentVersionId: createdVersion.id,
          draftNodes: Prisma.DbNull,
          draftEdges: Prisma.DbNull,
          draftConfig: Prisma.DbNull,
          draftBaseVersionId: null,
          draftUpdatedAt: null,
        },
      });

      return createdVersion;
    });

    res.status(201).json({ data: version });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create version",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workflows/:id/versions/:versionId - Get specific version
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id/versions/:versionId", async (req, res) => {
  try {
    const { versionId } = req.params;

    const version = await prisma.workflowVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      res.status(404).json({ message: "Version not found" });
      return;
    }

    res.json({ data: version });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch version",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workflows/:id/run - Start workflow execution
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/run", async (req, res) => {
  try {
    const { id } = req.params;
    const { selectedDeviceId, mode, targetStepId, country, environment, runInput } = req.body;

    console.log(`[POST /:id/run] Starting run for workflow: ${id}`, { selectedDeviceId, mode, targetStepId });

    const workflow = await prisma.workflow.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    });

    if (!workflow) {
      console.log(`[POST /:id/run] Workflow not found: ${id}`);
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    const currentVersion = workflow.versions[0];
    if (!currentVersion) {
      console.log(`[POST /:id/run] No saved version for workflow: ${id}`);
      res.status(400).json({ message: "Workflow has no saved version. Please save first." });
      return;
    }

    console.log(`[POST /:id/run] Found version ${currentVersion.version}, creating run...`);

    let finalCountry = country;
    let finalEnvironment = environment;
    if (!finalCountry || !finalEnvironment) {
      const launchAppNode = (currentVersion.nodes as any[])?.find((n) => n.type === "LAUNCH_APP");
      if (launchAppNode?.data?.config) {
        if (!finalCountry) finalCountry = launchAppNode.data.config.country;
        if (!finalEnvironment) finalEnvironment = launchAppNode.data.config.environment || launchAppNode.data.config.stage;
      }
    }

    const run = await prisma.workflowRun.create({
      data: {
        workflowId: workflow.id,
        versionId: currentVersion.id,
        status: "pending",
        mode: mode ?? "full",
        targetStepId: targetStepId ?? null,
        deviceId: selectedDeviceId ?? null,
        country: finalCountry ?? null,
        environment: finalEnvironment ?? null,
        runInput: sanitizeRunInput(runInput) ?? Prisma.DbNull,
      },
    });

    console.log(`[POST /:id/run] Run created: ${run.id}`);

    const nodes = currentVersion.nodes as Array<{
      id: string;
      type: string;
      data: { title: string };
    }>;

    if (Array.isArray(nodes)) {
      // Build topological order from connections so UI shows steps in execution order
      const edges = currentVersion.edges as Array<{
        sourceNodeId: string;
        targetNodeId: string | null;
        sourceHandle: string;
        isPlaceholder?: boolean;
      }>;

      const orderedNodeIds: string[] = [];
      const visitedIds = new Set<string>();

      function walkNodes(nodeId: string) {
        if (visitedIds.has(nodeId)) return;
        visitedIds.add(nodeId);
        orderedNodeIds.push(nodeId);

        const outgoing = (edges ?? [])
          .filter((e) => e.sourceNodeId === nodeId && e.targetNodeId && !e.isPlaceholder)
          .sort((a, b) => {
            // default first, then true, then false
            const order: Record<string, number> = { default: 0, true: 1, false: 2 };
            return (order[a.sourceHandle] ?? 0) - (order[b.sourceHandle] ?? 0);
          });

        for (const edge of outgoing) {
          if (edge.targetNodeId) walkNodes(edge.targetNodeId);
        }
      }

      // Start from LAUNCH_APP or first node
      const startNode = nodes.find((n) => n.type === "LAUNCH_APP") ?? nodes[0];
      if (startNode) walkNodes(startNode.id);

      // Add any remaining nodes not reachable from start (orphans)
      for (const node of nodes) {
        if (!visitedIds.has(node.id)) {
          orderedNodeIds.push(node.id);
        }
      }

      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      const stepData = orderedNodeIds
        .map((nodeId, index) => {
          const node = nodeMap.get(nodeId);
          // filter out nested nodes
          if (!node || (node as any).parentNode) return null;
          return {
            runId: run.id,
            nodeId: node.id,
            nodeType: node.type,
            nodeTitle: node.data?.title ?? node.type,
            order: index,
            status: "pending",
          };
        })
        .filter(Boolean) as Array<{
          runId: string;
          nodeId: string;
          nodeType: string;
          nodeTitle: string;
          order: number;
          status: string;
        }>;

      // Derived post-Maestro backend validation lane steps (EventTower / server-steps).
      const { deriveBackendValidations } = await import("../services/backend-validation-lane.js");
      const backendValidations = deriveBackendValidations(
        nodes.map((n) => ({
          id: n.id,
          type: n.type,
          data: n.data,
        })),
      );
      let nextOrder = stepData.length;
      for (const bv of backendValidations) {
        stepData.push({
          runId: run.id,
          nodeId: bv.stepNodeId,
          nodeType: `BACKEND_VALIDATION:${bv.sourceNodeType}`,
          nodeTitle: bv.title,
          order: nextOrder++,
          status: "pending",
        });
      }

      await prisma.workflowStepResult.createMany({ data: stepData });
      console.log(
        `[POST /:id/run] Created ${stepData.length} step results (topological + ${backendValidations.length} backend validations)`,
      );
    }

    const { queuePosition } = dispatchRun(run.id, selectedDeviceId ?? null);

    console.log(`[POST /:id/run] Run ${run.id} dispatched (queue position: ${queuePosition})`);
    res.status(202).json({
      data: { runId: run.id, status: queuePosition > 0 ? "queued" : "pending", queuePosition },
    });
  } catch (error) {
    console.error(`[POST /:id/run] ERROR:`, error);
    res.status(500).json({
      message: "Failed to start workflow run",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workflows/:id/run-step - Run a single step or up_to a step
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/run-step", async (req, res) => {
  try {
    const { id } = req.params;
    const { nodeId, mode, selectedDeviceId, runInput, country, environment } = req.body;

    if (!nodeId) {
      res.status(400).json({ message: "nodeId is required" });
      return;
    }

    const workflow = await prisma.workflow.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });

    if (!workflow || !workflow.versions[0]) {
      res.status(404).json({ message: "Workflow or version not found" });
      return;
    }

    const currentVersion = workflow.versions[0];
    const launchAppNode = (currentVersion.nodes as Array<{ type?: string; data?: { config?: Record<string, unknown> } }>)?.find(
      (n) => n.type === "LAUNCH_APP",
    );
    const finalCountry =
      country || (launchAppNode?.data?.config?.country as string | undefined) || null;
    const finalEnvironment =
      environment ||
      (launchAppNode?.data?.config?.environment as string | undefined) ||
      (launchAppNode?.data?.config?.stage as string | undefined) ||
      null;

    const run = await prisma.workflowRun.create({
      data: {
        workflowId: workflow.id,
        versionId: currentVersion.id,
        status: "pending",
        mode: mode ?? "single_step",
        targetStepId: nodeId,
        deviceId: selectedDeviceId ?? null,
        country: finalCountry,
        environment: finalEnvironment,
        runInput: sanitizeRunInput(runInput) ?? Prisma.DbNull,
      },
    });

    const { queuePosition } = dispatchRun(run.id, selectedDeviceId ?? null);

    res.status(202).json({
      data: { runId: run.id, status: queuePosition > 0 ? "queued" : "pending", queuePosition },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to start step run",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workflows/:id/runs - List runs for a workflow
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id/runs", async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const workflow = await prisma.workflow.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    const [runs, total] = await Promise.all([
      prisma.workflowRun.findMany({
        where: { workflowId: workflow.id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          stepResults: { orderBy: { order: "asc" } },
          version: { select: { version: true } },
        },
      }),
      prisma.workflowRun.count({ where: { workflowId: workflow.id } }),
    ]);

    res.json({ data: runs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch runs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workflows/:id/runs/latest - Get latest run
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id/runs/latest", async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await prisma.workflow.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    const run = await prisma.workflowRun.findFirst({
      where: { workflowId: workflow.id },
      orderBy: { createdAt: "desc" },
      include: {
        stepResults: { orderBy: { order: "asc" } },
        version: { select: { version: true } },
      },
    });

    if (!run) {
      res.status(404).json({ message: "No runs found" });
      return;
    }

    res.json({ data: run });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch latest run",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workflows/:id/runs/:runId - Get single run detail
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id/runs/:runId", async (req, res) => {
  try {
    const { runId } = req.params;

    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        stepResults: { orderBy: { order: "asc" } },
        version: { select: { version: true, nodes: true } },
        workflow: { select: { id: true, slug: true, name: true } },
      },
    });

    if (!run) {
      res.status(404).json({ message: "Run not found" });
      return;
    }

    let device = null;
    if (run.deviceId) {
      device = await prisma.mobileDevice.findFirst({
        where: { adbDeviceId: run.deviceId },
        select: { modelName: true, label: true },
      });
    }

    res.json({ data: { ...run, device } });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch run",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workflows/:id/runs/:runId/cancel - Cancel a running workflow
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/runs/:runId/cancel", async (req, res) => {
  try {
    const { runId } = req.params;

    const run = await prisma.workflowRun.findUnique({ where: { id: runId } });

    if (!run) {
      res.status(404).json({ message: "Run not found" });
      return;
    }

    if (run.status !== "running" && run.status !== "pending" && run.status !== "queued") {
      res.status(400).json({ message: "Run is not active" });
      return;
    }

    // Queued runs have no process yet — just drop them from the device queue.
    const dequeued = removeRunFromQueues(runId);
    const killed = dequeued ? false : RunStore.kill(runId);
    console.log(
      `[Cancel] run ${runId}: ${dequeued ? "removed from device queue" : killed ? "process killed" : "no process found"}`,
    );

    await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: "cancelled", completedAt: new Date() },
    });

    await prisma.workflowStepResult.updateMany({
      where: { runId, status: "running" },
      data: { status: "cancelled" },
    });

    res.json({ message: "Run cancelled", data: { runId } });
  } catch (error) {
    res.status(500).json({
      message: "Failed to cancel run",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/workflows/:id/runs/:runId - Delete a single run (keeps workflow)
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id/runs/:runId", async (req, res) => {
  try {
    const { id, runId } = req.params;

    const workflow = await prisma.workflow.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    const run = await prisma.workflowRun.findFirst({
      where: { id: runId, workflowId: workflow.id },
    });

    if (!run) {
      res.status(404).json({ message: "Run not found" });
      return;
    }

    if (run.status === "running" || run.status === "pending" || run.status === "queued") {
      removeRunFromQueues(runId);
      RunStore.kill(runId);
    }

    await prisma.workflowRun.delete({ where: { id: runId } });

    res.json({ message: "Run deleted", data: { runId } });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete run",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/runs/:runId/status - Lightweight polling endpoint (1s interval)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/runs/:runId/status", async (req, res) => {
  try {
    const { runId } = req.params;

    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        duration: true,
        stepResults: {
          orderBy: { order: "asc" },
          select: {
            nodeId: true,
            nodeType: true,
            status: true,
            duration: true,
            errorMessage: true,
            screenshotPath: true,
          },
        },
      },
    });

    if (!run) {
      res.status(404).json({ message: "Run not found" });
      return;
    }

    const currentStep = run.stepResults.find((s) => s.status === "running");

    res.json({
      runId: run.id,
      runStatus: run.status,
      currentStepId: currentStep?.nodeId ?? null,
      steps: run.stepResults.map((s) => ({
        nodeId: s.nodeId,
        nodeType: s.nodeType,
        status: s.status,
        duration: s.duration,
        errorMessage: s.errorMessage,
      })),
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch run status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workflows/:id/runs/:runId/yaml - Get YAML content for a run
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id/runs/:runId/yaml", async (req, res) => {
  try {
    const { runId } = req.params;

    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      select: { id: true, yamlContent: true },
    });

    if (!run) {
      res.status(404).json({ message: "Run not found" });
      return;
    }

    if (!run.yamlContent) {
      res.status(404).json({ message: "No YAML content available for this run" });
      return;
    }

    res.type("text/yaml").send(run.yamlContent);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch YAML content",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/runs/:runId/screenshots/:filename - Serve failure screenshot
// ─────────────────────────────────────────────────────────────────────────────
router.get("/runs/:runId/screenshots/:filename", async (req, res) => {
  try {
    const { runId, filename } = req.params;

    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      select: { screenshotDir: true },
    });

    if (!run?.screenshotDir) {
      res.status(404).json({ message: "No screenshots available for this run" });
      return;
    }

    const screenshotPath = path.resolve(process.cwd(), run.screenshotDir, filename);

    if (!fs.existsSync(screenshotPath)) {
      res.status(404).json({ message: "Screenshot not found" });
      return;
    }

    res.sendFile(screenshotPath);
  } catch (error) {
    res.status(500).json({
      message: "Failed to serve screenshot",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workflows/:id/runs/:runId/steps - Get all step results
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id/runs/:runId/steps", async (req, res) => {
  try {
    const { runId } = req.params;

    const steps = await prisma.workflowStepResult.findMany({
      where: { runId },
      orderBy: { order: "asc" },
    });

    res.json({ data: steps });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch step results",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
