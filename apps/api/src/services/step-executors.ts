/**
 * Non-Maestro Step Executors
 *
 * HTTP_REQUEST and DATABASE_QUERY steps are intercepted from Maestro stdout
 * and executed server-side. Results are written back to DB.
 */

import { prisma } from "@nesy/db";

interface HttpStepConfig {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  expectedStatus?: number;
}

interface DbStepConfig {
  query: string;
  params?: unknown[];
  expectedRows?: number;
}

export const StepExecutors = {
  async executeHttpRequest(
    runId: string,
    nodeId: string,
    config: HttpStepConfig
  ): Promise<{ success: boolean; output: string }> {
    const startedAt = new Date();

    try {
      await prisma.workflowStepResult.updateMany({
        where: { runId, nodeId },
        data: { status: "running", startedAt },
      });

      const response = await fetch(config.url, {
        method: config.method,
        headers: {
          "Content-Type": "application/json",
          ...config.headers,
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
      });

      const responseText = await response.text();
      const expectedStatus = config.expectedStatus ?? 200;
      const success = response.status === expectedStatus;

      const output = JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        body: responseText.substring(0, 5000),
      });

      await prisma.workflowStepResult.updateMany({
        where: { runId, nodeId },
        data: {
          status: success ? "success" : "failed",
          completedAt: new Date(),
          duration: Date.now() - startedAt.getTime(),
          output,
          errorMessage: success ? null : `Expected ${expectedStatus}, got ${response.status}`,
        },
      });

      return { success, output };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown HTTP error";

      await prisma.workflowStepResult.updateMany({
        where: { runId, nodeId },
        data: {
          status: "failed",
          completedAt: new Date(),
          duration: Date.now() - startedAt.getTime(),
          errorMessage: errorMsg,
        },
      });

      return { success: false, output: errorMsg };
    }
  },

  async executeDatabaseQuery(
    runId: string,
    nodeId: string,
    config: DbStepConfig
  ): Promise<{ success: boolean; output: string }> {
    const startedAt = new Date();

    try {
      await prisma.workflowStepResult.updateMany({
        where: { runId, nodeId },
        data: { status: "running", startedAt },
      });

      const result = await prisma.$queryRawUnsafe(config.query, ...(config.params ?? []));

      const rows = Array.isArray(result) ? result : [];
      const output = JSON.stringify({
        rowCount: rows.length,
        rows: rows.slice(0, 100),
      });

      let success = true;
      if (config.expectedRows !== undefined) {
        success = rows.length === config.expectedRows;
      }

      await prisma.workflowStepResult.updateMany({
        where: { runId, nodeId },
        data: {
          status: success ? "success" : "failed",
          completedAt: new Date(),
          duration: Date.now() - startedAt.getTime(),
          output,
          errorMessage: success
            ? null
            : `Expected ${config.expectedRows} rows, got ${rows.length}`,
        },
      });

      return { success, output };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown DB error";

      await prisma.workflowStepResult.updateMany({
        where: { runId, nodeId },
        data: {
          status: "failed",
          completedAt: new Date(),
          duration: Date.now() - startedAt.getTime(),
          errorMessage: errorMsg,
        },
      });

      return { success: false, output: errorMsg };
    }
  },
};
