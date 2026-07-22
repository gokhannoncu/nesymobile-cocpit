"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const WorkflowEditorPage = dynamic(
  () => import("./workflow-editor").then((mod) => ({ default: mod.WorkflowEditorPage })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-slate-400" aria-label="Loading workflow editor" />
      </div>
    ),
  },
);

export function WorkflowEditorLoader({ workflowId }: { workflowId: string }) {
  return <WorkflowEditorPage workflowId={workflowId} />;
}
