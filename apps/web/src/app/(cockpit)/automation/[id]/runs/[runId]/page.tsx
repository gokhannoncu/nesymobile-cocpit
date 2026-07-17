"use client";

import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  Download,
  Menu,
  Activity,
  ShieldAlert,
  Smartphone,
  Copy,
  ChevronDown,
  AlertTriangle,
  X,
  FastForward,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Info,
  Share2,
  MoreHorizontal
} from "lucide-react";
import { Button } from "@nesy/metronic/components/ui/button";
import { cn } from "@nesy/metronic/lib/utils";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { fetchWorkflow, fetchRunDetail, type WorkflowDetail, type WorkflowRun, type WorkflowStepResult } from "@/services/automation-api";
import { toast } from "sonner";
import { ExecutionTimeline, toExecutionTimelineSteps, type ExecutionTimelineStep } from "./ExecutionTimeline";

type RunDetailTab = "summary" | "parameters" | "logs" | "video";

const RUN_DETAIL_TABS: { id: RunDetailTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "parameters", label: "Parameters" },
  { id: "logs", label: "Logs" },
  { id: "video", label: "Video" },
];

type TraceStatus = "passed" | "warning" | "failed" | "skipped" | "running" | "pending";

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function normalizeDeviceText(value?: string | null) {
  return value?.trim().replace(/_/g, " ") || "";
}

function formatDeviceModelName(modelName: string) {
  const model = normalizeDeviceText(modelName);
  if (!model) return "Unknown device";
  if (/^SM[\s_-]?/i.test(model)) {
    return `Samsung ${model.replace(/^SM[\s_-]?/i, "SM ")}`;
  }
  return model;
}

function parseDeviceLabel(label: string | null | undefined) {
  if (!label) return { deviceId: null as string | null, model: null as string | null };

  const parts = label.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { deviceId: parts[0], model: parts.slice(1).join(" | ") };
  }

  const single = parts[0];
  if (/^[A-Z0-9]+$/i.test(single) && single.length >= 8) {
    return { deviceId: single, model: null };
  }

  return { deviceId: null, model: single };
}

function getRunDeviceDisplay(
  device: { modelName?: string; label?: string | null } | null | undefined,
  deviceId: string | null
) {
  const parsed = parseDeviceLabel(device?.label);
  const modelName = normalizeDeviceText(device?.modelName);
  const modelFromLabel = parsed.model ? normalizeDeviceText(parsed.model) : "";

  const displayName =
    (modelFromLabel && formatDeviceModelName(modelFromLabel)) ||
    (modelName && formatDeviceModelName(modelName)) ||
    parsed.deviceId ||
    deviceId ||
    "Unknown Device";

  return {
    displayName,
    deviceId: deviceId || parsed.deviceId,
  };
}

const traceStatusBadgeBase =
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded px-3 py-1 text-[10px] font-semibold";

function TraceStatusBadge({ status }: { status: TraceStatus }) {
  if (status === "passed") {
    return (
      <span className={cn(traceStatusBadgeBase, "bg-emerald-50 text-emerald-700")}>
        <CheckCircle2 className="size-3 shrink-0" /> Passed
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span className={cn(traceStatusBadgeBase, "bg-amber-50 text-amber-700")}>
        <AlertTriangle className="size-3 shrink-0" /> Warning
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className={cn(traceStatusBadgeBase, "bg-red-50 text-red-700")}>
        <ShieldAlert className="size-3 shrink-0" /> Failed
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className={cn(traceStatusBadgeBase, "bg-slate-100 text-slate-500")}>
        <FastForward className="size-3 shrink-0" /> Skipped
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className={cn(traceStatusBadgeBase, "bg-blue-50 text-blue-700")}>
        <Activity className="size-3 shrink-0" /> Running
      </span>
    );
  }
  return (
    <span className={cn(traceStatusBadgeBase, "bg-slate-100 text-slate-500")}>
      <Clock className="size-3 shrink-0" /> Pending
    </span>
  );
}

function TraceStepIcon({ status }: { status: TraceStatus }) {
  if (status === "warning") return <AlertTriangle className="size-4 text-amber-500" />;
  if (status === "failed") return <ShieldAlert className="size-4 text-red-500" />;
  if (status === "skipped") return <FastForward className="size-4 text-slate-400" />;
  if (status === "running") return <Activity className="size-4 text-blue-500" />;
  if (status === "pending") return <Clock className="size-4 text-slate-400" />;
  return <CheckCircle2 className="size-4 text-emerald-500" />;
}

function parseLogLine(line: string): { timestamp: string | null; level: string | null; message: string } {
  const trimmed = line.trim();
  const match = trimmed.match(/^(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(\w+)\s+(.*)$/);
  if (!match) {
    return { timestamp: null, level: null, message: trimmed };
  }
  return { timestamp: match[1], level: match[2], message: match[3] };
}

function buildRunReportExport(
  run: WorkflowRun,
  workflow: WorkflowDetail | null,
  steps: WorkflowStepResult[]
) {
  const logLines = run.maestroOutput
    ? run.maestroOutput.split("\n").filter((line) => line.trim().length > 0)
    : [];

  const passedSteps = steps.filter((s) => s.status === "success").length;
  const warningSteps = steps.filter((s) => s.status === "warning").length;
  const failedSteps = steps.filter((s) => s.status === "failed").length;

  return {
    exportedAt: new Date().toISOString(),
    run: {
      id: run.id,
      workflowId: run.workflowId,
      versionId: run.versionId,
      status: run.status,
      mode: run.mode,
      targetStepId: run.targetStepId,
      deviceId: run.deviceId,
      country: run.country,
      environment: run.environment,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs: run.duration,
      createdAt: run.createdAt,
    },
    workflow: {
      id: workflow?.id ?? run.workflow?.id ?? null,
      slug: workflow?.slug ?? run.workflow?.slug ?? null,
      name: workflow?.name ?? run.workflow?.name ?? null,
      version: run.version?.version ?? null,
    },
    device: run.device ?? null,
    summary: {
      totalSteps: steps.length,
      passed: passedSteps,
      warnings: warningSteps,
      failed: failedSteps,
    },
    steps: steps.map((step) => ({
      id: step.id,
      nodeId: step.nodeId,
      nodeTitle: step.nodeTitle,
      nodeType: step.nodeType,
      order: step.order,
      status: step.status,
      durationMs: step.duration,
      output: step.output,
      errorMessage: step.errorMessage,
      screenshotPath: step.screenshotPath,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
    })),
    logs: {
      raw: run.maestroOutput ?? null,
      lineCount: logLines.length,
      lines: logLines,
      entries: logLines.map((line, index) => ({
        index,
        ...parseLogLine(line),
        raw: line,
      })),
    },
  };
}

function downloadJsonFile(filename: string, data: unknown) {
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function mapStatus(status: string, runStatus?: string): TraceStatus {
  if (status === "success") return "passed";
  if (status === "warning") return "warning";
  if (status === "failed") return "failed";
  if (status === "skipped") return "skipped";
  if (status === "running") return "running";
  
  if (status === "pending" && runStatus && runStatus !== "running" && runStatus !== "pending") {
    return "skipped";
  }
  return "pending";
}

function ExecutionTraceRows({
  steps,
  runStatus,
  expandedStepIds,
  onToggleStep,
  onOpenParameters,
}: {
  steps: WorkflowStepResult[];
  runStatus: string;
  expandedStepIds: Set<string>;
  onToggleStep: (stepId: string) => void;
  onOpenParameters: (stepId: string) => void;
}) {
  return (
    <>
      {steps.map((step, index) => {
        const isExpanded = expandedStepIds.has(step.id);
        const mappedStatus = mapStatus(step.status, runStatus);
        const details = step.errorMessage || step.output || "Step completed";

        return (
          <Fragment key={step.id}>
            <tr
              className={cn(
                "cursor-pointer hover:bg-slate-50/50",
                index > 0 && "border-t border-slate-100"
              )}
              onClick={() => onToggleStep(step.id)}
            >
              <td className="px-2 py-3">
                <div className="flex items-center gap-2">
                  <TraceStepIcon status={mappedStatus} />
                  <span className="text-slate-500">{index + 1}</span>
                  <div>
                    <div className="font-medium text-slate-900">{step.nodeTitle}</div>
                    <div className="text-[10px] text-slate-500">{step.nodeType}</div>
                  </div>
                </div>
              </td>
              <td className="px-2 py-3">
                <TraceStatusBadge status={mappedStatus} />
              </td>
              <td className="px-2 py-3 text-xs font-semibold text-slate-900">{formatDuration(step.duration)}</td>
              <td className="px-2 py-3 text-xs text-slate-500">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate max-w-[200px] block">{details}</span>
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isExpanded
                        ? "border-orange-300 bg-orange-50 text-orange-600"
                        : "border-slate-200 bg-white text-slate-600"
                    )}
                    aria-hidden
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 stroke-[2.5] transition-transform duration-300 ease-in-out",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </span>
                </div>
              </td>
            </tr>

            <tr>
              <td colSpan={4} className="p-0">
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-in-out",
                    isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div
                      className={cn(
                        "transition-[padding,opacity] duration-300 ease-in-out",
                        isExpanded ? "p-2 pt-0 opacity-100" : "p-0 opacity-0"
                      )}
                    >
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 shadow-sm ring-1 ring-indigo-500/20">
                        <div className="space-y-2 rounded-md bg-white p-3 shadow-xs">
                           <div className="flex items-start gap-3">
                              {mappedStatus === "failed" ? (
                                <ShieldAlert className="size-4 shrink-0 text-red-500 mt-0.5" />
                              ) : mappedStatus === "warning" ? (
                                <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
                              ) : (
                                <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-700">Details</div>
                                <div className="text-xs text-slate-500 whitespace-pre-wrap">{details}</div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="ml-2 h-6 px-2 text-[10px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenParameters(step.id);
                                }}
                              >
                                Parameters
                              </Button>
                            </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </Fragment>
        );
      })}
    </>
  );
}

/* ─── Video Player Component ─── */
const SPEED_OPTIONS = [0.5, 1.0, 1.5, 2.0];

function VideoPlayer({
  videoUrl,
  steps,
  runStatus,
  runDuration,
  device,
  adbDeviceId,
}: {
  videoUrl: string | null;
  steps: WorkflowStepResult[];
  runStatus: string;
  runDuration: number | null | undefined;
  device: {
    modelName?: string;
    label?: string | null;
    osVersion?: string | null;
  } | null | undefined;
  adbDeviceId: string | null;
}) {
  const deviceDisplay = getRunDeviceDisplay(device, adbDeviceId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);

  const fmt = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
  }, []);

  const skip = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  }, []);

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setVideoDuration(v.duration);
  }, []);

  const onSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Number(e.target.value);
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, []);

  const changeSpeed = useCallback((s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setShowSpeedMenu(false);
  }, []);

  const goFullscreen = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
  }, []);

  const executionSteps = useMemo(
    () => toExecutionTimelineSteps(steps, runStatus),
    [steps, runStatus]
  );

  const activeStepId = useMemo(() => {
    if (executionSteps.length === 0) return null;
    let active = executionSteps[0].id;
    for (let i = 0; i < executionSteps.length; i++) {
      if (currentTime >= executionSteps[i].startOffsetSeconds) {
        active = executionSteps[i].id;
      } else {
        break;
      }
    }
    return active;
  }, [executionSteps, currentTime]);

  const handleTimelineStepClick = useCallback(
    (step: ExecutionTimelineStep) => {
      const video = videoRef.current;
      if (!video || !videoUrl) return;

      const nextTime = Math.max(0, Math.min(video.duration || step.startOffsetSeconds, step.startOffsetSeconds));
      video.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [videoUrl]
  );

  const handleDownloadVideo = useCallback(async () => {
    if (!videoUrl) return;
    const toastId = toast.loading("Downloading video recording...");
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nesy-recording-${runStatus === "completed" ? "success" : "failed"}-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Video downloaded successfully!", { id: toastId });
    } catch (error) {
      console.error("Failed to download video:", error);
      toast.error("Download failed. Opening video in a new tab...", { id: toastId });
      window.open(videoUrl, "_blank");
    }
  }, [videoUrl, runStatus]);

  const seekPercent = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Shimmer/Keyframe styling */}
      <style>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>

      {/* Outer Card Structure */}
      <div className="w-full max-w-[700px] mx-auto rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-white">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 select-none">
              \uD83D\uDCF1 Screen Recording
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 select-none">Recorded during workflow execution</span>
          </div>
          <div className="flex items-center gap-1.5">
            {videoUrl && (
              <button
                type="button"
                onClick={handleDownloadVideo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                title="Download Video"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}
            <button className="inline-flex items-center justify-center size-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors" title="Share">
              <Share2 className="size-3.5" />
            </button>
            <button className="inline-flex items-center justify-center size-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors" title="More Options">
              <MoreHorizontal className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Execution Badges */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-slate-100 bg-slate-50/50 select-none">
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Recorded
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {device?.osVersion ? `Android ${device.osVersion}` : "Android 14"}
          </span>
          <span
            className="max-w-[180px] truncate rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
            title={deviceDisplay.displayName}
          >
            {deviceDisplay.displayName}
          </span>
          {deviceDisplay.deviceId && (
            <span
              className="max-w-[140px] truncate rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 font-mono"
              title={`Device ID: ${deviceDisplay.deviceId}`}
            >
              {deviceDisplay.deviceId}
            </span>
          )}
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 font-mono">
            {fmt(videoDuration || (runDuration ? runDuration / 1000 : 42))}
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            2.4 MB
          </span>
        </div>

        {/* Video Preview Panel */}
        <div className="relative flex justify-center bg-gradient-to-br from-[#fcfbfe] via-[#f5f3ff] to-[#e0e7ff]/70 py-6 px-4 border-b border-slate-100 min-h-[300px]">
          {/* Shimmer loading skeleton */}
          {videoUrl && !isMetadataLoaded && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-br from-[#fcfbfe] via-[#f5f3ff] to-[#e0e7ff]/70 gap-3">
              <div className="w-[180px] h-[340px] rounded-2xl border border-slate-200/50 bg-white relative overflow-hidden flex flex-col items-center justify-center p-2 shadow-xs">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100/50 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
                <div className="w-16 h-2 rounded bg-slate-100 mt-2 animate-pulse" />
              </div>
              <span className="text-[11px] text-slate-400 font-semibold animate-pulse">Loading recording...</span>
            </div>
          )}

          {videoUrl ? (
            <div className="relative h-[380px] max-h-[380px] w-fit rounded-2xl shadow-2xl shadow-indigo-950/15 border border-slate-200/50 overflow-hidden bg-white">
              <video
                ref={videoRef}
                src={videoUrl}
                className="h-full w-auto object-contain bg-white"
                playsInline
                preload="metadata"
                onTimeUpdate={onTimeUpdate}
                onLoadedMetadata={() => {
                  onLoadedMetadata();
                  setIsMetadataLoaded(true);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />

              {isMetadataLoaded && (
                <div className="absolute inset-0 flex items-center justify-center gap-4 z-10 bg-black/35 opacity-0 hover:opacity-100 transition-opacity duration-200">
                  <button onClick={() => skip(-10)} className="flex flex-col items-center text-white/80 hover:text-white transition-colors p-2 cursor-pointer" title="Backward 10s">
                    <RotateCcw className="size-5" />
                    <span className="text-[8px] mt-0.5 font-semibold">10s</span>
                  </button>
                  <button
                    onClick={togglePlay}
                    className="flex size-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-xs text-white hover:bg-white/30 transition-colors shadow-xs cursor-pointer"
                  >
                    {isPlaying ? <Pause className="size-5 fill-white" /> : <Play className="ml-0.5 size-5 fill-white" />}
                  </button>
                  <button onClick={() => skip(10)} className="flex flex-col items-center text-white/80 hover:text-white transition-colors p-2 cursor-pointer" title="Forward 10s">
                    <RotateCw className="size-5" />
                    <span className="text-[8px] mt-0.5 font-semibold">10s</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[380px] w-[180px] flex flex-col items-center justify-center gap-3 bg-slate-900 rounded-2xl p-6 select-none shadow-xl border border-slate-850">
              <div className="flex size-11 items-center justify-center rounded-full bg-orange-500 text-white shadow-md ring-4 ring-orange-500/20">
                <Play className="ml-0.5 size-5 fill-white" />
              </div>
              <span className="text-center text-[10px] text-slate-400 px-4 leading-normal">
                Recording will appear here after the run
              </span>
            </div>
          )}
        </div>

        {/* Controls Bar */}
        {videoUrl && (
          <div className="px-4 py-3 bg-white">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="size-3.5 fill-slate-700" /> : <Play className="ml-0.5 size-3.5 fill-slate-700" />}
              </button>

              <span className="text-[11px] font-mono text-slate-500 shrink-0 select-none">
                {fmt(currentTime)} / {fmt(videoDuration || (runDuration ? runDuration / 1000 : 42))}
              </span>

              <div className="relative flex-1 group min-w-0">
                <div className="absolute inset-y-0 flex items-center w-full pointer-events-none">
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-600 transition-all"
                      style={{ width: `${seekPercent}%` }}
                    />
                  </div>
                </div>
                <input
                  ref={seekRef}
                  type="range"
                  min={0}
                  max={videoDuration || 0}
                  step={0.1}
                  value={currentTime}
                  onChange={onSeek}
                  className="relative w-full h-4 appearance-none bg-transparent cursor-pointer z-10 block
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:border-slate-500 [&::-webkit-slider-thumb]:shadow-xs [&::-webkit-slider-thumb]:hover:border-slate-800
                    [&::-webkit-slider-thumb]:transition-colors"
                />
              </div>

              <div className="relative shrink-0">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="inline-flex items-center justify-center h-7 px-2 rounded-lg bg-slate-50 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  {speed.toFixed(1)}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full mb-1 right-0 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 min-w-[70px]">
                    {SPEED_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => changeSpeed(s)}
                        className={cn(
                          "block w-full px-3 py-1.5 text-[11px] text-left hover:bg-slate-50 transition-colors",
                          speed === s && "font-bold text-orange-600 bg-orange-50/50"
                        )}
                      >
                        {s.toFixed(1)}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={toggleMute}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>

              <button
                onClick={goFullscreen}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                title="Fullscreen"
              >
                <Maximize className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Execution Timeline beneath the card */}
      <div className="mt-2">
        <ExecutionTimeline
          steps={executionSteps}
          activeStepId={activeStepId}
          onStepClick={videoUrl ? handleTimelineStepClick : undefined}
        />
      </div>
    </div>
  );
}

export default function RunResultsPage() {
  const params = useParams();
  const workflowId = params.id as string;
  const runId = params.runId as string;
  const router = useRouter();

  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [activeTab, setActiveTab] = useState<RunDetailTab>("summary");
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set());
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const runVideoUrl = run?.screenshotDir 
    ? `/automation-api/media/${run.screenshotDir}` 
    : null;

  const toggleStepExpanded = (stepId: string) => {
    setExpandedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const handleOpenParameters = (stepId: string) => {
    setSelectedStepId(stepId);
    setActiveTab("parameters");
  };

  const handleExportReport = () => {
    if (!run) return;

    const exportPayload = buildRunReportExport(run, workflow, run.stepResults ?? []);
    const workflowSlug = workflow?.slug ?? run.workflow?.slug ?? workflowId;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `nesy-run-${workflowSlug}-${run.id}-${timestamp}.json`;

    downloadJsonFile(filename, exportPayload);
    toast.success("Run logs exported as JSON.");
  };

  useEffect(() => {
    fetchWorkflow(workflowId).then(setWorkflow).catch(console.error);
    fetchRunDetail(workflowId, runId).then(setRun).catch(console.error);
  }, [workflowId, runId]);

  const steps = useMemo(() => {
    if (!run?.stepResults) return [];
    return [...run.stepResults].sort((a, b) => {
      const timeA = a.startedAt ? new Date(a.startedAt).getTime() : Number.MAX_SAFE_INTEGER;
      const timeB = b.startedAt ? new Date(b.startedAt).getTime() : Number.MAX_SAFE_INTEGER;
      if (timeA === timeB) return a.order - b.order;
      return timeA - timeB;
    });
  }, [run?.stepResults]);

  if (!run) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Activity className="size-8 animate-pulse text-slate-300" />
      </div>
    );
  }

  const totalSteps = steps.length;
  const passedSteps = steps.filter((s) => s.status === "success").length;
  const warningSteps = steps.filter((s) => s.status === "warning").length;
  const failedSteps = steps.filter((s) => s.status === "failed").length;
  
  const completedSteps = steps.filter((s) => 
    ["passed", "warning", "failed", "skipped"].includes(mapStatus(s.status, run.status))
  ).length;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  
  const passedPercent = totalSteps > 0 ? Math.round((passedSteps / totalSteps) * 100) : 0;
  const warningPercent = totalSteps > 0 ? Math.round((warningSteps / totalSteps) * 100) : 0;
  const failedPercent = totalSteps > 0 ? Math.round((failedSteps / totalSteps) * 100) : 0;

  const deviceDisplay = getRunDeviceDisplay(run.device, run.deviceId);
  const maestroLogs = run.maestroOutput ? run.maestroOutput.split("\n") : [];
  
  let stepParameters: Record<string, unknown> = {};
  let stepTitle = "";
  if (selectedStepId) {
    const stepInfo = steps.find(s => s.id === selectedStepId);
    if (stepInfo && run.version?.nodes) {
      stepTitle = stepInfo.nodeTitle;
      const node = run.version.nodes.find((n: { id: string }) => n.id === stepInfo.nodeId) as { data?: { config?: Record<string, unknown> } } | undefined;
      if (node?.data?.config) {
        stepParameters = node.data.config;
      }
    }
  }

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 text-slate-950 overflow-hidden font-sans">
      {/* Top Navigation */}
      <header className="relative flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-4">
        <button
          type="button"
          onClick={() => router.push(`/automation/${workflowId}`)}
          className="z-10 flex items-center gap-2 hover:opacity-80"
        >
          <img
            src="/media/app/nesy-courier-app-icon.png"
            alt="NESY"
            width={24}
            height={24}
            className="size-6 shrink-0 rounded-[6px] object-contain"
          />
          <span className="whitespace-nowrap text-sm font-semibold tracking-[-0.02em] text-slate-900">
            NESY AUTOMATION
          </span>
        </button>

        <nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 text-sm text-slate-500">
          <span>Workflows</span>
          <span>/</span>
          <span className="text-slate-900">{workflow?.name || "..."}</span>
          <span>/</span>
          <span className="font-semibold text-slate-900">Test Results</span>
        </nav>

        <div className="z-10 ml-auto flex items-center gap-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-slate-500">
              <Clock
                className={cn(
                  "size-3.5",
                  run.status === "running" ? "text-blue-500" : "text-emerald-600"
                )}
              />
              {run.status === "running" ? "Running" : "Run completed"}
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-slate-500">
              {run.completedAt ? new Date(run.completedAt).toLocaleString() : new Date(run.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-md"
              onClick={handleExportReport}
            >
              <Download className="size-3.5" />
              Export Report
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-8 shrink-0 rounded-md p-0"
              aria-label="Back to history"
              onClick={() => router.push("/automation/history")}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 justify-center overflow-y-auto px-6 pt-6">
        <div className="mx-auto w-full max-w-7xl space-y-6 pb-[60px]">
            
            {/* Success/Fail Banner */}
            {run.status === "success" && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex size-10 shrink-0 items-center justify-center">
                    <div className="absolute size-10 rounded-full bg-emerald-400/30" />
                    <div className="absolute size-9 rounded-full bg-emerald-300/25 blur-[3px]" />
                    <div className="relative flex size-7 items-center justify-center rounded-full bg-emerald-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                      <Check className="size-3.5 text-white" strokeWidth={3} />
                    </div>
                  </div>
                  <div className="leading-tight">
                    <h3 className="text-sm font-semibold text-emerald-900">Test run completed successfully</h3>
                    <p className="text-xs text-emerald-700">All steps executed with expected results.</p>
                  </div>
                </div>
                <Button onClick={() => setActiveTab("logs")} variant="outline" size="sm" className="h-7 bg-white px-2.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                  View Logs
                </Button>
              </div>
            )}
            {run.status === "failed" && (
              <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex size-10 shrink-0 items-center justify-center">
                    <div className="relative flex size-7 items-center justify-center rounded-full bg-red-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                      <ShieldAlert className="size-3.5 text-white" strokeWidth={3} />
                    </div>
                  </div>
                  <div className="leading-tight">
                    <h3 className="text-sm font-semibold text-red-900">Test run failed</h3>
                    <p className="text-xs text-red-700">Workflow execution encountered errors.</p>
                  </div>
                </div>
                <Button onClick={() => setActiveTab("logs")} variant="outline" size="sm" className="h-7 bg-white px-2.5 text-xs text-red-700 border-red-200 hover:bg-red-50">
                  View Logs
                </Button>
              </div>
            )}

            {/* Run Progress */}
            <div>
              <div className="mb-2 flex items-center justify-between text-sm font-medium">
                <span className="text-slate-700">Run Progress</span>
                <span className="text-slate-900">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-6 gap-4">
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Activity className="size-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Total Steps</div>
                  <div className="text-lg font-semibold">{totalSteps}</div>
                  <div className="text-xs text-slate-500">Executed</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Passed</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold text-emerald-600">{passedSteps}</span>
                    <span className="text-xs text-emerald-600">{passedPercent}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Warnings</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold text-amber-600">{warningSteps}</span>
                    <span className="text-xs text-amber-600">{warningPercent}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <ShieldAlert className="size-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Failed</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold text-red-600">{failedSteps}</span>
                    <span className="text-xs text-red-600">{failedPercent}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Clock className="size-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Duration</div>
                  <div className="text-lg font-semibold">{formatDuration(run.duration)}</div>
                  <div className="text-xs text-slate-500">mm:ss</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Smartphone className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-900">Device</div>
                  <div
                    className="text-sm font-semibold leading-snug text-slate-900"
                    title={deviceDisplay.displayName}
                  >
                    {deviceDisplay.displayName}
                  </div>
                  {deviceDisplay.deviceId && (
                    <div
                      className="mt-0.5 truncate text-xs font-medium text-slate-500"
                      title={`Device ID: ${deviceDisplay.deviceId}`}
                    >
                      ID: {deviceDisplay.deviceId}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Two Columns Layout */}
            <div className="grid grid-cols-12 items-start gap-6">
              
              {/* Execution Trace */}
              <div className="col-span-6 h-fit rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h3 className="font-semibold text-slate-900">Execution Trace</h3>
                  <button className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900">
                    <Menu className="size-3.5" /> All Steps
                  </button>
                </div>
                <div className="p-2 text-sm">
                  <table className="w-full text-left">
                    <thead className="text-xs text-slate-500">
                      <tr>
                        <th className="px-2 py-2 font-medium">Step</th>
                        <th className="px-2 py-2 font-medium">Status</th>
                        <th className="px-2 py-2 font-medium">Time</th>
                        <th className="px-2 py-2 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      <ExecutionTraceRows
                        steps={steps}
                        runStatus={run.status}
                        expandedStepIds={expandedStepIds}
                        onToggleStep={toggleStepExpanded}
                        onOpenParameters={handleOpenParameters}
                      />
                    </tbody>
                  </table>
                  {steps.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-sm">No steps found for this run.</div>
                  )}
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-b-lg">
                  <span className="text-sm font-semibold text-slate-900">Total Execution Time</span>
                  <span className="text-sm font-bold text-slate-900">{formatDuration(run.duration)}</span>
                </div>
              </div>

              {/* Run Details */}
              <div className="col-span-6 h-fit rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h3 className="font-semibold text-slate-900">Run Details</h3>
                  <div className="text-xs font-mono text-slate-500" title={run.id}>
                    ID: {run.id.length > 12 ? `${run.id.substring(0, 12)}...` : run.id}
                  </div>
                </div>
                
                {/* Tabs */}
                <div className="flex items-center gap-6 border-b border-slate-200 px-4 pt-2">
                  {RUN_DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-1 border-b-2 pb-2 text-sm transition-colors",
                        activeTab === tab.id
                          ? "border-orange-500 font-semibold text-orange-600"
                          : "border-transparent font-medium text-slate-500 hover:text-slate-900"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-4 space-y-6">
                  {activeTab === "summary" && (
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="py-2 text-slate-500">Environment</td>
                          <td className="py-2 text-right font-medium text-slate-900">{run.environment || "\u2014"}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-500">Country</td>
                          <td className="py-2 text-right font-medium text-slate-900">{run.country || "\u2014"}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-500">Device ID</td>
                          <td className="py-2 text-right font-medium text-slate-900">{run.deviceId || "\u2014"}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-500">Started At</td>
                          <td className="py-2 text-right font-medium text-slate-900">
                            {run.startedAt ? new Date(run.startedAt).toLocaleString() : "\u2014"}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-500">Finished At</td>
                          <td className="py-2 text-right font-medium text-slate-900">
                            {run.completedAt ? new Date(run.completedAt).toLocaleString() : "\u2014"}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-500">App Version</td>
                          <td className="py-2 text-right font-medium text-slate-900">\u2014</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-500">Result</td>
                          <td className="py-2 text-right">
                            <span className="inline-flex justify-end">
                              <TraceStatusBadge status={mapStatus(run.status)} />
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  {activeTab === "logs" && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900">Execution Log</h4>
                        <button 
                          type="button" 
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                          onClick={() => {
                            if (run.maestroOutput) navigator.clipboard.writeText(run.maestroOutput);
                          }}
                        >
                          <Copy className="size-3" /> Copy
                        </button>
                      </div>
                      <div className="rounded-lg bg-slate-900 p-3 text-[11px] font-mono leading-relaxed text-slate-300 max-h-[400px] overflow-y-auto">
                        {maestroLogs.length > 0 ? (
                          maestroLogs.map((log, i) => (
                            <div key={i} className="break-all whitespace-pre-wrap">{log}</div>
                          ))
                        ) : (
                          <div className="text-slate-500 italic">No logs available</div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "video" && (
                    <VideoPlayer
                      videoUrl={runVideoUrl}
                      steps={steps}
                      runStatus={run.status}
                      runDuration={run.duration}
                      device={run.device}
                      adbDeviceId={run.deviceId}
                    />
                  )}

                  {activeTab === "parameters" && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-slate-900">
                        Step Parameters <span className="font-normal text-slate-500">({stepTitle || "None Selected"})</span>
                      </h4>
                      {Object.keys(stepParameters).length > 0 ? (
                        <table className="w-full text-xs font-mono">
                          <tbody className="divide-y divide-slate-50">
                            {Object.entries(stepParameters).map(([key, value]) => (
                              <tr key={key}>
                                <td className="py-1 text-slate-500">{key}</td>
                                <td className="py-1 text-right text-slate-900">{JSON.stringify(value)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="text-xs text-slate-500 italic mt-2">
                          {selectedStepId ? "No parameters found for this step." : "Select a step in the trace and click 'Parameters' to view."}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>

            </div>
            <div className="h-[60px] shrink-0" aria-hidden="true" />
        </div>
      </main>
    </div>
  );
}
