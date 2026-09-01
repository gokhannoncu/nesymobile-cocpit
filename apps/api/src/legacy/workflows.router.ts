import { Router, type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { prisma, Prisma } from "@nesy/db";
import { RunStore } from "../services/run-store.js";
import { DeviceWorkerRegistry } from "../services/device-worker.js";

const router: ReturnType<typeof Router> = Router();

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
// POST /api/workflows/yaml-preview - removed in Phase 8.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/yaml-preview", (_req, res) => {
  res.status(410).json({
    message: "YAML preview has been removed. Use /api/verdict/runtime/compile.",
    replacement: "/api/verdict/runtime/compile",
  });
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
  res.status(410).json({
    message: "Legacy workflow execution has been removed. Use /api/verdict/runtime/compile and /api/verdict/runtime/runs.",
    workflowId: req.params.id,
    replacement: "/api/verdict/runtime/runs",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workflows/:id/run-step - Run a single step or up_to a step
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/run-step", async (req, res) => {
  res.status(410).json({
    message: "Legacy step execution has been removed. Use Verdict runtime compile/start.",
    workflowId: req.params.id,
    replacement: "/api/verdict/runtime/runs",
  });
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
        diagnosticCaptures: { orderBy: { createdAt: "asc" } },
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

    const killed = RunStore.kill(runId);
    console.log(
      `[Cancel] run ${runId}: ${killed ? "process killed" : "no process found"}`,
    );

    const completedAt = new Date();
    const start = run.startedAt ?? run.createdAt;
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: "cancelled",
        completedAt,
        ...(start
          ? { duration: Math.max(0, completedAt.getTime() - start.getTime()) }
          : {}),
      },
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
// GET /api/workflows/:id/runs/:runId/yaml - removed in Phase 8.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id/runs/:runId/yaml", (_req, res) => {
  res.status(410).json({
    message: "Run YAML download has been removed. Use BridgeFlow provenance and evidence APIs.",
    replacement: "/api/verdict/runtime/runs/:runId",
  });
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
