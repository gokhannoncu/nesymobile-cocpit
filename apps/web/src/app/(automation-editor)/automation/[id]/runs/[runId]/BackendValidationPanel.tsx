"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CircleX, Clock, Loader2 } from "lucide-react";
import { cn } from "@nesy/metronic/lib/utils";
import type { WorkflowStepResult } from "@/services/automation-api";
import {
  getBackendValidationPresentation,
  isBackendValidationStepId,
  parseBackendValidationOutput,
  type BackendHttpCapture,
  type BackendValidationStepOutput,
} from "../../backend-validation-lane";

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="size-3.5 text-emerald-600" />;
  if (status === "failed") return <CircleX className="size-3.5 text-red-600" />;
  if (status === "running") return <Loader2 className="size-3.5 animate-spin text-blue-600" />;
  return <Clock className="size-3.5 text-slate-400" />;
}

function JsonBlock({ value }: { value: unknown }) {
  if (value == null) return <span className="text-slate-400 italic">—</span>;
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <pre className="max-h-48 overflow-auto rounded bg-slate-900 p-2 text-[10px] leading-relaxed text-slate-300 whitespace-pre-wrap break-all">
      {text}
    </pre>
  );
}

function RequestCard({ request, index }: { request: BackendHttpCapture; index: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-semibold text-white">{request.method}</span>
        <span className="min-w-0 break-all text-slate-700">{request.url}</span>
        {request.status != null ? (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-semibold",
              request.status >= 200 && request.status < 300
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700",
            )}
          >
            HTTP {request.status}
          </span>
        ) : null}
        <span className="text-slate-400">#{index + 1}</span>
      </div>
      {request.headers && Object.keys(request.headers).length > 0 ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Headers</div>
          <JsonBlock value={request.headers} />
        </div>
      ) : null}
      {request.requestBody != null ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Request body</div>
          <JsonBlock value={request.requestBody} />
        </div>
      ) : null}
      {request.responseBody != null ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Response</div>
          <JsonBlock value={request.responseBody} />
        </div>
      ) : null}
      {request.error ? (
        <div className="text-[11px] text-red-600">{request.error}</div>
      ) : null}
    </div>
  );
}

function resolveOutput(step: WorkflowStepResult): BackendValidationStepOutput | null {
  return parseBackendValidationOutput(step.output);
}

export function BackendValidationPanel({ steps }: { steps: WorkflowStepResult[] }) {
  const backendSteps = useMemo(
    () => steps.filter((s) => isBackendValidationStepId(s.nodeId)),
    [steps],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = backendSteps.find((s) => s.id === selectedId) ?? backendSteps[0] ?? null;
  const output = selected ? resolveOutput(selected) : null;

  if (backendSteps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        No backend validations recorded for this run.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-[200px_1fr]">
      <div className="space-y-1">
        {backendSteps.map((step) => {
          const active = (selected?.id ?? null) === step.id;
          const stepOutput = resolveOutput(step);
          const presentation = stepOutput
            ? getBackendValidationPresentation(
                stepOutput.sourceNodeType,
                stepOutput.sourceTitle,
                stepOutput.validationKind,
              )
            : null;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setSelectedId(step.id)}
              className={cn(
                "flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                active
                  ? "border-orange-300 bg-orange-50/80"
                  : "border-slate-200 bg-white hover:border-slate-300",
              )}
            >
              <StatusIcon status={step.status} />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold text-slate-800">{step.nodeTitle}</span>
                <span className="block text-[10px] leading-snug text-slate-500">
                  {presentation?.description ?? step.nodeTitle}
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-400">{formatDuration(step.duration)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">{selected.nodeTitle}</div>
                <div className="text-[11px] leading-snug text-slate-500">
                  {output
                    ? getBackendValidationPresentation(
                        output.sourceNodeType,
                        output.sourceTitle,
                        output.validationKind,
                      ).description
                    : selected.nodeType}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <StatusIcon status={selected.status} />
                <span className="font-semibold capitalize text-slate-700">{selected.status}</span>
                <span className="text-slate-400">{formatDuration(selected.duration)}</span>
              </div>
            </div>

            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Verdict</div>
              <p className="text-xs text-slate-700">
                {output?.detail || selected.errorMessage || "No detail recorded."}
              </p>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Requests ({output?.requests?.length ?? 0})
              </div>
              {output?.requests && output.requests.length > 0 ? (
                <div className="space-y-2">
                  {output.requests.map((request, index) => (
                    <RequestCard key={`${request.url}-${index}`} request={request} index={index} />
                  ))}
                </div>
              ) : (
                <div className="text-xs italic text-slate-500">
                  No HTTP capture for this validation (e.g. logcat-only backend signal).
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
