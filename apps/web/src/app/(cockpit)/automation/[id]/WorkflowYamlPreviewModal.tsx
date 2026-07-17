"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Copy, Download, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@nesy/metronic/lib/utils";
import type { Connection, WorkflowNode } from "./workflow-types";
import { generateYamlFromFlow } from "./yaml-generator";

type PreviewTab = "yaml" | "json";

type WorkflowYamlPreviewModalProps = {
  open: boolean;
  workflowName: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  onClose: () => void;
};

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "workflow";
}

function buildYamlPreview(nodes: WorkflowNode[], connections: Connection[]) {
  const startNode = nodes.find((node) => node.type === "LAUNCH_APP");
  if (!startNode) {
    return "# Akista henuz LAUNCH_APP node'u bulunmuyor.\n# Lutfen canvas'a bir LAUNCH_APP ekleyin.";
  }

  try {
    return generateYamlFromFlow(startNode.id, nodes, connections);
  } catch (error) {
    return `# YAML olusturulurken bir hata olustu:\n# ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
}

function buildJsonPreview(workflowName: string, nodes: WorkflowNode[], connections: Connection[]) {
  const exportableNodes = nodes.filter((node) => !(node as WorkflowNode & { virtual?: boolean }).virtual);
  const payload = {
    nodes: exportableNodes,
    connections,
    metadata: {
      name: workflowName,
      status: "draft",
    },
  };

  return JSON.stringify(payload, null, 2);
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function highlightLine(line: string, tab: PreviewTab) {
  if (line.trimStart().startsWith("#")) {
    return <span className="text-emerald-400">{line}</span>;
  }

  const pattern =
    tab === "json"
      ? /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)|([{}[\],])/g
      : /("(?:[^"\\]|\\.)*")|(\btrue\b|\bfalse\b)|(^\s*-?\s*[\w.-]+)(:)|([{}[\],])/g;

  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(line.slice(lastIndex, index));
    const token = match[0];

    if (tab === "json") {
      if (match[2]) {
        parts.push(
          <span key={`${index}-key`} className="text-sky-300">
            {match[1]}
          </span>,
          <span key={`${index}-colon`} className="text-slate-300">
            {match[2]}
          </span>,
        );
      } else if (match[1]) {
        parts.push(
          <span key={`${index}-string`} className="text-emerald-300">
            {token}
          </span>,
        );
      } else if (match[3]) {
        parts.push(
          <span key={`${index}-boolean`} className="text-orange-300">
            {token}
          </span>,
        );
      } else if (match[4]) {
        parts.push(
          <span key={`${index}-number`} className="text-amber-300">
            {token}
          </span>,
        );
      } else {
        parts.push(
          <span key={`${index}-punct`} className="text-slate-400">
            {token}
          </span>,
        );
      }
    } else {
      // tab === "yaml"
      if (match[1]) {
        parts.push(
          <span key={`${index}-string`} className="text-emerald-300">
            {token}
          </span>,
        );
      } else if (match[2]) {
        parts.push(
          <span key={`${index}-boolean`} className="text-orange-300">
            {token}
          </span>,
        );
      } else if (match[3] && match[4]) {
        parts.push(
          <span key={`${index}-yaml-key`} className="text-sky-300">
            {match[3]}
          </span>,
          <span key={`${index}-yaml-colon`} className="text-slate-300">
            {match[4]}
          </span>,
        );
      } else {
        parts.push(
          <span key={`${index}-punct`} className="text-slate-400">
            {token}
          </span>,
        );
      }
    }

    lastIndex = index + token.length;
  }

  if (lastIndex < line.length) parts.push(line.slice(lastIndex));
  return parts.length > 0 ? parts : line || " ";
}

export function WorkflowYamlPreviewModal({
  open,
  workflowName,
  nodes,
  connections,
  onClose,
}: WorkflowYamlPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("yaml");
  const [copied, setCopied] = useState(false);
  const yamlPreview = useMemo(() => buildYamlPreview(nodes, connections), [connections, nodes]);
  const jsonPreview = useMemo(
    () => buildJsonPreview(workflowName, nodes, connections),
    [connections, nodes, workflowName],
  );
  const activeContent = activeTab === "yaml" ? yamlPreview : jsonPreview;
  const filename = `${slugify(workflowName)}.${activeTab === "yaml" ? "yaml" : "json"}`;
  const lines = activeContent.split("\n");

  const copyActiveContent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopied(true);
      toast.success(`${activeTab.toUpperCase()} copied to clipboard.`);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Preview could not be copied.");
    }
  }, [activeContent, activeTab]);

  const downloadActiveContent = useCallback(() => {
    downloadText(
      filename,
      activeContent,
      activeTab === "yaml" ? "application/x-yaml;charset=utf-8" : "application/json;charset=utf-8",
    );
  }, [activeContent, activeTab, filename]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8 sm:p-[60px]" role="dialog" aria-modal="true" aria-labelledby="workflow-yaml-preview-title">
      <button
        type="button"
        aria-label="Close preview"
        className="absolute inset-0 bg-[rgba(15,23,42,0.16)] backdrop-blur-[4px]"
        onClick={onClose}
      />
      <div className="relative flex max-h-[calc(100vh-120px)] w-[820px] max-w-[calc(100vw-120px)] flex-col rounded-[6px] border border-[#E5EAF2] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] max-sm:max-h-[calc(100vh-48px)] max-sm:max-w-[calc(100vw-32px)] max-sm:p-4">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="workflow-yaml-preview-title" className="text-lg font-bold tracking-[-0.01em] text-slate-950">
              Workflow YAML Preview
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Generated from current workflow</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PreviewActionButton onClick={copyActiveContent}>
              <Copy className="size-4" />
              {copied ? "Copied" : "Copy"}
            </PreviewActionButton>
            <PreviewActionButton onClick={downloadActiveContent}>
              <Download className="size-4" />
              Download
            </PreviewActionButton>
            <button
              type="button"
              aria-label="Close preview"
              onClick={onClose}
              className="flex size-[38px] items-center justify-center rounded-[6px] border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="mt-4 flex border-b border-slate-200" role="tablist" aria-label="Preview format">
          {(["yaml", "json"] as PreviewTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "h-10 border-b-2 px-3 text-sm font-semibold transition-colors",
                activeTab === tab
                  ? "border-orange-500 text-slate-950"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[6px] border border-slate-800/90 bg-[#0F172A] shadow-inner">
          <pre className="h-[min(430px,calc(100vh-330px))] min-h-[260px] overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.10),transparent_34%),#0F172A] py-4 font-mono text-[12px] leading-6 text-slate-200 max-sm:h-[calc(100vh-330px)] max-sm:min-h-[220px]">
            {lines.map((line, index) => (
              <code key={`${index}-${line}`} className="grid grid-cols-[52px_1fr] px-4">
                <span className="select-none pr-4 text-right text-slate-500">{index + 1}</span>
                <span className="min-w-max whitespace-pre">{highlightLine(line, activeTab)}</span>
              </code>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}

function PreviewActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[38px] items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
    >
      {children}
    </button>
  );
}
