"use client";

import dynamic from "next/dynamic";
import { WorkflowCanvasLoadingShimmer } from "./workflow-canvas-loading-shimmer";

const WorkflowEditorPage = dynamic(
  () => import("./workflow-editor").then((mod) => ({ default: mod.WorkflowEditorPage })),
  {
    ssr: false,
    loading: () => (
      <div className="h-dvh w-full" aria-label="Loading workflow editor">
        <WorkflowCanvasLoadingShimmer />
      </div>
    ),
  },
);

export function WorkflowEditorLoader({ workflowId }: { workflowId: string }) {
  return <WorkflowEditorPage workflowId={workflowId} />;
}
