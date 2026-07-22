"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Battery,
  Box,
  Cable,
  Check,
  CheckCircle2,
  CircleX,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  GitBranch,
  Grid3X3,
  GripVertical,
  Hand,
  Lightbulb,
  Loader2,
  Map as MapIcon,
  Maximize2,
  MoreHorizontal,
  MousePointer2,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Smartphone,
  Trash2,
  Truck,
  UserCheck,
  UserRound,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { CSSProperties, MouseEvent, MutableRefObject, ReactNode } from "react";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { Button } from "@nesy/metronic/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@nesy/metronic/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nesy/metronic/components/ui/dropdown-menu";
import { Input } from "@nesy/metronic/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@nesy/metronic/components/ui/popover";
import { cn } from "@nesy/metronic/lib/utils";
import { listNesyMobileAdbDevices, type NesyMobileAdbDevice } from "@/services/nesy-mobile-auth";
import { toast } from "sonner";
import { InvalidWorkflowStepDialog } from "./invalid-workflow-step-dialog";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import {
  allPaletteItems,
  getWorkflowNodeDisplay,
  iconRegistry,
  nodeToneByType,
  parseWorkflowSubtitleTags,
  paletteItemFromType,
  workflowComponentGroups,
  workflowComponentRegistry,
} from "./workflow-registry";
import {
  validateNodeDrop,
  validateWorkflowState,
  type DropTarget,
  type RuleValidationResult,
} from "./workflow-rule-engine";
import { getWorkflowTemplate, workflowTemplates, type WorkflowTemplate } from "./workflow-templates";
import {
  buildWorkflowRunVisualization,
  getCanvasNodeExecutionStatus,
  TRAVERSED_CONNECTION_COLOR,
  type WorkflowRunVisualization,
} from "./workflow-run-visualization";
import {
  layoutBackendValidationLane,
  getBackendLaneNodeDimensions,
} from "./backend-validation-lane";
import { BackendLaneNodeView } from "./BackendLaneNodeView";
import { WorkflowYamlPreviewModal } from "./WorkflowYamlPreviewModal";
import { YamlPreviewPanel } from "./YamlPreviewPanel";
import {
  WorkflowNodeType,
  type BranchType,
  type Connection,
  type PaletteItem,
  type SourceHandle,
  type WorkflowNode,
} from "./workflow-types";

const RIGHT_PROPERTIES_PANEL_PX = 320;

const VIEWPORT_ZOOM_MIN = 0.3;
const VIEWPORT_ZOOM_MAX = 2.5;
const VIEWPORT_ZOOM_DEFAULT = 1;
const VIEWPORT_ZOOM_WHEEL_SENSITIVITY = 0.003;
const VIEWPORT_ZOOM_TRACKPAD_SENSITIVITY = 0.01;
const VIEWPORT_ZOOM_BUTTON_FACTOR = 1.2;
const VIEWPORT_SCROLL_SENSITIVITY = 1;
const VIEWPORT_ZOOM_INDICATOR_HIDE_MS = 1200;
const VIEWPORT_GRID_SPACING_PX = 20;
const VIEWPORT_GRID_DOT_RADIUS_PX = 1.2;
const VIEWPORT_GRID_DOT = "rgba(148, 163, 184, 0.22)";
const VIEWPORT_CONTENT_APPROX_WIDTH = 1000;
const VIEWPORT_CONTENT_APPROX_HEIGHT = 720;
const WORKFLOW_SELECTED_DEVICE_STORAGE_KEY = "nesy-workflow-selected-device-id";
const WORKFLOW_LAST_RUN_PAYLOAD_STORAGE_KEY = "nesy-workflow-last-run-payload";
const DEVICE_REFRESH_INTERVAL_MS = 3000;

type WorkflowDeviceStatus = "Online" | "Testing" | "Emulator" | "Offline" | "Unauthorized";

interface WorkflowRunPayload {
  workflowId: string;
  workflowName: string;
  selectedDeviceId: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  requestedAt: string;
}

function normalizeDeviceText(value?: string | null) {
  return value?.trim().replace(/_/g, " ") || "";
}

function titleCaseWord(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getDeviceModelLabel(device: NesyMobileAdbDevice) {
  const model = normalizeDeviceText(device.marketName) || normalizeDeviceText(device.modelName) || "Unknown device";
  const manufacturer = normalizeDeviceText(device.manufacturer);
  if (!manufacturer) return model;
  const normalizedManufacturer = titleCaseWord(manufacturer);
  return model.toLowerCase().startsWith(manufacturer.toLowerCase())
    ? model
    : `${normalizedManufacturer} ${model}`;
}

function getDeviceTitle(device: NesyMobileAdbDevice) {
  const model = getDeviceModelLabel(device);
  return device.androidVersion ? `${model} \u2022 Android ${device.androidVersion}` : model;
}

function getDeviceStatus(device: NesyMobileAdbDevice): WorkflowDeviceStatus {
  const status = device.status.toLowerCase();
  const model = `${device.id} ${device.modelName} ${device.marketName ?? ""}`.toLowerCase();

  if (status === "testing") return "Testing";
  if (status === "unauthorized") return "Unauthorized";
  if (status !== "device") return "Offline";
  if (device.id.startsWith("emulator-") || model.includes("emulator") || model.includes("sdk_gphone")) {
    return "Emulator";
  }
  return "Online";
}

function getDeviceStatusClassName(status: WorkflowDeviceStatus) {
  if (status === "Online") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Testing") return "border-orange-200 bg-orange-50 text-orange-700";
  if (status === "Emulator") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "Unauthorized") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function getDeviceBatteryLabel(device: NesyMobileAdbDevice) {
  return typeof device.batteryLevel === "number" ? `${device.batteryLevel}%` : "--";
}

function formatDeviceLastSeen(device: NesyMobileAdbDevice) {
  if (!device.lastSeenAt) return "Unknown";
  const timestamp = new Date(device.lastSeenAt).getTime();
  if (Number.isNaN(timestamp)) return "Unknown";

  const diffMs = Date.now() - timestamp;
  if (diffMs < 60_000) return "Just now";
  const minutes = Math.max(1, Math.round(diffMs / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function isDeviceRunnable(device: NesyMobileAdbDevice) {
  const status = getDeviceStatus(device);
  return status === "Online" || status === "Testing" || status === "Emulator";
}

const NODE_WIDTH = 228;
const NODE_HEIGHT = 76;
const START_NODE_VERTICAL_GAP = 120;
const NODE_VERTICAL_GAP = 56;
const BRANCH_HORIZONTAL_GAP = 260;
const BRANCH_VERTICAL_GAP = 112;
const CONDITION_BRANCH_OFFSET = 180;
const CONDITION_SPLIT_OFFSET_Y = 48;
const CANVAS_ROOT_X = 380;
const CANVAS_ROOT_Y = 80;
const CONNECTION_COLOR = "#D7DEE8";
const CONNECTION_WIDTH = 2;
const BRANCH_CORNER_RADIUS = 8;
const BRANCH_CONNECTOR_DASH = "6 6";
const SIDE_CONNECTOR_VERTICAL_THRESHOLD = NODE_HEIGHT * 1.25;
const JOINABLE_NODE_TYPES = new Set<WorkflowNodeType>([
  WorkflowNodeType.CHECK_ROUTE,
  WorkflowNodeType.VALIDATE_STOPLIST,
]);
const STORAGE_VERSION = 1;
const AUTOSAVE_DEBOUNCE_MS = 1500;

type PersistStatus = "idle" | "saving" | "autosaved" | "save_failed" | "saved_version";

function workflowContentFingerprint(nodes: WorkflowNode[], connections: Connection[]) {
  return JSON.stringify({ nodes, connections });
}

function clampScale(s: number) {
  return Math.min(VIEWPORT_ZOOM_MAX, Math.max(VIEWPORT_ZOOM_MIN, s));
}

const workflowCollisionDetection: CollisionDetection = (args) => {
  const collisions = pointerWithin(args);
  const fallbackCollisions = collisions.length > 0 ? collisions : rectIntersection(args);
  const priority = (id: string | number) => {
    const value = String(id);
    if (value.startsWith("branch-")) return 0;
    if (value.startsWith("connection-")) return 1;
    if (value.startsWith("node-")) return 2;
    return 3;
  };

  return [...fallbackCollisions].sort((a, b) => priority(a.id) - priority(b.id));
};

type CanvasPointerTool = "hand" | "move";

type WorkflowState = {
  nodes: WorkflowNode[];
  connections: Connection[];
  selectedNodeId?: string | null;
  zoom: number;
  pan: { x: number; y: number };
  reset: () => void;
  importSnapshot: (snapshot: WorkflowSnapshot) => void;
  addNode: (paletteItem: PaletteItem, target?: DropTarget) => void;
  addRequiredFlowSkeleton: () => void;
  replaceWithTemplate: (templateId: string, viewportCenter: { x: number; y: number }) => void;
  duplicateNode: (nodeId: string) => void;
  deleteConnection: (connectionId: string) => void;
  deleteNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
};

type WorkflowSnapshot = Pick<WorkflowState, "nodes" | "connections" | "selectedNodeId" | "zoom" | "pan"> & {
  version?: number;
};

type CanvasRenderNode = WorkflowNode & {
  virtual?: boolean;
  visualRole?: "start_trigger" | "backend_header" | "backend_lane";
};

type CanvasRenderConnection = Connection & {
  virtual?: boolean;
  backendLane?: boolean;
};

const workflowTitles: Record<string, string> = {
  "teslimat-akisi": "Courier Delivery Flow",
  "pickup-flow": "Pickup Flow",
  "r-doc-iptal": "R-Doc Cancel Flow",
  "cod-tahsilat": "COD Collection Flow",
  "imza-alma": "Signature Capture Flow",
  "adres-dogrulama": "Address Verification Flow",
  "bildirim-gonderim": "Notification Delivery Flow",
  "kimlik-dogrulama": "Identity Verification Flow",
};

function titleFromId(id: string) {
  return (
    workflowTitles[id] ??
    id
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createNodeFromPalette(item: PaletteItem): WorkflowNode {
  return {
    id: createId("node"),
    type: item.type,
    kind: item.kind,
    position: { x: CANVAS_ROOT_X, y: CANVAS_ROOT_Y },
    data: {
      title: item.title,
      subtitle: item.subtitle,
      icon: item.icon,
      config: { ...(item.defaultConfig ?? {}) },
    },
    parentId: null,
    children: [],
    branchType: null,
    nextNodeId: null,
    connections: [],
  };
}

function cloneNodeForDuplicate(node: WorkflowNode): WorkflowNode {
  const config = node.data.config ? JSON.parse(JSON.stringify(node.data.config)) as Record<string, unknown> : {};

  return {
    ...node,
    id: createId("node"),
    position: {
      x: node.position.x + 56,
      y: node.position.y + 56,
    },
    data: {
      ...node.data,
      title: `${node.data.title} copy`,
      config,
    },
    parentId: null,
    children: [],
    branchType: null,
    nextNodeId: null,
    connections: [],
  };
}

function createConnection(sourceNodeId: string, targetNodeId: string, sourceHandle: SourceHandle = "default"): Connection {
  return {
    id: createId("connection"),
    sourceNodeId,
    targetNodeId,
    sourceHandle,
    targetHandle: "top",
    label: sourceHandle === "true" ? "True" : sourceHandle === "false" ? "False" : undefined,
    branchLabel: sourceHandle === "true" ? "True" : sourceHandle === "false" ? "False" : undefined,
  };
}

function createTemplateFromRegistry(templateId: string, viewportCenter: { x: number; y: number }) {
  const template = getWorkflowTemplate(templateId);
  if (!template) return null;

  const idMap = new Map<string, string>();
  const nodes = template.nodes.map((templateNode) => {
    const node = createNodeFromPalette(paletteItemFromType(templateNode.type));
    idMap.set(templateNode.id, node.id);
    return node;
  });

  const connections = template.connections.flatMap((templateConnection) => {
    const sourceNodeId = idMap.get(templateConnection.sourceNodeId);
    const targetNodeId = idMap.get(templateConnection.targetNodeId);
    if (!sourceNodeId || !targetNodeId) return [];
    return [
      {
        ...createConnection(sourceNodeId, targetNodeId, templateConnection.sourceHandle),
        targetHandle: templateConnection.targetHandle,
        label: templateConnection.label,
        branchLabel: templateConnection.label,
      },
    ];
  });

  return centerWorkflowOnPoint(normalizeWorkflow(nodes, connections), connections, viewportCenter);
}

function centerWorkflowOnPoint(nodes: WorkflowNode[], connections: Connection[], viewportCenter: { x: number; y: number }) {
  if (nodes.length === 0) return { nodes, connections, selectedNodeId: null };

  const bounds = nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.position.x),
      minY: Math.min(acc.minY, node.position.y),
      maxX: Math.max(acc.maxX, node.position.x + NODE_WIDTH),
      maxY: Math.max(acc.maxY, node.position.y + NODE_HEIGHT),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
  const currentCenter = {
    x: bounds.minX + (bounds.maxX - bounds.minX) / 2,
    y: bounds.minY + (bounds.maxY - bounds.minY) / 2,
  };
  const offset = {
    x: viewportCenter.x - currentCenter.x,
    y: viewportCenter.y - currentCenter.y,
  };
  const centeredNodes = nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + offset.x,
      y: node.position.y + offset.y,
    },
  }));
  const selectedNodeId =
    centeredNodes.find((node) => node.type === WorkflowNodeType.LAUNCH_APP)?.id ??
    centeredNodes.at(0)?.id ??
    null;

  return {
    nodes: enrichWorkflowNodes(centeredNodes, connections),
    connections,
    selectedNodeId,
  };
}

function createPlaceholderConnection(sourceNodeId: string, sourceHandle: BranchType): Connection {
  return {
    id: createId("connection"),
    sourceNodeId,
    targetNodeId: null,
    sourceHandle,
    targetHandle: null,
    label: sourceHandle === "true" ? "True" : "False",
    branchLabel: sourceHandle === "true" ? "True" : "False",
    isPlaceholder: true,
  };
}

function getConnectionBranchType(connection: Connection): BranchType | null {
  if (
    connection.label === "True" ||
    connection.branchLabel === "True" ||
    connection.sourceHandle === "true"
  )
    return "true";
  if (
    connection.label === "False" ||
    connection.branchLabel === "False" ||
    connection.sourceHandle === "false"
  )
    return "false";
  return null;
}

function getVirtualStartNode(nodes: WorkflowNode[]): CanvasRenderNode | null {
  const launchAppNode = nodes.find((node) => node.type === WorkflowNodeType.LAUNCH_APP);
  if (!launchAppNode) return null;

  return {
    ...launchAppNode,
    id: "__start__",
    position: {
      x: launchAppNode.position.x,
      y: launchAppNode.position.y - START_NODE_VERTICAL_GAP,
    },
    data: {
      ...launchAppNode.data,
      title: "Start",
      subtitle: "Manual Trigger",
      icon: "Play",
      config: {},
    },
    virtual: true,
    visualRole: "start_trigger",
  };
}

function getVirtualStartConnection(startNode: CanvasRenderNode | null, nodes: WorkflowNode[]): CanvasRenderConnection | null {
  if (!startNode) return null;
  const launchAppNode = nodes.find((node) => node.type === WorkflowNodeType.LAUNCH_APP);
  if (!launchAppNode) return null;

  return {
    id: "__start_to_launch__",
    sourceNodeId: startNode.id,
    targetNodeId: launchAppNode.id,
    sourceHandle: "default",
    targetHandle: "top",
    virtual: true,
  };
}

const LEGACY_NODE_TYPE_MAP: Record<string, WorkflowNodeType> = {
  "launch-app": WorkflowNodeType.LAUNCH_APP,
  "open-deep-link": WorkflowNodeType.DEPRECATED_LEGACY,
  OPEN_DEEP_LINK: WorkflowNodeType.DEPRECATED_LEGACY,
  login: WorkflowNodeType.AUTH_LOGIN,
  "open-stop-list": WorkflowNodeType.DEPRECATED_LEGACY,
  OPEN_STOP_LIST: WorkflowNodeType.DEPRECATED_LEGACY,
  "delivery-operation": WorkflowNodeType.DELIVERY_OPERATION,
  "pickup-operation": WorkflowNodeType.PICKUP_OPERATION,
  "cancel-rdoc": WorkflowNodeType.RDOC_OPERATION,
  CANCEL_RDOC: WorkflowNodeType.RDOC_OPERATION,
  condition: WorkflowNodeType.CONDITION,
  wait: WorkflowNodeType.WAIT,
  "assert-visible": WorkflowNodeType.ASSERT_VISIBLE,
  "verify-backend-state": WorkflowNodeType.VERIFY_BACKEND_STATE,
  "http-request": WorkflowNodeType.HTTP_REQUEST,
  "database-query": WorkflowNodeType.DATABASE_QUERY,
};

function coerceNodeType(type: unknown): WorkflowNodeType {
  if (typeof type !== "string") return WorkflowNodeType.CONDITION;
  if (Object.values(WorkflowNodeType).includes(type as WorkflowNodeType)) return type as WorkflowNodeType;
  return LEGACY_NODE_TYPE_MAP[type] ?? WorkflowNodeType.CONDITION;
}

function normalizeConnection(connection: Connection): Connection {
  const rawSourceHandle = (connection as { sourceHandle?: string }).sourceHandle;
  const sourceHandle =
    rawSourceHandle === "bottom"
      ? "default"
      : connection.sourceHandle ?? (getConnectionBranchType(connection) ?? "default");

  return {
    ...connection,
    sourceHandle,
    targetHandle: connection.targetNodeId ? "top" : null,
    label: sourceHandle === "true" ? "True" : sourceHandle === "false" ? "False" : undefined,
    branchLabel: sourceHandle === "true" ? "True" : sourceHandle === "false" ? "False" : undefined,
    isPlaceholder: connection.isPlaceholder ?? !connection.targetNodeId,
  };
}

function normalizeNode(node: WorkflowNode): WorkflowNode {
  const normalizedType = coerceNodeType(node.type);
  const definition = workflowComponentRegistry[normalizedType];
  const isDeprecated = normalizedType === WorkflowNodeType.DEPRECATED_LEGACY || !definition;
  const resolvedTitle = node.data?.title ?? definition?.title ?? "Deprecated Node";
  return {
    ...node,
    type: normalizedType,
    kind: definition?.kind ?? node.kind ?? "action",
    data: {
      ...node.data,
      title: isDeprecated ? `Deprecated: ${resolvedTitle}` : resolvedTitle,
      subtitle: node.data?.subtitle ?? definition?.subtitle ?? (isDeprecated ? "Legacy node type" : undefined),
      icon: node.data?.icon ?? definition?.iconName ?? "Box",
      config: {
        ...(node.data?.config ?? {}),
        ...(isDeprecated ? { __deprecated: true } : {}),
      },
    },
  };
}

function findTerminalNode(nodes: WorkflowNode[], connections: Connection[]) {
  if (nodes.length === 0) return null;
  const sourceIds = new Set(connections.filter((connection) => !connection.isPlaceholder).map((connection) => connection.sourceNodeId));
  const terminals = nodes.filter((node) => !sourceIds.has(node.id));
  return [...(terminals.length ? terminals : nodes)].sort((a, b) => a.position.y - b.position.y).at(-1) ?? nodes[0];
}

function findBranchTail(nodes: WorkflowNode[], connections: Connection[], sourceNodeId: string, branchType: BranchType) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const branchConnection = connections.find(
    (connection) =>
      connection.sourceNodeId === sourceNodeId &&
      connection.sourceHandle === branchType &&
      Boolean(connection.targetNodeId) &&
      !connection.isPlaceholder,
  );

  if (!branchConnection?.targetNodeId) {
    return nodeById.get(sourceNodeId) ?? null;
  }

  let currentNodeId = branchConnection.targetNodeId;
  const visited = new Set<string>();

  while (currentNodeId && !visited.has(currentNodeId)) {
    visited.add(currentNodeId);
    const currentNode = nodeById.get(currentNodeId);
    if (!currentNode) return null;
    const nextConnection = connections.find(
      (connection) =>
        connection.sourceNodeId === currentNodeId &&
        connection.sourceHandle === "default" &&
        Boolean(connection.targetNodeId) &&
        !connection.isPlaceholder,
    );
    if (!nextConnection?.targetNodeId) return currentNode;
    currentNodeId = nextConnection.targetNodeId;
  }

  return currentNodeId ? (nodeById.get(currentNodeId) ?? null) : null;
}

function branchPathNodeIds(connections: Connection[], sourceNodeId: string, branchType: BranchType) {
  const ids = new Set<string>();
  const branchConnection = connections.find(
    (connection) =>
      connection.sourceNodeId === sourceNodeId &&
      connection.sourceHandle === branchType &&
      Boolean(connection.targetNodeId) &&
      !connection.isPlaceholder,
  );
  let currentNodeId = branchConnection?.targetNodeId ?? null;

  while (currentNodeId && !ids.has(currentNodeId)) {
    ids.add(currentNodeId);
    const nextConnection = connections.find(
      (connection) =>
        connection.sourceNodeId === currentNodeId &&
        connection.sourceHandle === "default" &&
        Boolean(connection.targetNodeId) &&
        !connection.isPlaceholder,
    );
    currentNodeId = nextConnection?.targetNodeId ?? null;
  }

  return ids;
}

function normalizeWorkflow(nodes: WorkflowNode[], connections: Connection[]) {
  const normalizedNodes = nodes.map(normalizeNode);
  const normalizedConnections = connections.map(normalizeConnection);
  return layoutWorkflow(enrichWorkflowNodes(normalizedNodes, normalizedConnections), normalizedConnections);
}

function applyCheckRouteBranchAutomation(nodes: WorkflowNode[], connections: Connection[]) {
  let nextNodes = nodes;
  let nextConnections = connections;

  nextNodes
    .filter((node) => node.type === WorkflowNodeType.CHECK_ROUTE)
    .forEach((checkRouteNode) => {
      const checkRouteId = checkRouteNode.id;
      const hasTrueBranch = nextConnections.some(
        (connection) => connection.sourceNodeId === checkRouteId && connection.sourceHandle === "true",
      );
      const falseBranchConnection = nextConnections.find(
        (connection) => connection.sourceNodeId === checkRouteId && connection.sourceHandle === "false",
      );
      const existingSelectRoute = nextNodes.find((candidate) => candidate.type === WorkflowNodeType.SELECT_ROUTE);
      const selectRoute = existingSelectRoute ?? createNodeFromPalette(paletteItemFromType(WorkflowNodeType.SELECT_ROUTE));
      const hasFalseTarget = Boolean(falseBranchConnection?.targetNodeId);

      if (!existingSelectRoute && !hasFalseTarget) {
        nextNodes = [...nextNodes, selectRoute];
      }

      nextConnections = dedupeConnections(
        nextConnections
          .filter((connection) => connection.id !== falseBranchConnection?.id || hasFalseTarget)
          .concat(
            hasTrueBranch ? [] : [createPlaceholderConnection(checkRouteId, "true")],
            hasFalseTarget ? [] : [createConnection(checkRouteId, selectRoute.id, "false")],
          ),
      );
    });

  return { nodes: nextNodes, connections: nextConnections };
}

function enrichWorkflowNodes(nodes: WorkflowNode[], connections: Connection[]) {
  const childrenByParent = new Map<string, string[]>();
  const nextBySource = new Map<string, string | null>();
  const parentByChild = new Map<string, string>();
  const branchByChild = new Map<string, BranchType | null>();

  connections.forEach((connection) => {
    if (!connection.targetNodeId) return;
    const list = childrenByParent.get(connection.sourceNodeId) ?? [];
    list.push(connection.targetNodeId);
    childrenByParent.set(connection.sourceNodeId, list);
    nextBySource.set(connection.sourceNodeId, connection.targetNodeId);
    parentByChild.set(connection.targetNodeId, connection.sourceNodeId);
    branchByChild.set(connection.targetNodeId, getConnectionBranchType(connection));
  });

  return nodes.map((node) => ({
    ...node,
    parentId: parentByChild.get(node.id) ?? null,
    children: childrenByParent.get(node.id) ?? [],
    branchType: branchByChild.get(node.id) ?? null,
    nextNodeId: nextBySource.get(node.id) ?? null,
    connections: connections.filter((connection) => connection.sourceNodeId === node.id),
  }));
}

function layoutWorkflow(nodes: WorkflowNode[], connections: Connection[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incomingIds = new Set(
    connections
      .map((connection) => connection.targetNodeId)
      .filter((targetNodeId): targetNodeId is string => Boolean(targetNodeId)),
  );
  const outgoingBySource = new Map<string, Connection[]>();

  connections.forEach((connection) => {
    outgoingBySource.set(connection.sourceNodeId, [...(outgoingBySource.get(connection.sourceNodeId) ?? []), connection]);
  });

  const positioned = new Map<string, WorkflowNode>();
  const placedSlots = new Set<string>();

  const reserve = (x: number, y: number) => {
    let nextX = x;
    const slotY = Math.round(y / 20);
    while (placedSlots.has(`${Math.round(nextX / 20)}:${slotY}`)) {
      nextX += BRANCH_HORIZONTAL_GAP;
    }
    placedSlots.add(`${Math.round(nextX / 20)}:${slotY}`);
    return nextX;
  };

  const placeChain = (nodeId: string, x: number, y: number, visited = new Set<string>()) => {
    const node = byId.get(nodeId);
    if (!node || visited.has(nodeId) || positioned.has(nodeId)) return;

    const resolvedX = reserve(x, y);
    positioned.set(nodeId, { ...node, position: { x: resolvedX, y } });
    visited.add(nodeId);

    const outgoing = outgoingBySource.get(nodeId) ?? [];
    const trueConnection = outgoing.find((connection) => getConnectionBranchType(connection) === "true");
    const falseConnection = outgoing.find((connection) => getConnectionBranchType(connection) === "false");
    const normalConnections = outgoing.filter((connection) => !getConnectionBranchType(connection));

    if (node.kind === "condition") {
      if (trueConnection) {
        if (trueConnection.targetNodeId) {
          placeChain(trueConnection.targetNodeId, resolvedX - CONDITION_BRANCH_OFFSET, y + NODE_HEIGHT + BRANCH_VERTICAL_GAP, new Set(visited));
        }
      }
      if (falseConnection) {
        if (falseConnection.targetNodeId) {
          placeChain(falseConnection.targetNodeId, resolvedX + CONDITION_BRANCH_OFFSET, y + NODE_HEIGHT + BRANCH_VERTICAL_GAP, new Set(visited));
        }
      }
      if (normalConnections[0]) {
        if (normalConnections[0].targetNodeId) {
          placeChain(normalConnections[0].targetNodeId, resolvedX, y + NODE_HEIGHT + NODE_VERTICAL_GAP, new Set(visited));
        }
      }
      return;
    }

    normalConnections.forEach((connection, index) => {
      if (!connection.targetNodeId) return;
      placeChain(
        connection.targetNodeId,
        resolvedX + index * BRANCH_HORIZONTAL_GAP,
        y + NODE_HEIGHT + NODE_VERTICAL_GAP,
        new Set(visited),
      );
    });
  };

  const roots = nodes.filter((node) => !incomingIds.has(node.id));
  const orderedRoots = roots.length ? roots : nodes;
  orderedRoots.forEach((root, index) => {
    placeChain(root.id, CANVAS_ROOT_X + index * BRANCH_HORIZONTAL_GAP, CANVAS_ROOT_Y);
  });

  return nodes.map((node) => positioned.get(node.id) ?? node);
}

function applyNodeInsertion(nodes: WorkflowNode[], connections: Connection[], node: WorkflowNode, target?: DropTarget) {
  if (node.type === WorkflowNodeType.IF_LOGIN) {
    const launchSourceNode =
      target?.kind === "node"
        ? nodes.find((candidate) => candidate.id === target.nodeId && candidate.type === WorkflowNodeType.LAUNCH_APP)
        : target?.kind === "connection"
          ? nodes.find((candidate) => candidate.id === connections.find((connection) => connection.id === target.connectionId)?.sourceNodeId)
          : findTerminalNode(nodes, connections);

    const canAutoExpandIfLogin =
      launchSourceNode?.type === WorkflowNodeType.LAUNCH_APP &&
      (!target || target.kind === "canvas" || target.kind === "node" || target.kind === "connection");

    if (canAutoExpandIfLogin) {
      const authLogin = createNodeFromPalette(paletteItemFromType(WorkflowNodeType.AUTH_LOGIN));
      const nextNodes = [...nodes, node, authLogin];
      const existingDefaultConnection = connections.find(
        (connection) =>
          connection.sourceNodeId === launchSourceNode.id &&
          connection.sourceHandle === "default" &&
          !connection.isPlaceholder,
      );
      const nextConnections = dedupeConnections(
        connections
          .filter((connection) => connection.id !== existingDefaultConnection?.id)
          .concat(
            createConnection(launchSourceNode.id, node.id, "default"),
            createPlaceholderConnection(node.id, "true"),
            createConnection(node.id, authLogin.id, "false"),
          ),
      );
      return {
        nodes: normalizeWorkflow(nextNodes, nextConnections),
        connections: nextConnections,
        selectedNodeId: node.id,
      };
    }
  }

  const joinableExisting = JOINABLE_NODE_TYPES.has(node.type)
    ? nodes.find((candidate) => candidate.type === node.type)
    : null;
  const workingNode = joinableExisting ?? node;
  const nextNodes = joinableExisting ? nodes : [...nodes, workingNode];

  if (nextNodes.length === 1) {
    return { nodes: normalizeWorkflow(nextNodes, connections), connections: dedupeConnections(connections) };
  }

  if (target?.kind === "connection") {
    const existing = connections.find((connection) => connection.id === target.connectionId);
    if (!existing || !existing.targetNodeId) {
      return { nodes: normalizeWorkflow(nextNodes, connections), connections: dedupeConnections(connections) };
    }
    if (existing.sourceNodeId === workingNode.id || existing.targetNodeId === workingNode.id) {
      return { nodes: normalizeWorkflow(nextNodes, connections), connections: dedupeConnections(connections) };
    }
    const nextConnections = dedupeConnections(
      connections
      .filter((connection) => connection.id !== existing.id)
      .concat(
        createConnection(existing.sourceNodeId, workingNode.id, existing.sourceHandle),
        createConnection(workingNode.id, existing.targetNodeId, "default"),
      ),
    );
    return ensureCheckRouteBranchAutomation(nextNodes, nextConnections, workingNode);
  }

  if (target?.kind === "node") {
    const sourceNode = nodes.find((candidate) => candidate.id === target.nodeId);
    if (!sourceNode || sourceNode.id === workingNode.id) {
      return { nodes: normalizeWorkflow(nextNodes, connections), connections: dedupeConnections(connections) };
    }

    const existingChild = dedupeConnections(connections).find(
      (connection) =>
        connection.sourceNodeId === sourceNode.id &&
        connection.sourceHandle === "default" &&
        !connection.isPlaceholder,
    );
    const nextConnections = dedupeConnections(
      existingChild?.targetNodeId
      ? connections
          .filter((connection) => connection.id !== existingChild.id)
          .concat(
            createConnection(sourceNode.id, workingNode.id, "default"),
            createConnection(workingNode.id, existingChild.targetNodeId, "default"),
          )
      : connections.concat(createConnection(sourceNode.id, workingNode.id, "default")),
    );

    return ensureCheckRouteBranchAutomation(nextNodes, nextConnections, workingNode);
  }

  if (target?.kind === "branch") {
    const existingBranchConnection = connections.find(
      (connection) => connection.sourceNodeId === target.nodeId && connection.sourceHandle === target.branchType,
    );
    const branchTail = findBranchTail(nodes, connections, target.nodeId, target.branchType);
    const sourceNode = branchTail ?? nodes.find((candidate) => candidate.id === target.nodeId);
    const sourceHandle = sourceNode?.id === target.nodeId ? target.branchType : "default";
    const branchPath = branchPathNodeIds(connections, target.nodeId, target.branchType);

    if (!sourceNode || sourceNode.id === workingNode.id || branchPath.has(workingNode.id)) {
      return { nodes: normalizeWorkflow(nextNodes, connections), connections: dedupeConnections(connections) };
    }

    const nextConnections = dedupeConnections(
      connections
        .filter((connection) => connection.id !== existingBranchConnection?.id || Boolean(existingBranchConnection?.targetNodeId))
        .concat(createConnection(sourceNode.id, workingNode.id, sourceHandle)),
    );

    return ensureCheckRouteBranchAutomation(nextNodes, nextConnections, workingNode);
  }

  if (joinableExisting) {
    return ensureCheckRouteBranchAutomation(nextNodes, dedupeConnections(connections), workingNode);
  }

  const terminal = findTerminalNode(nodes, connections);
  if (!terminal) return { nodes: normalizeWorkflow(nextNodes, connections), connections: dedupeConnections(connections) };
  const nextConnections = dedupeConnections(connections.concat(createConnection(terminal.id, workingNode.id, "default")));
  return ensureCheckRouteBranchAutomation(nextNodes, nextConnections, workingNode);
}

function ensureCheckRouteBranchAutomation(nodes: WorkflowNode[], connections: Connection[], checkRouteNode: WorkflowNode) {
  if (checkRouteNode.type !== WorkflowNodeType.CHECK_ROUTE) {
    return { nodes: normalizeWorkflow(nodes, connections), connections };
  }

  const automated = applyCheckRouteBranchAutomation(nodes, connections);

  return { nodes: normalizeWorkflow(automated.nodes, automated.connections), connections: automated.connections };
}

function dedupeConnections(connections: Connection[]) {
  const seen = new Set<string>();
  return connections.filter((connection) => {
    const key = `${connection.sourceNodeId}->${connection.targetNodeId ?? "placeholder"}:${connection.sourceHandle}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectOutgoingReachable(rootId: string, connections: Connection[]): Set<string> {
  const reachable = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const c of connections) {
      if (c.sourceNodeId !== id) continue;
      const tid = c.targetNodeId;
      if (!tid || reachable.has(tid)) continue;
      reachable.add(tid);
      queue.push(tid);
    }
  }
  return reachable;
}

function pruneJoinNodesForDeletion(rootId: string, reachable: Set<string>, connections: Connection[]): Set<string> {
  const D = new Set(reachable);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of [...D]) {
      if (n === rootId) continue;
      const incoming = connections.filter((c) => c.targetNodeId === n);
      const keepsExternalParent = incoming.some((c) => c.sourceNodeId && !D.has(c.sourceNodeId));
      if (keepsExternalParent) {
        D.delete(n);
        changed = true;
      }
    }
  }
  return D;
}

export type NodeDeletionImpact = {
  nodeIds: Set<string>;
  nodeCount: number;
  connectionCount: number;
  clearsEntireWorkflow: boolean;
  isBranchDelete: boolean;
  rootLabel: string;
};

export function computeNodeDeletionImpact(
  rootId: string,
  nodes: WorkflowNode[],
  connections: Connection[],
): NodeDeletionImpact | null {
  const rootNode = nodes.find((n) => n.id === rootId);
  if (!rootNode) return null;

  if (rootNode.type === WorkflowNodeType.LAUNCH_APP) {
    return {
      nodeIds: new Set(nodes.map((n) => n.id)),
      nodeCount: nodes.length,
      connectionCount: connections.length,
      clearsEntireWorkflow: true,
      isBranchDelete: nodes.length > 1,
      rootLabel: rootNode.data.title ?? "Launch App",
    };
  }

  const reachable = collectOutgoingReachable(rootId, connections);
  const nodeIds = pruneJoinNodesForDeletion(rootId, reachable, connections);
  const connectionCount = connections.filter(
    (c) => nodeIds.has(c.sourceNodeId) || (c.targetNodeId && nodeIds.has(c.targetNodeId)),
  ).length;

  return {
    nodeIds,
    nodeCount: nodeIds.size,
    connectionCount,
    clearsEntireWorkflow: false,
    isBranchDelete: nodeIds.size > 1,
    rootLabel: rootNode.data.title ?? "Node",
  };
}

function buildRequiredFlowSkeleton() {
  const template = createTemplateFromRegistry("login-flow", { x: CANVAS_ROOT_X + 320, y: CANVAS_ROOT_Y + 360 });
  return template ?? { nodes: [], connections: [], selectedNodeId: null };
}

const emptySnapshot: WorkflowSnapshot = {
  version: STORAGE_VERSION,
  nodes: [],
  connections: [],
  selectedNodeId: null,
  zoom: VIEWPORT_ZOOM_DEFAULT,
  pan: { x: 0, y: 0 },
};

const useWorkflowStore = create<WorkflowState>((set) => ({
  nodes: [],
  connections: [],
  selectedNodeId: null,
  zoom: VIEWPORT_ZOOM_DEFAULT,
  pan: { x: 0, y: 0 },
  reset: () => set({ ...emptySnapshot }),
  importSnapshot: (snapshot) =>
    set(() => {
      const importedNodes = (snapshot.nodes ?? []).map(normalizeNode);
      const nodeIds = new Set(importedNodes.map((node) => node.id));
      const importedConnections = dedupeConnections(
        (snapshot.connections ?? [])
          .map(normalizeConnection)
          .filter((connection) => nodeIds.has(connection.sourceNodeId) && (!connection.targetNodeId || nodeIds.has(connection.targetNodeId))),
      );
      const automated = applyCheckRouteBranchAutomation(importedNodes, importedConnections);
      return {
        nodes: normalizeWorkflow(automated.nodes, automated.connections),
        connections: automated.connections,
        selectedNodeId: snapshot.selectedNodeId ?? null,
        zoom: snapshot.zoom ?? VIEWPORT_ZOOM_DEFAULT,
        pan: snapshot.pan ?? { x: 0, y: 0 },
      };
    }),
  addNode: (paletteItem, target) =>
    set((state) => {
      const nextNode = createNodeFromPalette(paletteItem);
      const insertion = applyNodeInsertion(state.nodes, state.connections, nextNode, target);
      let { nodes, connections } = insertion;
      const selectedNodeId =
        insertion.selectedNodeId ??
        nodes.find((candidate) => candidate.type === nextNode.type && (nextNode.type === WorkflowNodeType.CHECK_ROUTE || nextNode.type === WorkflowNodeType.VALIDATE_STOPLIST))
          ?.id ?? nextNode.id;

      if (nextNode.type === WorkflowNodeType.DELIVERY_OPERATION) {
        const waitPaletteItem = { ...paletteItemFromType(WorkflowNodeType.WAIT), defaultConfig: { timeout: "120000" } };
        const waitNode = createNodeFromPalette(waitPaletteItem);
        const waitInsertion = applyNodeInsertion(nodes, connections, waitNode, {
          kind: "node",
          nodeId: nextNode.id,
        });
        nodes = waitInsertion.nodes;
        connections = waitInsertion.connections;
      }

      return { nodes, connections, selectedNodeId };
    }),
  addRequiredFlowSkeleton: () => {
    const skeleton = buildRequiredFlowSkeleton();
    set({ nodes: skeleton.nodes, connections: skeleton.connections, selectedNodeId: skeleton.selectedNodeId });
  },
  replaceWithTemplate: (templateId, viewportCenter) => {
    const templateState = createTemplateFromRegistry(templateId, viewportCenter);
    if (!templateState) return;
    set({
      nodes: templateState.nodes,
      connections: templateState.connections,
      selectedNodeId: templateState.selectedNodeId,
    });
  },
  duplicateNode: (nodeId) =>
    set((state) => {
      const sourceNode = state.nodes.find((node) => node.id === nodeId);
      if (!sourceNode) return {};
      const duplicatedNode = cloneNodeForDuplicate(sourceNode);

      return {
        nodes: normalizeWorkflow([...state.nodes, duplicatedNode], state.connections),
        selectedNodeId: duplicatedNode.id,
      };
    }),
  deleteConnection: (connectionId) =>
    set((state) => {
      const connections = state.connections.filter((connection) => connection.id !== connectionId);
      return { connections, nodes: normalizeWorkflow(state.nodes, connections) };
    }),
  deleteNode: (nodeId) =>
    set((state) => {
      const impact = computeNodeDeletionImpact(nodeId, state.nodes, state.connections);
      if (!impact || impact.nodeCount === 0) return {};

      if (impact.clearsEntireWorkflow) {
        return {
          nodes: [],
          connections: [],
          selectedNodeId: null,
          zoom: VIEWPORT_ZOOM_DEFAULT,
          pan: { x: 0, y: 0 },
        };
      }

      const nodesToDelete = impact.nodeIds;
      const nextNodes = state.nodes.filter((node) => !nodesToDelete.has(node.id));
      const nextConnections = dedupeConnections(
        state.connections.filter(
          (c) =>
            !nodesToDelete.has(c.sourceNodeId) && !(c.targetNodeId && nodesToDelete.has(c.targetNodeId)),
        ),
      );

      const selectedId = state.selectedNodeId;
      const selectedDeleted = selectedId ? nodesToDelete.has(selectedId) : false;

      return {
        nodes: normalizeWorkflow(nextNodes, nextConnections),
        connections: nextConnections,
        selectedNodeId: selectedDeleted ? null : selectedId,
      };
    }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  updateNodeConfig: (nodeId, patch) =>
    set((state) => {
      let nodes = state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, config: { ...(node.data.config ?? {}), ...patch } } }
          : node,
      );

      if (patch.waitBeforeDelivery !== undefined) {
        const sourceNode = nodes.find((n) => n.id === nodeId);
        if (sourceNode?.type === WorkflowNodeType.DELIVERY_OPERATION) {
          const outConn = state.connections.find((c) => c.sourceNodeId === nodeId);
          if (outConn?.targetNodeId) {
            const waitNode = nodes.find((n) => n.id === outConn.targetNodeId && n.type === WorkflowNodeType.WAIT);
            if (waitNode) {
              const newTimeout = String(patch.waitBeforeDelivery);
              nodes = nodes.map((n) =>
                n.id === waitNode.id
                  ? { ...n, data: { ...n.data, config: { ...(n.data.config ?? {}), timeout: newTimeout } } }
                  : n,
              );
            }
          }
        }
      }

      return { nodes };
    }),
}));

type ViewportState = { x: number; y: number; scale: number };

function useViewportController(
  containerRef: React.RefObject<HTMLElement | null>,
  canvasTool: CanvasPointerTool,
) {
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    scale: VIEWPORT_ZOOM_DEFAULT,
  });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);

  const vpRef = useRef(viewport);
  vpRef.current = viewport;

  const panRef = useRef({
    active: false,
    startClientX: 0,
    startClientY: 0,
    startVpX: 0,
    startVpY: 0,
  });

  const viewportSizeRef = useRef({ width: 0, height: 0 });

  const spaceRef = useRef(false);
  spaceRef.current = isSpacePressed;
  const toolRef = useRef(canvasTool);
  toolRef.current = canvasTool;
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashZoomIndicator = useCallback(() => {
    setShowZoomIndicator(true);
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(
      () => setShowZoomIndicator(false),
      VIEWPORT_ZOOM_INDICATOR_HIDE_MS,
    );
  }, []);

  const zoomAtViewportPoint = useCallback(
    (pointX: number, pointY: number, factor: number) => {
      setViewport((prev) => {
        const nextScale = clampScale(prev.scale * factor);
        const worldPoint = {
          x: (pointX - prev.x) / prev.scale,
          y: (pointY - prev.y) / prev.scale,
        };

        return {
          x: pointX - worldPoint.x * nextScale,
          y: pointY - worldPoint.y * nextScale,
          scale: nextScale,
        };
      });
      flashZoomIndicator();
    },
    [flashZoomIndicator],
  );

  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      zoomAtViewportPoint(clientX - rect.left, clientY - rect.top, factor);
    },
    [containerRef, zoomAtViewportPoint],
  );

  const zoomAtCenter = useCallback(
    (factor: number) => {
      const el = containerRef.current;
      if (!el) return;
      zoomAtViewportPoint(el.clientWidth / 2, el.clientHeight / 2, factor);
    },
    [containerRef, zoomAtViewportPoint],
  );

  const zoomIn = useCallback(() => zoomAtCenter(VIEWPORT_ZOOM_BUTTON_FACTOR), [zoomAtCenter]);
  const zoomOut = useCallback(() => zoomAtCenter(1 / VIEWPORT_ZOOM_BUTTON_FACTOR), [zoomAtCenter]);

  const resetZoom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const center = { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    setViewport({
      x: center.x - (VIEWPORT_CONTENT_APPROX_WIDTH * VIEWPORT_ZOOM_DEFAULT) / 2,
      y: center.y - (VIEWPORT_CONTENT_APPROX_HEIGHT * VIEWPORT_ZOOM_DEFAULT) / 2,
      scale: VIEWPORT_ZOOM_DEFAULT,
    });
    flashZoomIndicator();
  }, [containerRef, flashZoomIndicator]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        const sensitivity =
          Math.abs(e.deltaY) < 10
            ? VIEWPORT_ZOOM_TRACKPAD_SENSITIVITY
            : VIEWPORT_ZOOM_WHEEL_SENSITIVITY;
        zoomAtPoint(e.clientX, e.clientY, Math.exp(-e.deltaY * sensitivity));
      } else if (e.shiftKey) {
        setViewport((prev) => ({
          ...prev,
          x: prev.x - (e.deltaY || e.deltaX) * VIEWPORT_SCROLL_SENSITIVITY,
        }));
      } else {
        setViewport((prev) => ({
          ...prev,
          x: prev.x - e.deltaX * VIEWPORT_SCROLL_SENSITIVITY,
          y: prev.y - e.deltaY * VIEWPORT_SCROLL_SENSITIVITY,
        }));
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [containerRef, zoomAtPoint]);

  const startPan = useCallback((clientX: number, clientY: number) => {
    panRef.current = {
      active: true,
      startClientX: clientX,
      startClientY: clientY,
      startVpX: vpRef.current.x,
      startVpY: vpRef.current.y,
    };
    setIsPanning(true);
  }, []);

  const stopPan = useCallback(() => {
    if (!panRef.current.active) return;
    panRef.current.active = false;
    setIsPanning(false);
  }, []);

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (e.button === 1) {
        e.preventDefault();
        startPan(e.clientX, e.clientY);
        return;
      }
      if (e.button === 0 && (spaceRef.current || toolRef.current === "hand")) {
        e.preventDefault();
        startPan(e.clientX, e.clientY);
      }
    },
    [startPan],
  );

  const handleMouseMove = useCallback((e: MouseEvent<HTMLElement>) => {
    if (!panRef.current.active) return;
    const dx = e.clientX - panRef.current.startClientX;
    const dy = e.clientY - panRef.current.startClientY;
    setViewport((prev) => ({
      ...prev,
      x: panRef.current.startVpX + dx,
      y: panRef.current.startVpY + dy,
    }));
  }, []);

  const handleMouseUp = useCallback(() => stopPan(), [stopPan]);
  const handleMouseLeave = useCallback(() => stopPan(), [stopPan]);

  const handleDoubleClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("button, input, select, textarea, a")) return;
      resetZoom();
    },
    [resetZoom],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.code === "Space" && !e.repeat && !isInput) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomAtCenter(VIEWPORT_ZOOM_BUTTON_FACTOR);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        zoomAtCenter(1 / VIEWPORT_ZOOM_BUTTON_FACTOR);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
        stopPan();
      }
    };

    const handleBlur = () => {
      setIsSpacePressed(false);
      stopPan();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [zoomAtCenter, resetZoom, stopPan]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const centerInitialViewport = () => {
      const size = { width: el.clientWidth, height: el.clientHeight };
      viewportSizeRef.current = size;
      setViewport({
        x: size.width / 2 - (VIEWPORT_CONTENT_APPROX_WIDTH * VIEWPORT_ZOOM_DEFAULT) / 2,
        y: size.height / 2 - (VIEWPORT_CONTENT_APPROX_HEIGHT * VIEWPORT_ZOOM_DEFAULT) / 2,
        scale: VIEWPORT_ZOOM_DEFAULT,
      });
    };

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const size = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
      const prevSize = viewportSizeRef.current;

      if (!prevSize.width || !prevSize.height) {
        viewportSizeRef.current = size;
        return;
      }

      setViewport((prev) => {
        const prevCenter = { x: prevSize.width / 2, y: prevSize.height / 2 };
        const nextCenter = { x: size.width / 2, y: size.height / 2 };
        const centerWorldPoint = {
          x: (prevCenter.x - prev.x) / prev.scale,
          y: (prevCenter.y - prev.y) / prev.scale,
        };

        return {
          ...prev,
          x: nextCenter.x - centerWorldPoint.x * prev.scale,
          y: nextCenter.y - centerWorldPoint.y * prev.scale,
        };
      });

      viewportSizeRef.current = size;
    });

    requestAnimationFrame(centerInitialViewport);
    resizeObserver.observe(el);

    return () => resizeObserver.disconnect();
  }, [containerRef]);

  useEffect(() => {
    return () => {
      if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    };
  }, []);

  const cursorClass = isPanning
    ? "cursor-grabbing"
    : isSpacePressed || canvasTool === "hand"
      ? "cursor-grab"
      : "cursor-default";

  return {
    viewport,
    isPanning,
    isSpacePressed,
    showZoomIndicator,
    cursorClass,
    zoomIn,
    zoomOut,
    resetZoom,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      onDoubleClick: handleDoubleClick,
    },
  };
}

export function WorkflowEditorPage({ workflowId }: { workflowId: string }) {
  const fallbackTitle = useMemo(() => titleFromId(workflowId), [workflowId]);
  const nodes = useWorkflowStore((state) => state.nodes);
  const connections = useWorkflowStore((state) => state.connections);
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const addNode = useWorkflowStore((state) => state.addNode);
  const addRequiredFlowSkeleton = useWorkflowStore((state) => state.addRequiredFlowSkeleton);
  const replaceWithTemplate = useWorkflowStore((state) => state.replaceWithTemplate);
  const importSnapshot = useWorkflowStore((state) => state.importSnapshot);
  const resetWorkflow = useWorkflowStore((state) => state.reset);
  const duplicateNode = useWorkflowStore((state) => state.duplicateNode);
  const deleteConnection = useWorkflowStore((state) => state.deleteConnection);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const selectNode = useWorkflowStore((state) => state.selectNode);
  const updateNodeConfig = useWorkflowStore((state) => state.updateNodeConfig);

  const router = useRouter();

  const [propertiesPanelOpen, setPropertiesPanelOpen] = useState(false);
  const [canvasTool, setCanvasTool] = useState<CanvasPointerTool>("hand");
  const [workflowMeta, setWorkflowMeta] = useState<{ id: string; slug: string; name: string } | null>(null);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [isTitleSaving, setIsTitleSaving] = useState(false);
  const [titleDraft, setTitleDraft] = useState(fallbackTitle);
  const displayTitle = workflowMeta?.name ?? fallbackTitle;
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(true);
  const [isWorkflowReady, setIsWorkflowReady] = useState(false);
  const [serverSyncedFingerprint, setServerSyncedFingerprint] = useState<string | null>(null);
  const [publishedFingerprint, setPublishedFingerprint] = useState<string | null>(null);
  const [persistStatus, setPersistStatus] = useState<PersistStatus>("idle");
  const [unsavedCloseDialogOpen, setUnsavedCloseDialogOpen] = useState(false);
  const [isSavingAndClosing, setIsSavingAndClosing] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateDialogState, setTemplateDialogState] = useState<{
    open: boolean;
    templateId: string | null;
  }>({ open: false, templateId: null });
  const [activeDragItem, setActiveDragItem] = useState<PaletteItem | null>(null);
  const [ruleDialogState, setRuleDialogState] = useState<{
    open: boolean;
    result: RuleValidationResult | null;
    pendingItem: PaletteItem | null;
    pendingTarget?: DropTarget;
  }>({ open: false, result: null, pendingItem: null });
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [yamlPreviewOpen, setYamlPreviewOpen] = useState(false);
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [devices, setDevices] = useState<NesyMobileAdbDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<NesyMobileAdbDevice | null>(null);
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);
  const [deviceSearchQuery, setDeviceSearchQuery] = useState("");
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deviceSelectorAttention, setDeviceSelectorAttention] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [runVisualization, setRunVisualization] = useState<WorkflowRunVisualization | null>(null);
  const runPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedDeviceWasRunnableRef = useRef(false);
  const [nodeDeleteDialog, setNodeDeleteDialog] = useState<{ open: boolean; nodeId: string | null }>({
    open: false,
    nodeId: null,
  });
  const canvasContainerRef = useRef<HTMLElement | null>(null);
  const paletteSearchInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const loadedForWorkflowRef = useRef<string | null>(null);
  const currentVersionIdRef = useRef<string | null>(null);
  const autosaveAbortRef = useRef<AbortController | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = `nesy-workflow-editor:${workflowId}`;

  useEffect(() => {
    return () => {
      resetWorkflow();
    };
  }, [resetWorkflow]);

  const closeEditor = useCallback(() => {
    resetWorkflow();
    router.push("/automation/list");
  }, [resetWorkflow, router]);

  const handleResetWorkflow = useCallback(() => {
    resetWorkflow();
    setCanvasTool((tool) => (tool === "hand" ? "move" : tool));
  }, [resetWorkflow]);

  const currentWorkflowFingerprint = useMemo(
    () => workflowContentFingerprint(nodes, connections),
    [nodes, connections],
  );

  const hasUnsavedChanges = useMemo(
    () =>
      isWorkflowReady &&
      serverSyncedFingerprint !== null &&
      currentWorkflowFingerprint !== serverSyncedFingerprint,
    [currentWorkflowFingerprint, isWorkflowReady, serverSyncedFingerprint],
  );

  const isPublishButtonPublished = useMemo(
    () =>
      isWorkflowReady &&
      publishedFingerprint !== null &&
      currentWorkflowFingerprint === publishedFingerprint,
    [currentWorkflowFingerprint, isWorkflowReady, publishedFingerprint],
  );

  const hasUnpublishedChanges = useMemo(
    () => isWorkflowReady && !isPublishButtonPublished,
    [isPublishButtonPublished, isWorkflowReady],
  );

  const editorLocked = isTestRunning || isPublishing;

  const requestCloseEditor = useCallback(() => {
    if (editorLocked) return;
    if (hasUnsavedChanges) {
      setUnsavedCloseDialogOpen(true);
      return;
    }
    closeEditor();
  }, [closeEditor, editorLocked, hasUnsavedChanges]);

  const discardAndCloseEditor = useCallback(() => {
    setUnsavedCloseDialogOpen(false);
    closeEditor();
  }, [closeEditor]);

  useEffect(() => {
    if (!hasUnsavedChanges && unsavedCloseDialogOpen) {
      setUnsavedCloseDialogOpen(false);
    }
  }, [hasUnsavedChanges, unsavedCloseDialogOpen]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const validationErrors = useMemo(() => validateWorkflowState({ nodes, connections }), [nodes, connections]);
  const hasValidationErrors = validationErrors.length > 0;
  const invalidNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const err of validationErrors) {
      if (err.code === "INVALID_POST_VALIDATE_NODE" && err.nodeId) set.add(err.nodeId);
    }
    return set;
  }, [validationErrors]);
  const filteredDevices = useMemo(() => {
    const query = deviceSearchQuery.trim().toLowerCase();
    if (!query) return devices;

    return devices.filter((device) => {
      const haystack = [
        getDeviceTitle(device),
        getDeviceModelLabel(device),
        device.id,
        device.appDeviceId,
        device.androidVersion ? `Android ${device.androidVersion}` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [deviceSearchQuery, devices]);

  const nodeDeleteImpact = useMemo(() => {
    if (!nodeDeleteDialog.nodeId) return null;
    return computeNodeDeletionImpact(nodeDeleteDialog.nodeId, nodes, connections);
  }, [nodeDeleteDialog.nodeId, nodes, connections]);

  const requestNodeDelete = useCallback(
    (nodeId: string) => {
      if (editorLocked) return;
      setNodeDeleteDialog({ open: true, nodeId });
    },
    [editorLocked],
  );

  const refreshDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const response = await listNesyMobileAdbDevices();
      const nextDevices = response.devices;
      setDevices(nextDevices);

      setSelectedDevice((current) => {
        const storedId =
          typeof window !== "undefined"
            ? window.localStorage.getItem(WORKFLOW_SELECTED_DEVICE_STORAGE_KEY)
            : null;
        const currentMatch = current ? nextDevices.find((device) => device.id === current.id) : null;
        const storedMatch = storedId ? nextDevices.find((device) => device.id === storedId) : null;
        const firstRunnable = nextDevices.find(isDeviceRunnable) ?? null;
        return currentMatch ?? storedMatch ?? firstRunnable;
      });
    } catch (error) {
      setDevices([]);
      setSelectedDevice(null);
      toast.error(error instanceof Error ? error.message : "ADB devices could not be listed.");
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasValidationErrors) setShowValidationWarning(false);
  }, [hasValidationErrors]);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshDevices();
    }, DEVICE_REFRESH_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshDevices();
    };
    window.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshDevices]);

  useEffect(() => {
    const isRunnableNow = selectedDevice ? isDeviceRunnable(selectedDevice) : false;
    const wasRunnable = selectedDeviceWasRunnableRef.current;

    if (wasRunnable && !isRunnableNow && selectedDevice) {
      toast.warning(`${getDeviceTitle(selectedDevice)} disconnected.`);
      setDeviceSelectorAttention(true);
    }

    selectedDeviceWasRunnableRef.current = isRunnableNow;
  }, [selectedDevice]);

  useEffect(() => {
    if (!isTitleEditing) {
      setTitleDraft(displayTitle);
    }
  }, [displayTitle, isTitleEditing]);

  const commitTitleEdit = useCallback(async () => {
    const trimmed = titleDraft.trim();
    setIsTitleEditing(false);

    if (!trimmed || trimmed === displayTitle || editorLocked) {
      setTitleDraft(displayTitle);
      return;
    }

    setIsTitleSaving(true);
    try {
      const { updateWorkflow, createWorkflow } = await import("@/services/automation-api");
      let updated;
      try {
        updated = await updateWorkflow(workflowId, { name: trimmed });
      } catch {
        updated = await createWorkflow({ name: trimmed, description: `Workflow: ${trimmed}` });
      }

      if (updated.slug !== workflowId) {
        try {
          const raw = window.localStorage.getItem(storageKey);
          if (raw) {
            window.localStorage.setItem(`nesy-workflow-editor:${updated.slug}`, raw);
            window.localStorage.removeItem(storageKey);
          }
        } catch {
          // ignore storage migration errors
        }
        router.replace(`/automation/${updated.slug}`);
        return;
      }

      setWorkflowMeta({ id: updated.id, slug: updated.slug, name: updated.name });
      setTitleDraft(updated.name);
      toast.success("Workflow name updated.");
    } catch {
      setTitleDraft(displayTitle);
      toast.error("Failed to update workflow name.");
    } finally {
      setIsTitleSaving(false);
    }
  }, [displayTitle, editorLocked, router, storageKey, titleDraft, workflowId]);

  useEffect(() => {
    if (!activeRunId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const { fetchRunStatus } = await import("@/services/automation-api");
        const status = await fetchRunStatus(activeRunId);
        if (cancelled) return;

        const lane = layoutBackendValidationLane(nodes);
        setRunVisualization(
          buildWorkflowRunVisualization(status, [...connections, ...lane.connections]),
        );

        if (status.runStatus !== "running" && status.runStatus !== "pending") {
          if (runPollingRef.current) {
            clearInterval(runPollingRef.current);
            runPollingRef.current = null;
          }
          setIsTestRunning(false);
        }
      } catch {
        // keep polling on transient errors
      }
    };

    void poll();
    runPollingRef.current = setInterval(() => {
      void poll();
    }, 500);

    return () => {
      cancelled = true;
      if (runPollingRef.current) {
        clearInterval(runPollingRef.current);
        runPollingRef.current = null;
      }
    };
  }, [activeRunId, connections, nodes]);

  useEffect(() => {
    let cancelled = false;
    loadedForWorkflowRef.current = null;
    autosaveAbortRef.current?.abort();
    autosaveAbortRef.current = null;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    setIsWorkflowLoading(true);
    setIsWorkflowReady(false);
    setServerSyncedFingerprint(null);
    setPublishedFingerprint(null);
    setPersistStatus("idle");
    currentVersionIdRef.current = null;
    resetWorkflow();

    const commitLoadedWorkflow = (
      snapshot: WorkflowSnapshot,
      options?: { persistStatus?: PersistStatus },
    ) => {
      if (cancelled) return;
      importSnapshot(snapshot);
      const { nodes: loadedNodes, connections: loadedConnections } = useWorkflowStore.getState();
      loadedForWorkflowRef.current = workflowId;
      setServerSyncedFingerprint(workflowContentFingerprint(loadedNodes, loadedConnections));
      setPersistStatus(options?.persistStatus ?? "idle");
      setIsWorkflowReady(true);
      setIsWorkflowLoading(false);
    };

    async function loadFromApi() {
      try {
        const { fetchWorkflow } = await import("@/services/automation-api");
        const workflow = await fetchWorkflow(workflowId);
        if (cancelled) return;
        setWorkflowMeta({ id: workflow.id, slug: workflow.slug, name: workflow.name });
        currentVersionIdRef.current = workflow.currentVersion?.id ?? null;

        if (workflow.draft && Array.isArray(workflow.draft.nodes) && workflow.draft.nodes.length > 0) {
          if (
            workflow.currentVersion &&
            Array.isArray(workflow.currentVersion.nodes) &&
            workflow.currentVersion.nodes.length > 0
          ) {
            setPublishedFingerprint(
              workflowContentFingerprint(
                workflow.currentVersion.nodes as WorkflowNode[],
                workflow.currentVersion.edges as Connection[],
              ),
            );
          }
          commitLoadedWorkflow(
            {
              version: STORAGE_VERSION,
              nodes: workflow.draft.nodes as WorkflowNode[],
              connections: (Array.isArray(workflow.draft.edges) ? workflow.draft.edges : []) as Connection[],
              selectedNodeId: null,
            } as WorkflowSnapshot,
            { persistStatus: "autosaved" },
          );
          return;
        }

        if (
          workflow.currentVersion &&
          Array.isArray(workflow.currentVersion.nodes) &&
          workflow.currentVersion.nodes.length > 0
        ) {
          const publishedFp = workflowContentFingerprint(
            workflow.currentVersion.nodes as WorkflowNode[],
            workflow.currentVersion.edges as Connection[],
          );
          setPublishedFingerprint(publishedFp);
          commitLoadedWorkflow(
            {
              version: STORAGE_VERSION,
              nodes: workflow.currentVersion.nodes as WorkflowNode[],
              connections: workflow.currentVersion.edges as Connection[],
              selectedNodeId: null,
            } as WorkflowSnapshot,
            { persistStatus: "saved_version" },
          );
          return;
        }
      } catch {
        // API unavailable, fall through to localStorage
      }

      if (cancelled) return;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        commitLoadedWorkflow(emptySnapshot);
        return;
      }
      try {
        commitLoadedWorkflow(JSON.parse(raw) as WorkflowSnapshot);
      } catch {
        commitLoadedWorkflow(emptySnapshot);
      }
    }

    loadFromApi();
    return () => {
      cancelled = true;
      autosaveAbortRef.current?.abort();
      autosaveAbortRef.current = null;
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [importSnapshot, resetWorkflow, storageKey, workflowId]);

  useEffect(() => {
    if (loadedForWorkflowRef.current !== workflowId) return;
    const snapshot: WorkflowSnapshot = {
      version: STORAGE_VERSION,
      nodes,
      connections,
      selectedNodeId,
      zoom: VIEWPORT_ZOOM_DEFAULT,
      pan: { x: 0, y: 0 },
    };
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [connections, nodes, selectedNodeId, storageKey, workflowId]);

  useEffect(() => {
    setPropertiesPanelOpen(Boolean(selectedNode));
  }, [selectedNode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tag = target?.tagName;
      const isInput =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(target?.isContentEditable);
      if (isInput) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "v") {
        event.preventDefault();
        setCanvasTool("move");
        return;
      }
      if (key === "h") {
        event.preventDefault();
        setCanvasTool("hand");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (isInput || !selectedNodeId) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        requestNodeDelete(selectedNodeId);
      }
      if (event.key === "Escape") {
        selectNode(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [requestNodeDelete, selectNode, selectedNodeId]);

  const {
    viewport,
    isPanning,
    isSpacePressed,
    showZoomIndicator,
    cursorClass,
    zoomIn,
    zoomOut,
    resetZoom,
    handlers: viewportHandlers,
  } = useViewportController(canvasContainerRef, canvasTool);

  // NOTE: The rest of the component (lines ~2004-4628 from the source) continues below.
  // Due to the massive size, the remaining JSX and helper components are included verbatim
  // with only the import-mapping changes applied (already done at the top of the file).
  // The key route changes: /workflow/ -> /automation/ are applied inline below.

  const searchTerm = paletteSearch.trim().toLowerCase();
  const filteredTemplates = useMemo(
    () =>
      workflowTemplates.filter(
        (template) =>
          template.name.toLowerCase().includes(searchTerm) ||
          template.subtitle.toLowerCase().includes(searchTerm) ||
          template.description.toLowerCase().includes(searchTerm),
      ),
    [searchTerm],
  );
  const filteredPaletteGroups = useMemo(
    () =>
      workflowComponentGroups
        .map((group) => {
          if (group.subsections) {
            return {
              ...group,
              subsections: group.subsections
                .map((sub) => ({
                  ...sub,
                  items: sub.items.filter((item) => item.title.toLowerCase().includes(searchTerm)),
                }))
                .filter((sub) => sub.items.length > 0),
            };
          }
          return {
            ...group,
            items: (group.items ?? []).filter((item) => item.title.toLowerCase().includes(searchTerm)),
          };
        })
        .filter((group) =>
          group.subsections ? group.subsections.length > 0 : (group.items?.length ?? 0) > 0,
        ),
    [searchTerm],
  );
  const hasPaletteResults = filteredTemplates.length > 0 || filteredPaletteGroups.length > 0;

  const getViewportCenterWorld = useCallback(() => {
    const el = canvasContainerRef.current;
    const screenCenter = el
      ? { x: el.clientWidth / 2, y: el.clientHeight / 2 }
      : { x: VIEWPORT_CONTENT_APPROX_WIDTH / 2, y: VIEWPORT_CONTENT_APPROX_HEIGHT / 2 };
    return {
      x: (screenCenter.x - viewport.x) / viewport.scale,
      y: (screenCenter.y - viewport.y) / viewport.scale,
    };
  }, [viewport.scale, viewport.x, viewport.y]);

  const applyTemplate = useCallback(
    (templateId: string) => {
      replaceWithTemplate(templateId, getViewportCenterWorld());
    },
    [getViewportCenterWorld, replaceWithTemplate],
  );

  const requestTemplateApply = useCallback(
    (templateId: string) => {
      if (editorLocked) return;
      if (nodes.length === 0) {
        applyTemplate(templateId);
        return;
      }
      setTemplateDialogState({ open: true, templateId });
    },
    [applyTemplate, editorLocked, nodes.length],
  );

  const handleDeviceSelect = useCallback((device: NesyMobileAdbDevice) => {
    setSelectedDevice(device);
    setIsDeviceDropdownOpen(false);
    setDeviceSelectorAttention(false);
    window.localStorage.setItem(WORKFLOW_SELECTED_DEVICE_STORAGE_KEY, device.id);
  }, []);

  const attemptAddNode = useCallback(
    (item: PaletteItem, target?: DropTarget) => {
      if (editorLocked) return;
      const validation = validateNodeDrop({ state: { nodes, connections }, paletteItem: item, target });
      if (!validation.valid) {
        setRuleDialogState({ open: true, result: validation, pendingItem: item, pendingTarget: target });
        return;
      }
      addNode(item, target);
    },
    [addNode, connections, editorLocked, nodes],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (isTestRunning) return;
    const item = event.active.data.current?.paletteItem as PaletteItem | undefined;
    setActiveDragItem(item ?? null);
  }, [editorLocked]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const item = event.active.data.current?.paletteItem as PaletteItem | undefined;
      const target = event.over?.data.current?.target as DropTarget | undefined;
      setActiveDragItem(null);
      if (!item || !target) return;
      attemptAddNode(item, target);
    },
    [attemptAddNode],
  );

  const requestConnectionDelete = useCallback(
    (connectionId: string) => {
      const connection = connections.find((candidate) => candidate.id === connectionId);
      if (!connection) return;
      if (connection.targetNodeId) {
        requestNodeDelete(connection.targetNodeId);
        return;
      }
      deleteConnection(connectionId);
    },
    [connections, deleteConnection, requestNodeDelete],
  );

  const flushAutosave = useCallback(async () => {
    if (loadedForWorkflowRef.current !== workflowId || !isWorkflowReady || editorLocked) {
      return;
    }

    const fingerprint = workflowContentFingerprint(nodes, connections);
    if (serverSyncedFingerprint !== null && fingerprint === serverSyncedFingerprint) {
      return;
    }

    autosaveAbortRef.current?.abort();
    const controller = new AbortController();
    autosaveAbortRef.current = controller;
    const targetWorkflowId = workflowId;

    setPersistStatus("saving");

    try {
      const { saveWorkflowDraft } = await import("@/services/automation-api");
      await saveWorkflowDraft(
        targetWorkflowId,
        {
          nodes,
          edges: connections,
          baseVersionId: currentVersionIdRef.current,
        },
        { signal: controller.signal },
      );

      if (controller.signal.aborted || loadedForWorkflowRef.current !== targetWorkflowId) {
        return;
      }

      const { nodes: latestNodes, connections: latestConnections } = useWorkflowStore.getState();
      const latestFingerprint = workflowContentFingerprint(latestNodes, latestConnections);
      if (latestFingerprint !== fingerprint) {
        setPersistStatus(
          serverSyncedFingerprint !== null && latestFingerprint === serverSyncedFingerprint
            ? "autosaved"
            : "idle",
        );
        return;
      }

      setServerSyncedFingerprint(fingerprint);
      setPersistStatus("autosaved");
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("Failed to autosave workflow draft:", err);
      setPersistStatus("save_failed");
    }
  }, [connections, editorLocked, isWorkflowReady, nodes, serverSyncedFingerprint, workflowId]);

  useEffect(() => {
    if (!isWorkflowReady || editorLocked || loadedForWorkflowRef.current !== workflowId) {
      return;
    }
    if (serverSyncedFingerprint !== null && currentWorkflowFingerprint === serverSyncedFingerprint) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void flushAutosave();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    currentWorkflowFingerprint,
    flushAutosave,
    editorLocked,
    isWorkflowReady,
    serverSyncedFingerprint,
    workflowId,
  ]);

  const saveWorkflowVersion = useCallback(async () => {
    if (loadedForWorkflowRef.current !== workflowId || isPublishing) {
      return;
    }

    setIsPublishing(true);
    autosaveAbortRef.current?.abort();
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const fingerprint = workflowContentFingerprint(nodes, connections);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ version: STORAGE_VERSION, nodes, connections, selectedNodeId }),
    );

    try {
      const { saveVersion, fetchWorkflow, createWorkflow } = await import("@/services/automation-api");

      try {
        await fetchWorkflow(workflowId);
      } catch {
        await createWorkflow({ name: displayTitle, description: `Workflow: ${displayTitle}` });
      }

      const version = await saveVersion(workflowId, { nodes, edges: connections });
      if (loadedForWorkflowRef.current !== workflowId) {
        return;
      }

      currentVersionIdRef.current = version.id;
      setServerSyncedFingerprint(fingerprint);
      setPublishedFingerprint(fingerprint);
      setPersistStatus("saved_version");
      toast.success("Workflow published.");
    } catch (err) {
      console.error("Failed to save workflow version:", err);
      setPersistStatus("save_failed");
      toast.error("Could not publish workflow. Changes are kept locally.");
    } finally {
      setIsPublishing(false);
    }
  }, [connections, displayTitle, isPublishing, nodes, selectedNodeId, storageKey, workflowId]);

  const handleSaveAndClose = useCallback(async () => {
    setIsSavingAndClosing(true);
    try {
      await saveWorkflowVersion();
      setUnsavedCloseDialogOpen(false);
      closeEditor();
    } finally {
      setIsSavingAndClosing(false);
    }
  }, [closeEditor, saveWorkflowVersion]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const stopWorkflowTest = useCallback(async () => {
    const runId = activeRunId;
    if (runPollingRef.current) {
      clearInterval(runPollingRef.current);
      runPollingRef.current = null;
    }

    if (runId) {
      try {
        const { cancelRun } = await import("@/services/automation-api");
        await cancelRun(workflowId, runId);
      } catch {
        toast.error("Could not cancel the workflow run on the server.");
      }
    }

    setActiveRunId(null);
    setRunVisualization(null);
    setIsTestRunning(false);
    selectNode(null);
    setPropertiesPanelOpen(false);
    toast.info("Workflow test stopped.");
  }, [activeRunId, selectNode, workflowId]);

  const runWorkflowTest = useCallback(async () => {
    if (editorLocked) return;

    if (!selectedDevice) {
      setDeviceSelectorAttention(true);
      setIsDeviceDropdownOpen(true);
      toast.warning("Please select a device before running the workflow.");
      return;
    }

    const errors = validateWorkflowState({ nodes, connections });
    if (errors.length > 0) {
      setShowValidationWarning(true);
      setPublishDialogOpen(true);
      const firstNodeError = errors.find((error) => error.nodeId)?.nodeId;
      if (firstNodeError) {
        selectNode(firstNodeError);
        setPropertiesPanelOpen(true);
      }
      return;
    }
    setShowValidationWarning(false);

    const payload: WorkflowRunPayload = {
      workflowId,
      workflowName: displayTitle,
      selectedDeviceId: selectedDevice.id,
      nodes,
      connections,
      requestedAt: new Date().toISOString(),
    };

    window.sessionStorage.setItem(WORKFLOW_LAST_RUN_PAYLOAD_STORAGE_KEY, JSON.stringify(payload));
    setIsTestRunning(true);
    setRunVisualization(null);
    selectNode(null);
    setPropertiesPanelOpen(false);

    try {
      const { startWorkflowRun } = await import("@/services/automation-api");
      const launchAppNode = nodes.find((n) => n.type === "LAUNCH_APP");
      const config = launchAppNode?.data?.config as Record<string, unknown> | undefined;
      const country = config?.country as string | undefined;
      const environment = (config?.environment as string | undefined) || (config?.stage as string | undefined);
      const result = await startWorkflowRun(workflowId, {
        selectedDeviceId: selectedDevice.id,
        mode: "full",
        country,
        environment,
      });
      setActiveRunId(result.runId);
      toast.success(`Workflow run started. Progress is shown on the canvas.`);
    } catch {
      setActiveRunId(null);
      window.dispatchEvent(new CustomEvent<WorkflowRunPayload>("nesy:workflow-run-test", { detail: payload }));
      toast.success(`Run Test payload prepared for ${getDeviceTitle(selectedDevice)}.`);
    }
  }, [connections, displayTitle, editorLocked, nodes, selectNode, selectedDevice, workflowId]);

  const editorInteractionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: editorLocked ? Infinity : 8 } })
  );

  const handleRuleDialogPrimaryAction = useCallback(() => {
    const current = ruleDialogState;
    if (!current.result) {
      setRuleDialogState({ open: false, result: null, pendingItem: null });
      return;
    }

    if (current.result.suggestedAction === "AUTO_CREATE_REQUIRED_FLOW") {
      addRequiredFlowSkeleton();
      if (
        current.pendingItem &&
        current.pendingItem.type !== WorkflowNodeType.CHECK_ROUTE &&
        current.pendingItem.type !== WorkflowNodeType.VALIDATE_STOPLIST
      ) {
        addNode(current.pendingItem, { kind: "canvas" });
      }
    }

    if (current.result.suggestedAction === "REMOVE_INVALID_NODE" && current.result.nodeId) {
      deleteNode(current.result.nodeId);
    }

    setRuleDialogState({ open: false, result: null, pendingItem: null });
  }, [addNode, addRequiredFlowSkeleton, deleteNode, ruleDialogState]);

  const isTestFinished = !!activeRunId && !isTestRunning;

  return (
    <DndContext
      id="workflow-editor-dnd"
      sensors={editorInteractionSensors}
      collisionDetection={workflowCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragItem(null)}
    >
      <div
        className="h-screen w-full overflow-hidden bg-slate-50 text-slate-950"
      >
        <header className="fixed inset-x-0 top-0 z-30 h-14 min-h-14 shrink-0 overflow-visible border-b border-slate-200 bg-white px-4">
          <div className="absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-4">
            <button
              type="button"
              onClick={requestCloseEditor}
              disabled={editorLocked}
              className="flex items-center gap-2 disabled:pointer-events-none disabled:opacity-50"
              aria-label="Back to workflow list"
            >
              <WorkflowMark />
              <span className="whitespace-nowrap text-sm font-semibold tracking-[-0.02em] text-slate-900">
                NESY AUTOMATION
              </span>
            </button>
          </div>

          <div className="absolute left-1/2 top-1/2 flex max-w-[min(38rem,calc(100vw-58rem))] -translate-x-1/2 -translate-y-1/2 items-center gap-2 overflow-hidden max-xl:hidden">
            <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">Workflows /</span>
            {isTitleEditing ? (
              <Input
                ref={titleInputRef}
                autoFocus
                disabled={isTitleSaving}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => void commitTitleEdit()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    titleInputRef.current?.blur();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setTitleDraft(displayTitle);
                    setIsTitleEditing(false);
                  }
                }}
                className="h-9 min-w-0 max-w-[28rem] shrink border-0 bg-transparent px-0 shadow-none ring-0 outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTitleDraft(displayTitle);
                  setIsTitleEditing(true);
                }}
                disabled={editorLocked || isTitleSaving}
                className="group flex min-w-0 max-w-full shrink items-center gap-2 truncate rounded-md px-1.5 py-1 text-left text-base font-semibold tracking-[-0.02em] text-slate-950 outline-none transition-colors hover:bg-slate-100/90 focus-visible:ring-2 focus-visible:ring-slate-300/90 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Edit workflow title"
              >
                <span className="min-w-0 truncate">{displayTitle}</span>
                <Pencil
                  className="size-3.5 shrink-0 text-slate-400 group-hover:text-slate-500"
                  strokeWidth={1.85}
                  aria-hidden
                />
              </button>
            )}
            <span className="shrink-0 whitespace-nowrap rounded-md bg-nesy-soft px-2 py-0.5 text-[11px] font-semibold text-nesy-ink">
              Draft
            </span>
            {isTestRunning ? (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-blue-600">
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
                Test running
              </span>
            ) : isPublishing ? (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-red-600">
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
                Publishing...
              </span>
            ) : persistStatus === "saving" ? (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-slate-600">
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
                Saving...
              </span>
            ) : persistStatus === "save_failed" && hasUnsavedChanges ? (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-red-600">
                <CircleX className="size-3.5 shrink-0" />
                Save failed
              </span>
            ) : hasUnsavedChanges ? (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-amber-600">
                <CircleX className="size-3.5 shrink-0" />
                Unsaved changes
              </span>
            ) : persistStatus === "saved_version" ? (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-emerald-600">
                <CheckCircle2 className="size-3.5 shrink-0" />
                Published
              </span>
            ) : persistStatus === "autosaved" ? (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-emerald-600">
                <CheckCircle2 className="size-3.5 shrink-0" />
                Autosaved
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-emerald-600">
                <CheckCircle2 className="size-3.5 shrink-0" />
                Saved
              </span>
            )}
            {showValidationWarning && hasValidationErrors ? (
              <span className="shrink-0 whitespace-nowrap rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Workflow has validation errors
              </span>
            ) : null}
          </div>

          <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={editorLocked || isWorkflowLoading || isPublishing || !hasUnpublishedChanges}
              className={cn(
                "h-9 min-h-9 max-h-9 shrink-0 rounded-[6px] px-4 font-semibold shadow-xs",
                isPublishing
                  ? "cursor-default border-red-300 bg-red-50 text-red-600 hover:bg-red-50 hover:text-red-600"
                  : isPublishButtonPublished
                    ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
                    : hasUnpublishedChanges
                      ? "border-red-500 bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
                      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-950",
              )}
              onClick={() => void saveWorkflowVersion()}
            >
              {isPublishing ? (
                <Loader2 className="size-4 animate-spin text-red-600" />
              ) : (
                <CheckCircle2
                  className={cn(
                    "size-4",
                    isPublishButtonPublished && "text-emerald-600",
                    !isPublishButtonPublished && hasUnpublishedChanges && "text-red-600",
                  )}
                />
              )}
              {isPublishing ? "Publishing..." : isPublishButtonPublished ? "Published" : "Publish"}
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={isPublishing || (!isTestRunning && !selectedDevice && !isTestFinished)}
              className={cn(
                "h-9 min-h-9 rounded-md px-4 text-white",
                isTestRunning
                  ? "bg-red-600 hover:bg-red-700"
                  : isTestFinished
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-nesy hover:bg-nesy-hover",
              )}
              onClick={() => {
                if (isTestFinished) {
                  router.push(`/automation/${workflowId}/runs/${activeRunId}`);
                } else if (isTestRunning) {
                  void stopWorkflowTest();
                } else {
                  void runWorkflowTest();
                }
              }}
            >
              {isTestRunning ? (
                <Square className="size-4 fill-current" />
              ) : isTestFinished ? (
                <ExternalLink className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
              {isTestRunning ? "Stop Test" : isTestFinished ? "View Results" : "Run Test"}
            </Button>
            <DeviceSelector
              devices={devices}
              filteredDevices={filteredDevices}
              disabled={editorLocked}
              isLoading={devicesLoading}
              isOpen={isDeviceDropdownOpen}
              onOpenChange={(open) => {
                if (editorLocked) return;
                setIsDeviceDropdownOpen(open);
                if (open) setDeviceSelectorAttention(false);
              }}
              onRefresh={() => void refreshDevices()}
              onSelectDevice={handleDeviceSelect}
              searchQuery={deviceSearchQuery}
              selectedDevice={selectedDevice}
              setSearchQuery={setDeviceSearchQuery}
              attention={deviceSelectorAttention}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  mode="icon"
                  size="lg"
                  disabled={editorLocked}
                  className="size-9 min-h-9 shrink-0 rounded-md"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem onSelect={() => setYamlPreviewOpen(true)}>
                  <Code2 className="size-4" />
                  Preview YAML
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onSelect={(event) => {
                    event.preventDefault();
                    setDeleteDialogOpen(true);
                  }}
                >
                  <RotateCcw className="size-4" />
                  Reset Workflow
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={requestCloseEditor}>
                  <X className="size-4" />
                  Close Editor
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <WorkflowYamlPreviewModal
          open={yamlPreviewOpen}
          workflowName={displayTitle}
          nodes={nodes}
          connections={connections}
          onClose={() => setYamlPreviewOpen(false)}
        />

        <UnsavedChangesDialog
          open={unsavedCloseDialogOpen && hasUnsavedChanges}
          isSaving={isSavingAndClosing}
          onCancel={() => setUnsavedCloseDialogOpen(false)}
          onCloseWithoutSaving={discardAndCloseEditor}
          onSaveAndClose={() => void handleSaveAndClose()}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="max-w-md rounded-md border border-slate-200 shadow-lg sm:rounded-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Clear workflow?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600">
                Are you sure? This will remove every node and connection from the canvas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" className="rounded-md">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                className="rounded-md bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
                onClick={() => {
                  handleResetWorkflow();
                  setDeleteDialogOpen(false);
                }}
              >
                Clear
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={nodeDeleteDialog.open}
          onOpenChange={(open) => {
            if (!open) setNodeDeleteDialog({ open: false, nodeId: null });
            else setNodeDeleteDialog((previous) => ({ ...previous, open }));
          }}
        >
          <AlertDialogContent className="max-w-md rounded-md border border-slate-200 shadow-lg sm:rounded-md">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {nodeDeleteImpact?.clearsEntireWorkflow
                  ? "Clear entire workflow?"
                  : nodeDeleteImpact?.isBranchDelete
                    ? "Delete workflow branch?"
                    : "Delete node?"}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-slate-600">
                  {nodeDeleteImpact?.clearsEntireWorkflow ? (
                    <p>
                      Deleting <span className="font-semibold text-slate-800">{nodeDeleteImpact.rootLabel}</span> removes
                      every node and connection. The canvas will return to an empty state.
                    </p>
                  ) : nodeDeleteImpact?.isBranchDelete ? (
                    <>
                      <p>This will delete the selected node and all nodes below it that are only reachable through this branch.</p>
                      <p className="text-xs font-medium text-slate-500">
                        Nodes to remove:{" "}
                        <span className="tabular-nums text-slate-700">{nodeDeleteImpact.nodeCount}</span>
                        {" · "}
                        Connections to remove:{" "}
                        <span className="tabular-nums text-slate-700">{nodeDeleteImpact.connectionCount}</span>
                      </p>
                    </>
                  ) : (
                    <p>This node will be removed from the workflow.</p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" className="rounded-md">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                className="rounded-md bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
                onClick={() => {
                  if (nodeDeleteDialog.nodeId) deleteNode(nodeDeleteDialog.nodeId);
                  setNodeDeleteDialog({ open: false, nodeId: null });
                }}
              >
                {nodeDeleteImpact?.clearsEntireWorkflow
                  ? "Clear workflow"
                  : nodeDeleteImpact?.isBranchDelete
                    ? "Delete branch"
                    : "Delete node"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={templateDialogState.open}
          onOpenChange={(open) => {
            if (!open) setTemplateDialogState({ open: false, templateId: null });
            else setTemplateDialogState((previous) => ({ ...previous, open }));
          }}
        >
          <AlertDialogContent className="max-w-md rounded-md border border-slate-200 shadow-lg sm:rounded-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Canvas is not empty</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600">
                Adding this template may replace or merge with your current workflow.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" className="rounded-md">
                Cancel
              </AlertDialogCancel>
              <Button type="button" variant="outline" disabled className="rounded-md">
                Merge Template
              </Button>
              <AlertDialogAction
                type="button"
                className="rounded-md bg-nesy text-white hover:bg-nesy-hover"
                onClick={() => {
                  if (templateDialogState.templateId) applyTemplate(templateDialogState.templateId);
                  setTemplateDialogState({ open: false, templateId: null });
                }}
              >
                Replace Canvas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <InvalidWorkflowStepDialog
          open={ruleDialogState.open}
          result={ruleDialogState.result}
          onClose={() => setRuleDialogState({ open: false, result: null, pendingItem: null })}
          onPrimaryAction={handleRuleDialogPrimaryAction}
        />

        <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
          <AlertDialogContent className="max-w-lg rounded-md border border-slate-200 shadow-lg sm:rounded-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Workflow validation failed</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600">
                Fix the issues below before running a test or publishing the workflow.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              {validationErrors.map((error, index) => (
                <div
                  key={`${error.code ?? "error"}-${error.nodeId ?? index}`}
                  className="flex flex-col gap-1 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                >
                  <p className="text-xs font-medium text-slate-700">- {error.title ?? error.message}</p>
                  {error.detail ? <p className="text-[11px] leading-snug text-slate-500">{error.detail}</p> : null}
                  {error.suggestedAction === "REMOVE_INVALID_NODE" && error.nodeId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1 self-start rounded-md"
                      onClick={() => deleteNode(error.nodeId!)}
                    >
                      {error.suggestedActionLabel ?? "Remove invalid node"}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" className="rounded-md">
                Close
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="h-[calc(100vh-3.5rem)] pt-14">
          <aside
            className={cn(
              "fixed bottom-0 left-0 top-14 z-20 w-[280px] overflow-y-auto border-r border-slate-200 bg-white p-4",
              editorLocked && "pointer-events-none opacity-55",
            )}
            aria-disabled={editorLocked}
          >
            <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-slate-400 shadow-xs">
              <Search className="size-4" />
              <input
                ref={paletteSearchInputRef}
                type="search"
                placeholder="Search components"
                value={paletteSearch}
                onChange={(event) => setPaletteSearch(event.target.value)}
                className="min-w-0 flex-1 appearance-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
              />
              {paletteSearch ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setPaletteSearch("")}
                  className="flex size-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </label>

            {filteredTemplates.length > 0 ? (
              <TemplatePaletteSection templates={filteredTemplates} onTemplateSelect={requestTemplateApply} />
            ) : null}

            {filteredPaletteGroups.map((group) => (
              <PaletteSection
                key={group.title}
                title={group.title}
                items={group.items}
                subsections={group.subsections}
              />
            ))}

            {!hasPaletteResults ? (
              <div className="mt-4 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs font-medium text-slate-500">
                No components found.
              </div>
            ) : null}
          </aside>

          <WorkflowCanvas
            canvasContainerRef={canvasContainerRef}
            canvasTool={canvasTool}
            connections={connections}
            cursorClass={cursorClass}
            invalidNodeIds={invalidNodeIds}
            isPanning={isPanning}
            isSpacePressed={isSpacePressed}
            nodes={nodes}
            onCanvasToolChange={setCanvasTool}
            onDuplicateNode={() => {
              if (selectedNodeId) duplicateNode(selectedNodeId);
            }}
            onFitToScreen={resetZoom}
            onRequestConnectionDelete={requestConnectionDelete}
            onRequestDeleteNode={requestNodeDelete}
            onRequestSelectedNodeDelete={() => {
              if (selectedNodeId) requestNodeDelete(selectedNodeId);
            }}
            onToggleGrid={() => setShowGrid((value) => !value)}
            onToggleMinimap={() => setShowMinimap((value) => !value)}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            propertiesPanelOpen={propertiesPanelOpen}
            selectedNodeId={selectedNodeId ?? null}
            showGrid={showGrid}
            showMinimap={showMinimap}
            showZoomIndicator={showZoomIndicator}
            viewport={viewport}
            viewportHandlers={viewportHandlers}
            onTemplateSelect={requestTemplateApply}
            runVisualization={runVisualization}
            editorLocked={editorLocked}
          />

          {isPublishing ? (
            <div
              className="fixed bottom-0 left-[280px] top-14 z-[35] flex cursor-wait items-center justify-center bg-slate-900/10 backdrop-blur-[1px]"
              style={{ right: propertiesPanelOpen ? `${RIGHT_PROPERTIES_PANEL_PX}px` : 0 }}
              role="status"
              aria-live="polite"
              aria-busy="true"
              aria-label="Publishing workflow"
            >
              <div className="flex items-center gap-2.5 rounded-[6px] border border-slate-200 bg-white px-4 py-3 shadow-lg">
                <Loader2 className="size-4 shrink-0 animate-spin text-red-600" />
                <span className="text-sm font-semibold text-slate-800">Publishing workflow...</span>
              </div>
            </div>
          ) : null}

          {isWorkflowLoading ? (
            <div
              className="fixed bottom-0 left-[280px] top-14 z-[25] overflow-hidden bg-[#F8FAFC]"
              style={{ right: propertiesPanelOpen ? `${RIGHT_PROPERTIES_PANEL_PX}px` : 0 }}
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <WorkflowCanvasContentShimmer title={displayTitle} />
            </div>
          ) : null}

          {propertiesPanelOpen && selectedNode ? (
            <aside
              className="fixed bottom-0 right-0 top-14 z-20 shrink-0 overflow-hidden border-l border-slate-200 bg-white"
              style={{ width: `${RIGHT_PROPERTIES_PANEL_PX}px` }}
            >
              <YamlPreviewPanel
                selectedNode={selectedNode}
                onClose={() => setPropertiesPanelOpen(false)}
                onRunTest={runWorkflowTest}
                runTestDisabled={!selectedDevice || editorLocked}
                onUpdateNodeConfig={updateNodeConfig}
              />
            </aside>
          ) : selectedNode ? (
            <button
              type="button"
              aria-label="Open properties panel"
              onClick={() => setPropertiesPanelOpen(true)}
              className="fixed right-0 top-1/2 z-20 flex h-14 w-8 -translate-y-1/2 items-center justify-center rounded-l-md border border-slate-200 border-r-0 bg-white text-slate-600 shadow-xs hover:bg-slate-50"
            >
              <ChevronLeft className="size-4 shrink-0" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragItem ? <PaletteDragPreview item={activeDragItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function DeviceSelector({
  devices,
  filteredDevices,
  disabled = false,
  isLoading,
  isOpen,
  onOpenChange,
  onRefresh,
  onSelectDevice,
  searchQuery,
  selectedDevice,
  setSearchQuery,
  attention,
}: {
  devices: NesyMobileAdbDevice[];
  filteredDevices: NesyMobileAdbDevice[];
  disabled?: boolean;
  isLoading: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
  onSelectDevice: (device: NesyMobileAdbDevice) => void;
  searchQuery: string;
  selectedDevice: NesyMobileAdbDevice | null;
  setSearchQuery: (query: string) => void;
  attention: boolean;
}) {
  const selectedStatus = selectedDevice ? getDeviceStatus(selectedDevice) : null;
  const selectedTitle = selectedDevice ? getDeviceTitle(selectedDevice) : "Select a device";
  const selectedSubtitle = selectedDevice
    ? `Device ID: ${selectedDevice.id} \u2022 ${selectedStatus === "Offline" ? "Disconnected" : "Connected"}`
    : devices.length > 0
      ? "Choose a connected Android device"
      : "No ADB devices detected";

  return (
    <Popover open={isOpen && !disabled} onOpenChange={disabled ? undefined : onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Select test device"
          className={cn(
            "group inline-flex h-10 w-fit max-w-[340px] shrink-0 items-center gap-2 overflow-hidden rounded-[6px] border bg-white pl-2.5 pr-1.5 text-left shadow-xs shadow-black/5 transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nesy/25 max-lg:max-w-[280px] max-md:w-10 max-md:max-w-none max-md:justify-center max-md:gap-0 max-md:overflow-visible max-md:px-0 disabled:pointer-events-none disabled:opacity-50",
            attention ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200",
            isOpen ? "border-slate-300" : "",
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3 max-md:flex-none">
            <span className="relative flex size-6 shrink-0 items-center justify-center rounded-[6px] border border-slate-200 bg-slate-50 text-slate-600">
              <Smartphone className="size-4" aria-hidden />
              {selectedDevice && selectedStatus !== "Offline" ? (
                <span className="absolute -right-1 -top-1 size-2 rounded-full border border-white bg-emerald-500" aria-hidden />
              ) : null}
            </span>
            <span className="min-w-0 max-md:hidden flex flex-col justify-center">
              <span className="block truncate text-xs font-semibold leading-[1.05] text-slate-900">{selectedTitle}</span>
              <span className="mt-px flex min-w-0 items-center gap-1.5 truncate text-[10px] font-medium leading-[1.05] text-slate-500">
                <span className="truncate">{selectedSubtitle}</span>
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-600 max-md:hidden">
            <ChevronDown className={cn("size-4 text-slate-400 transition-transform", isOpen ? "rotate-180" : "")} aria-hidden />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="z-[80] w-[450px] max-w-[calc(100vw-2rem)] rounded-[6px] border border-slate-200 bg-white p-2 text-slate-950 shadow-xl shadow-slate-900/10"
      >
        <div className="flex h-10 items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 text-slate-400">
          <Search className="size-4 shrink-0" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search devices..."
            className="min-w-0 flex-1 appearance-none bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label="Clear device search"
              onClick={() => setSearchQuery("")}
              className="flex size-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between px-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Available Devices</p>
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {isLoading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
            Refresh
          </button>
        </div>

        <div className="mt-2 max-h-[280px] space-y-1 overflow-y-auto pr-1">
          {isLoading && devices.length === 0 ? (
            <div className="flex h-24 items-center justify-center gap-2 text-sm font-medium text-slate-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading ADB devices...
            </div>
          ) : null}

          {!isLoading && filteredDevices.length === 0 ? (
            <div className="rounded-[6px] border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-sm font-medium text-slate-500">
              {devices.length === 0 ? "No ADB devices found." : "No devices match your search."}
            </div>
          ) : null}

          {filteredDevices.map((device) => {
            const selected = selectedDevice?.id === device.id;
            const status = getDeviceStatus(device);

            return (
              <button
                key={device.id}
                type="button"
                onClick={() => onSelectDevice(device)}
                className={cn(
                  "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[6px] border px-3 py-2.5 text-left transition-colors",
                  selected
                    ? "border-emerald-200 bg-emerald-50/75"
                    : "border-transparent bg-white hover:bg-slate-50",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border",
                      selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent",
                    )}
                  >
                    <Check className="size-3.5" aria-hidden />
                  </span>
                  <span className="flex size-9 items-center justify-center rounded-[6px] border border-slate-200 bg-white text-slate-600">
                    <Smartphone className="size-4" aria-hidden />
                  </span>
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">{getDeviceTitle(device)}</span>
                  <span className="mt-1 flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs font-medium text-slate-500">Device ID: {device.id}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold leading-none",
                        getDeviceStatusClassName(status),
                      )}
                    >
                      {status}
                    </span>
                  </span>
                </span>

                <span className="flex flex-col items-end gap-1 text-right">
                  <span className="flex items-center gap-1 text-xs font-bold text-slate-700">
                    {getDeviceBatteryLabel(device)}
                    <Battery className="size-4 text-slate-500" aria-hidden />
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">{formatDeviceLastSeen(device)}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 border-t border-slate-100 pt-2">
          <button
            type="button"
            className="flex h-10 w-full items-center gap-3 rounded-[6px] px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Cable className="size-4 text-slate-500" aria-hidden />
            Connect New Device
          </button>
          <button
            type="button"
            className="flex h-10 w-full items-center justify-between rounded-[6px] px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <span className="flex items-center gap-3">
              <Smartphone className="size-4 text-slate-500" aria-hidden />
              Open Device Manager
            </span>
            <ExternalLink className="size-4 text-slate-400" aria-hidden />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function WorkflowCanvas({
  canvasContainerRef,
  canvasTool,
  connections,
  cursorClass,
  invalidNodeIds,
  isPanning,
  isSpacePressed,
  nodes,
  onCanvasToolChange,
  onDuplicateNode,
  onFitToScreen,
  onRequestConnectionDelete,
  onRequestDeleteNode,
  onRequestSelectedNodeDelete,
  onToggleGrid,
  onToggleMinimap,
  onZoomIn,
  onZoomOut,
  propertiesPanelOpen,
  selectedNodeId,
  showGrid,
  showMinimap,
  showZoomIndicator,
  viewport,
  viewportHandlers,
  onTemplateSelect,
  runVisualization,
  editorLocked,
}: {
  canvasContainerRef: MutableRefObject<HTMLElement | null>;
  canvasTool: CanvasPointerTool;
  connections: Connection[];
  cursorClass: string;
  invalidNodeIds: Set<string>;
  isPanning: boolean;
  isSpacePressed: boolean;
  nodes: WorkflowNode[];
  onCanvasToolChange: (tool: CanvasPointerTool) => void;
  onDuplicateNode: () => void;
  onFitToScreen: () => void;
  onRequestConnectionDelete: (connectionId: string) => void;
  onRequestDeleteNode: (nodeId: string) => void;
  onRequestSelectedNodeDelete: () => void;
  onToggleGrid: () => void;
  onToggleMinimap: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  propertiesPanelOpen: boolean;
  selectedNodeId: string | null;
  showGrid: boolean;
  showMinimap: boolean;
  showZoomIndicator: boolean;
  viewport: ViewportState;
  viewportHandlers: ReturnType<typeof useViewportController>["handlers"];
  onTemplateSelect: (templateId: string) => void;
  runVisualization: WorkflowRunVisualization | null;
  editorLocked: boolean;
}) {
  const { setNodeRef: setCanvasDropRef, isOver: isCanvasOver } = useDroppable({
    id: "canvas",
    data: { target: { kind: "canvas" } satisfies DropTarget },
    disabled: editorLocked,
  });
  const virtualStartNode = useMemo(() => getVirtualStartNode(nodes), [nodes]);
  const virtualStartConnection = useMemo(() => getVirtualStartConnection(virtualStartNode, nodes), [nodes, virtualStartNode]);
  const backendLane = useMemo(() => layoutBackendValidationLane(nodes, NODE_WIDTH), [nodes]);
  const renderNodes = useMemo<CanvasRenderNode[]>(() => {
    const base: CanvasRenderNode[] = virtualStartNode ? [virtualStartNode, ...nodes] : [...nodes];
    if (backendLane.header) {
      base.push({ ...backendLane.header, virtual: true, visualRole: "backend_header" });
    }
    for (const laneNode of backendLane.nodes) {
      base.push({ ...laneNode, virtual: true, visualRole: "backend_lane" });
    }
    return base;
  }, [backendLane.header, backendLane.nodes, nodes, virtualStartNode]);
  const renderConnections = useMemo<CanvasRenderConnection[]>(() => {
    const base: CanvasRenderConnection[] = virtualStartConnection
      ? [virtualStartConnection, ...connections]
      : [...connections];
    for (const connection of backendLane.connections) {
      base.push({ ...connection, virtual: true, backendLane: true });
    }
    return base;
  }, [backendLane.connections, connections, virtualStartConnection]);

  return (
    <main
      ref={(node) => {
        canvasContainerRef.current = node;
        setCanvasDropRef(node);
      }}
      className={cn("fixed bottom-0 left-[280px] top-14 overflow-hidden", cursorClass)}
      style={
        {
          backgroundColor: "#F8FAFC",
          right: propertiesPanelOpen ? `${RIGHT_PROPERTIES_PANEL_PX}px` : 0,
          backgroundImage: showGrid
            ? `radial-gradient(circle, ${VIEWPORT_GRID_DOT} ${VIEWPORT_GRID_DOT_RADIUS_PX}px, transparent ${VIEWPORT_GRID_DOT_RADIUS_PX}px)`
            : "none",
          backgroundSize: `${VIEWPORT_GRID_SPACING_PX}px ${VIEWPORT_GRID_SPACING_PX}px`,
          backgroundPosition: `${((viewport.x % VIEWPORT_GRID_SPACING_PX) + VIEWPORT_GRID_SPACING_PX) % VIEWPORT_GRID_SPACING_PX}px ${((viewport.y % VIEWPORT_GRID_SPACING_PX) + VIEWPORT_GRID_SPACING_PX) % VIEWPORT_GRID_SPACING_PX}px`,
        } as CSSProperties
      }
      {...viewportHandlers}
    >
      <div
        className={cn(
          "origin-[0_0] will-change-transform",
          (isPanning || isSpacePressed || canvasTool === "hand") && "pointer-events-none select-none",
        )}
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
        }}
      >
        <div className="relative min-h-[1200px] min-w-[1400px] p-8">
          <ConnectionLayer
            nodes={renderNodes}
            connections={renderConnections}
            selectedNodeId={selectedNodeId ?? null}
            canDeleteConnections={canvasTool === "move" && !editorLocked}
            onRequestDeleteConnection={onRequestConnectionDelete}
            traversedConnectionIds={runVisualization?.traversedConnectionIds}
          />
          <AnimatePresence>
            {renderNodes.map((node) =>
              node.virtual && (node.visualRole === "backend_lane" || node.visualRole === "backend_header") ? (
                <BackendLaneNodeView
                  key={node.id}
                  node={node}
                  executionStatus={getCanvasNodeExecutionStatus(node.id, runVisualization)}
                />
              ) : (
                <CanvasNodeView
                  key={node.id}
                  node={node}
                  invalid={invalidNodeIds.has(node.id)}
                  selected={!editorLocked && selectedNodeId === node.id}
                  onRequestDelete={onRequestDeleteNode}
                  executionStatus={getCanvasNodeExecutionStatus(node.id, runVisualization)}
                  editorLocked={editorLocked}
                />
              ),
            )}
          </AnimatePresence>
          {nodes.filter((node) => node.kind === "condition").map((node) => (
            <ConditionBranchTargets
              key={`branches-${node.id}`}
              node={node}
              nodes={nodes}
              connections={connections}
              editorLocked={editorLocked}
            />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {nodes.length === 0 ? (
          <EmptyCanvasState active={isCanvasOver && !editorLocked} onTemplateSelect={onTemplateSelect} editorLocked={editorLocked} />
        ) : null}
      </AnimatePresence>

      {isCanvasOver && nodes.length > 0 ? (
        <div className="pointer-events-none absolute inset-4 rounded-md border border-dashed border-nesy-muted bg-nesy-soft/20" />
      ) : null}

      {showZoomIndicator && (
        <div className="pointer-events-none absolute left-1/2 top-5 z-30 -translate-x-1/2 animate-in fade-in slide-in-from-top-1 duration-150">
          <span className="rounded-lg bg-slate-800/80 px-3 py-1.5 text-xs font-semibold tabular-nums text-white shadow-lg backdrop-blur-sm">
            {Math.round(viewport.scale * 100)}%
          </span>
        </div>
      )}

      {showMinimap ? <WorkflowMiniMap nodes={nodes} viewport={viewport} /> : null}

      <CanvasControls
        canvasTool={canvasTool}
        hasSelectedNode={Boolean(selectedNodeId)}
        isGridVisible={showGrid}
        isMinimapVisible={showMinimap}
        onCanvasToolChange={onCanvasToolChange}
        onDuplicateNode={onDuplicateNode}
        onFitToScreen={onFitToScreen}
        onRequestSelectedNodeDelete={onRequestSelectedNodeDelete}
        onToggleGrid={onToggleGrid}
        onToggleMinimap={onToggleMinimap}
        zoomPercent={Math.round(viewport.scale * 100)}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        hasNodes={nodes.length > 0}
        editorLocked={editorLocked}
      />
    </main>
  );
}

function WorkflowMark() {
  return (
    <img
      src="/media/app/nesy-icon.png"
      alt="NESY"
      width={24}
      height={24}
      className="size-6 shrink-0 rounded-[6px] object-contain"
      decoding="async"
    />
  );
}

function paletteSectionSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function PaletteSubgroupHeading({ label }: { label: string }) {
  return (
    <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
  );
}

const templateIconRegistry = {
  UserCheck,
};

function TemplatePaletteSection({
  templates,
  onTemplateSelect,
}: {
  templates: WorkflowTemplate[];
  onTemplateSelect: (templateId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const reactId = useId();
  const regionId = `palette-templates-${reactId.replace(/:/g, "")}`;
  const triggerId = `${regionId}-trigger`;

  return (
    <section className="mt-5">
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex w-full min-w-0 items-center justify-between gap-2 rounded-md py-1 text-left text-xs font-semibold text-slate-700"
      >
        <span className="truncate">Templates</span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-slate-400 transition-transform duration-200", !open && "-rotate-90")}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={regionId} role="region" aria-labelledby={triggerId} className="space-y-2">
          {templates.map((template) => (
            <TemplatePaletteButton key={template.id} template={template} onTemplateSelect={onTemplateSelect} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TemplatePaletteButton({
  template,
  onTemplateSelect,
}: {
  template: WorkflowTemplate;
  onTemplateSelect: (templateId: string) => void;
}) {
  const Icon = templateIconRegistry[template.icon as keyof typeof templateIconRegistry] ?? UserCheck;

  return (
    <button
      type="button"
      className="group flex min-h-12 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 shadow-xs transition-all hover:border-purple-200 hover:bg-purple-50/35"
      onClick={() => onTemplateSelect(template.id)}
    >
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-sm border", template.tone)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-tight text-slate-800">{template.name}</span>
        <span className="mt-0.5 block truncate text-[11px] font-medium leading-tight text-slate-400">
          {template.subtitle}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-slate-300 transition-colors group-hover:text-purple-500" />
    </button>
  );
}

function PaletteSection({
  title,
  items,
  subsections,
  defaultOpen = true,
}: {
  title: string;
  items?: PaletteItem[];
  subsections?: { title: string; items: PaletteItem[] }[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reactId = useId();
  const regionId = `palette-${paletteSectionSlug(title)}-${reactId.replace(/:/g, "")}`;
  const triggerId = `${regionId}-trigger`;

  return (
    <section className="mt-5">
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex w-full min-w-0 items-center justify-between gap-2 rounded-md py-1 text-left text-xs font-semibold text-slate-700"
      >
        <span className="truncate">{title}</span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-slate-400 transition-transform duration-200", !open && "-rotate-90")}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={regionId} role="region" aria-labelledby={triggerId} className="space-y-2">
          {subsections?.length ? (
            <div className="space-y-4 pt-0.5">
              {subsections.map((sub) => (
                <div key={sub.title}>
                  <PaletteSubgroupHeading label={sub.title} />
                  <div className="space-y-2">
                    {sub.items.map((item) => (
                      <PaletteButton key={item.type} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {items?.length ? (
            <div className="space-y-2">
              {items.map((item) => (
                <PaletteButton key={item.type} item={item} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PaletteButton({ item }: { item: PaletteItem }) {
  const [showDragHandle, setShowDragHandle] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { paletteItem: item },
  });
  const Icon = iconRegistry[item.icon] ?? Box;

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "group flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700 shadow-xs transition-all hover:border-nesy-muted hover:bg-nesy-soft",
        isDragging && "opacity-45",
      )}
      {...attributes}
      {...listeners}
      onBlur={() => setShowDragHandle(false)}
      onClick={() => setShowDragHandle(true)}
      onFocus={() => setShowDragHandle(true)}
      onMouseEnter={() => setShowDragHandle(true)}
      onMouseLeave={() => setShowDragHandle(false)}
      onMouseMove={() => setShowDragHandle(true)}
      onPointerEnter={() => setShowDragHandle(true)}
      onPointerLeave={() => setShowDragHandle(false)}
      onPointerMove={() => setShowDragHandle(true)}
    >
      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-sm border", item.tone)}>
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-sm transition-all duration-150 group-focus:text-nesy-ink group-focus:opacity-100 group-hover:text-nesy-ink group-hover:opacity-100",
          showDragHandle ? "text-nesy-ink opacity-100" : "text-slate-300 opacity-0",
        )}
      >
        <GripVertical className="size-4" />
      </span>
    </button>
  );
}

function WorkflowNodeSubtitle({
  subtitle,
  subtitleTags,
  muted = false,
}: {
  subtitle: string;
  subtitleTags: string[];
  muted?: boolean;
}) {
  if (subtitleTags.length > 0) {
    return (
      <span className="mt-1.5 flex flex-wrap gap-1">
        {subtitleTags.map((tag) => (
          <span
            key={tag}
            className={cn(
              "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none",
              muted
                ? "border-slate-200 bg-slate-50 text-slate-500"
                : "border-slate-200/90 bg-slate-50 text-slate-600",
            )}
          >
            {tag}
          </span>
        ))}
      </span>
    );
  }
  if (!subtitle) return null;
  return (
    <span
      className={cn(
        "mt-1 block text-[11px] font-medium leading-snug",
        muted ? "text-slate-500" : "text-slate-500",
      )}
    >
      {subtitle}
    </span>
  );
}

function PaletteDragPreview({ item }: { item: PaletteItem }) {
  const Icon = iconRegistry[item.icon] ?? Box;
  const subtitleTags = parseWorkflowSubtitleTags(item.subtitle);
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-nesy-muted bg-white px-3.5 py-3 text-left shadow-xl"
      style={{ width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
    >
      <span className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border", item.tone)}>
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-snug text-slate-800">{item.title}</span>
        <WorkflowNodeSubtitle subtitle={item.subtitle} subtitleTags={subtitleTags} muted />
      </span>
    </div>
  );
}

function EmptyCanvasState({
  active,
  onTemplateSelect,
  editorLocked,
}: {
  active: boolean;
  onTemplateSelect: (templateId: string) => void;
  editorLocked: boolean;
}) {
  const addRequiredFlowSkeleton = useWorkflowStore((state) => state.addRequiredFlowSkeleton);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-5 py-5 sm:px-8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.section
        aria-label="Workflow onboarding empty state"
        onMouseDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        className={cn(
          "pointer-events-auto w-full max-w-[min(800px,calc(100vw-120px))] rounded-3xl border bg-white px-[38px] py-[38px] text-center backdrop-blur-sm transition-colors duration-200",
          active ? "border-orange-200/90 ring-2 ring-orange-100/50" : "border-slate-200/70",
        )}
      >
        <div className="mx-auto mt-3 max-w-[560px]">
          <h2 className="text-[34px] font-bold leading-[1.12] tracking-[-0.02em] text-slate-950">
            Build your first workflow
          </h2>
          <p className="mx-auto mt-2.5 max-w-[440px] text-[15px] font-medium leading-snug text-slate-500">
            Drag components from the left, start from a template, or import an existing flow.
          </p>
        </div>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200/55" />
          <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400/75">
            Explore starter workflows
          </span>
          <span className="h-px flex-1 bg-slate-200/55" />
        </div>

        <div className="grid grid-cols-3 gap-3 text-left">
          <StarterWorkflowCard
            icon={UserRound}
            title="Login Flow"
            subtitle="Authentication and session setup"
            tone="orange"
            onClick={() => !editorLocked && onTemplateSelect("login-flow")}
          />
          <StarterWorkflowCard
            icon={Truck}
            title="Delivery Flow"
            subtitle="Core delivery execution workflow"
            tone="green"
            onClick={() => !editorLocked && addRequiredFlowSkeleton()}
          />
          <StarterWorkflowCard
            icon={Sparkles}
            title="Happy Path Suite"
            subtitle="End-to-end success scenarios"
            tone="purple"
            onClick={() => !editorLocked && addRequiredFlowSkeleton()}
          />
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400/65">
          <Lightbulb className="size-3.5 shrink-0 text-slate-400/55" strokeWidth={1.75} />
          <span>Tip: Double click a component to configure it</span>
        </p>
      </motion.section>
    </motion.div>
  );
}

function StarterWorkflowCard({
  icon: Icon,
  title,
  subtitle,
  tone,
  onClick,
}: {
  icon: typeof UserRound;
  title: string;
  subtitle: string;
  tone: "orange" | "green" | "purple";
  onClick: () => void;
}) {
  const toneClassName = {
    orange: "border-orange-100 bg-orange-50 text-orange-600",
    green: "border-emerald-100 bg-emerald-50 text-emerald-600",
    purple: "border-indigo-100 bg-indigo-50 text-indigo-500",
  }[tone];

  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: "spring", stiffness: 520, damping: 38 }}
      onClick={onClick}
      className="group flex h-[96px] items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.025)] transition-[border-color,box-shadow] duration-200 hover:border-orange-200/80 hover:shadow-[0_8px_22px_rgba(15,23,42,0.055)]"
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border", toneClassName)}>
        <Icon className="size-[22px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold tracking-[-0.01em] text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs font-medium leading-snug text-slate-500 line-clamp-2">{subtitle}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-slate-400/90 transition-colors group-hover:text-orange-500/90" />
    </motion.button>
  );
}

function NodeExecutionIndicator({ status }: { status: NonNullable<ReturnType<typeof getCanvasNodeExecutionStatus>> }) {
  if (status === "pending") return null;
  if (status === "running") {
    return (
      <span className="flex shrink-0 flex-col items-center gap-1.5">
        <Loader2 className="size-4 animate-spin text-blue-500" aria-hidden />
        <span className="sr-only">Running</span>
      </span>
    );
  }
  if (status === "success") {
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-label="Completed" />;
  }
  if (status === "failed") {
    return <CircleX className="size-4 shrink-0 text-red-500" aria-label="Failed" />;
  }
  return null;
}

function WaitCountdown({ timeoutMs }: { timeoutMs: number }) {
  const [remaining, setRemaining] = useState(timeoutMs);

  useEffect(() => {
    setRemaining(timeoutMs);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, timeoutMs - elapsed);
      setRemaining(left);
      if (left <= 0) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [timeoutMs]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const progress = remaining / timeoutMs;

  return (
    <span className="flex shrink-0 flex-col items-center gap-0.5">
      <span className="text-[11px] font-bold tabular-nums text-blue-600">
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
      <span className="h-1 w-8 overflow-hidden rounded-full bg-blue-100">
        <span
          className="block h-full rounded-full bg-blue-500 transition-all duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </span>
    </span>
  );
}

const CanvasNodeView = memo(function CanvasNodeView({
  node,
  executionStatus,
  invalid,
  onRequestDelete,
  selected,
  editorLocked,
}: {
  node: CanvasRenderNode;
  executionStatus: ReturnType<typeof getCanvasNodeExecutionStatus>;
  invalid?: boolean;
  onRequestDelete: (nodeId: string) => void;
  selected: boolean;
  editorLocked: boolean;
}) {
  const selectNode = useWorkflowStore((state) => state.selectNode);
  const isVirtualStart = node.virtual && node.visualRole === "start_trigger";
  const { setNodeRef, isOver } = useDroppable({
    id: `node-${node.id}`,
    data: { target: { kind: "node", nodeId: node.id } satisfies DropTarget },
    disabled: editorLocked || isVirtualStart,
  });
  const Icon = isVirtualStart ? Play : iconRegistry[node.data.icon ?? "Box"] ?? Box;
  const tone = allPaletteItems.find((item) => item.type === node.type)?.tone ?? nodeToneByType.action;
  const { title: displayTitle, subtitle, subtitleTags } = isVirtualStart
    ? { title: node.data.title ?? "Start", subtitle: "", subtitleTags: [] as string[] }
    : getWorkflowNodeDisplay(node);
  const showExecutionBadge = Boolean(executionStatus);

  return (
    <motion.button
      ref={isVirtualStart ? undefined : setNodeRef}
      type="button"
      initial={{ left: node.position.x, opacity: 0, scale: 0.94, top: node.position.y }}
      animate={{ left: node.position.x, opacity: 1, scale: 1, top: node.position.y }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      onClick={(event) => {
        if (isVirtualStart || editorLocked) return;
        event.stopPropagation();
        selectNode(node.id);
      }}
      onContextMenu={(event) => {
        if (isVirtualStart || editorLocked) return;
        event.preventDefault();
        onRequestDelete(node.id);
      }}
      className={cn(
        "group relative absolute z-10 flex items-start gap-3 overflow-hidden border bg-white px-3.5 py-3 text-left shadow-sm transition-all duration-200",
        isVirtualStart
          ? "pointer-events-none rounded-[14px] border-slate-200/80 bg-white shadow-none"
          : editorLocked
            ? "pointer-events-none cursor-default rounded-xl"
            : "cursor-default rounded-xl",
        executionStatus === "running" && "border-blue-300/90 shadow-[0_0_0_3px_rgba(59,130,246,0.12)] ring-2 ring-blue-100/80",
        executionStatus === "success" && !isVirtualStart && "border-emerald-200/90",
        executionStatus === "failed" && "border-red-300/90 shadow-[0_0_0_3px_rgba(239,68,68,0.12)] ring-2 ring-red-100/80",
        !isVirtualStart && invalid && "border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.2)] ring-2 ring-red-200",
        !isVirtualStart &&
          !executionStatus &&
          (selected
            ? "border-orange-400/90 shadow-[0_0_0_3px_rgba(255,122,26,0.14),0_1px_3px_rgba(0,0,0,0.06)] ring-2 ring-orange-100/90"
            : "border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:shadow-md"),
        !isVirtualStart && !invalid && isOver && "border-nesy-muted bg-nesy-soft/70 ring-2 ring-nesy-muted/40",
      )}
      style={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
      }}
    >
      <span
        className={cn(
          "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border",
          isVirtualStart ? "border-emerald-200 bg-emerald-50 text-emerald-600" : tone,
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <span className={cn("min-w-0 flex-1", showExecutionBadge && "pr-7")}>
        <span className="block text-[13px] font-semibold leading-snug text-slate-800">{displayTitle}</span>
        {isVirtualStart ? (
          <span className="mt-1 block text-[11px] font-medium leading-snug text-slate-500">Manual Trigger</span>
        ) : (
          <WorkflowNodeSubtitle subtitle={subtitle} subtitleTags={subtitleTags} />
        )}
      </span>
      {executionStatus === "running" && node.type === WorkflowNodeType.WAIT ? (
        <span className="absolute right-2.5 top-2.5 shrink-0">
          <WaitCountdown timeoutMs={Number(node.data.config?.timeout ?? 5000)} />
        </span>
      ) : executionStatus ? (
        <span className="absolute right-2.5 top-2.5 shrink-0">
          <NodeExecutionIndicator status={executionStatus} />
        </span>
      ) : null}
      {executionStatus === "running" ? (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-xl bg-blue-100"
          aria-hidden
        >
          <span className="block h-full w-1/3 animate-[workflow-run-progress_1.1s_ease-in-out_infinite] rounded-full bg-blue-500" />
        </span>
      ) : null}
    </motion.button>
  );
});

function ConditionBranchTargets({
  node,
  nodes,
  connections,
  editorLocked,
}: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  connections: Connection[];
  editorLocked: boolean;
}) {
  const nodeById = new Map(nodes.map((candidate) => [candidate.id, candidate]));
  const branchConnections = {
    true: connections.find((connection) => connection.sourceNodeId === node.id && connection.sourceHandle === "true"),
    false: connections.find((connection) => connection.sourceNodeId === node.id && connection.sourceHandle === "false"),
  };
  const branchTargets = {
    true: branchConnections.true?.targetNodeId ? nodeById.get(branchConnections.true.targetNodeId) : null,
    false: branchConnections.false?.targetNodeId ? nodeById.get(branchConnections.false.targetNodeId) : null,
  };

  return (
    <>
      <BranchDropTarget node={node} branchType="true" targetNode={branchTargets.true} editorLocked={editorLocked} />
      <BranchDropTarget node={node} branchType="false" targetNode={branchTargets.false} editorLocked={editorLocked} />
    </>
  );
}

function BranchDropTarget({
  node,
  branchType,
  targetNode,
  editorLocked,
}: {
  node: WorkflowNode;
  branchType: BranchType;
  targetNode?: WorkflowNode | null;
  editorLocked: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `branch-${node.id}-${branchType}`,
    data: { target: { kind: "branch", nodeId: node.id, branchType } satisfies DropTarget },
    disabled: editorLocked,
  });
  const branchAnchor = getBranchAnchorPoint(node, branchType, targetNode ?? null);
  const left = branchAnchor.x - 84;
  const top = branchAnchor.y - 18;
  const label = branchType === "true" ? "True" : "False";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "pointer-events-none absolute z-20 flex h-20 w-[168px] justify-center rounded-full transition-all",
        isOver && "scale-[1.03]",
      )}
      style={{ left, top }}
      aria-label={`Drop here to add to ${label} branch`}
    >
      <div
        className={cn(
          "inline-flex h-[30px] min-w-[52px] shrink-0 items-center justify-center rounded-full border px-1.5 text-[11px] font-bold shadow-sm transition-all",
          branchType === "true"
            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
            : "border-rose-200 bg-rose-50 text-rose-600",
          isOver &&
            (branchType === "true"
              ? "border-emerald-300 bg-emerald-100 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]"
              : "border-rose-300 bg-rose-100 shadow-[0_0_0_5px_rgba(244,63,94,0.12)]"),
        )}
      >
        {label}
      </div>
      {!targetNode && isOver ? (
        <div className="absolute top-9 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
          Drop here to add to {label} branch
        </div>
      ) : null}
    </div>
  );
}

function ConnectionLayer({
  nodes,
  connections,
  selectedNodeId,
  canDeleteConnections,
  onRequestDeleteConnection,
  traversedConnectionIds,
}: {
  nodes: CanvasRenderNode[];
  connections: CanvasRenderConnection[];
  selectedNodeId: string | null;
  canDeleteConnections: boolean;
  onRequestDeleteConnection: (connectionId: string) => void;
  traversedConnectionIds?: Set<string>;
}) {
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const incomingByTarget = useMemo(() => {
    const map = new Map<string, Connection[]>();
    connections.forEach((connection) => {
      if (!connection.targetNodeId || connection.isPlaceholder) return;
      map.set(connection.targetNodeId, [...(map.get(connection.targetNodeId) ?? []), connection]);
    });
    return map;
  }, [connections]);

  return (
    <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" fill="none">
      <defs>
        <filter id="connector-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.08" />
        </filter>
        <marker id="backend-lane-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill="#94A3B8" />
        </marker>
        <marker id="backend-lane-arrow-traversed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill={TRAVERSED_CONNECTION_COLOR} />
        </marker>
      </defs>
      {connections
        .slice()
        .sort((a, b) => {
          const aTraversed = traversedConnectionIds?.has(a.id) ? 1 : 0;
          const bTraversed = traversedConnectionIds?.has(b.id) ? 1 : 0;
          return aTraversed - bTraversed;
        })
        .map((connection) => {
        if (connection.isPlaceholder && !getConnectionBranchType(connection)) return null;
        const sourceNode = nodeById.get(connection.sourceNodeId);
        const targetNode = connection.targetNodeId ? (nodeById.get(connection.targetNodeId) ?? null) : null;
        if (!sourceNode) return null;
        const incoming = connection.targetNodeId ? (incomingByTarget.get(connection.targetNodeId) ?? []) : [];
        const incomingIndex = incoming.findIndex((candidate) => candidate.id === connection.id);
        return (
          <Connector
            key={connection.id}
            connection={connection}
            canDelete={canDeleteConnections}
            sourceNode={sourceNode}
            targetNode={targetNode}
            selectedNodeId={selectedNodeId}
            targetOffsetX={incomingTargetOffset(incomingIndex, incoming.length)}
            onRequestDeleteConnection={onRequestDeleteConnection}
            isTraversed={traversedConnectionIds?.has(connection.id) ?? false}
          />
        );
      })}
    </svg>
  );
}

function Connector({
  canDelete,
  connection,
  isTraversed,
  onRequestDeleteConnection,
  sourceNode,
  selectedNodeId,
  targetOffsetX,
  targetNode,
}: {
  canDelete: boolean;
  connection: CanvasRenderConnection;
  isTraversed: boolean;
  onRequestDeleteConnection: (connectionId: string) => void;
  sourceNode: CanvasRenderNode;
  selectedNodeId: string | null;
  targetOffsetX: number;
  targetNode: CanvasRenderNode | null;
}) {
  const isVirtual = connection.virtual === true;
  const isBackendLane = connection.backendLane === true;
  const branchType = getConnectionBranchType(connection);
  const sourceSize = canvasNodeDimensions(sourceNode);
  const targetSize = targetNode ? canvasNodeDimensions(targetNode) : sourceSize;
  const placeholderTarget = getBranchAnchorPoint(sourceNode, branchType, null);
  const normalAnchors = targetNode
    ? getNormalConnectorAnchors(sourceNode, targetNode, targetOffsetX, sourceSize, targetSize)
    : null;
  const branchTarget =
    branchType && targetNode
      ? { x: targetNode.position.x + targetSize.width / 2 + targetOffsetX, y: targetNode.position.y }
      : placeholderTarget;
  const source = branchType || !normalAnchors
    ? { x: sourceNode.position.x + sourceSize.width / 2, y: sourceNode.position.y + sourceSize.height }
    : normalAnchors.source;
  const target = branchType ? branchTarget : normalAnchors?.target ?? placeholderTarget;
  const hasTargetNode = Boolean(targetNode);
  const mid = branchType
    ? branchConnectorMidPoint(sourceNode, target, branchType, hasTargetNode)
    : normalAnchors?.mode === "side"
      ? sideConnectorMidPoint(source, target)
      : orthogonalMidPoint(source, target);
  const path = branchType
    ? null
    : normalAnchors?.mode === "side"
      ? sideConnectorPath(source, target)
      : orthogonalConnectorPath(source, target);
  const branchParts = branchType ? branchConnectorSplitPaths(sourceNode, target, branchType, hasTargetNode) : null;
  const branchAccent = Boolean(branchType) && selectedNodeId != null && (selectedNodeId === sourceNode.id || (targetNode ? selectedNodeId === targetNode.id : false));
  const combinedHitPath = branchParts ? `${branchParts.solidPath} ${branchParts.dashedPath}` : path ?? "";
  const branchDashStrokeClass = isTraversed ? "stroke-emerald-500" : branchAccent ? "stroke-orange-600" : "stroke-orange-400 group-hover:stroke-orange-500";
  const connectorStroke = isTraversed ? TRAVERSED_CONNECTION_COLOR : isBackendLane ? "#94A3B8" : CONNECTION_COLOR;
  const arrowMarker = isBackendLane ? (isTraversed ? "url(#backend-lane-arrow-traversed)" : "url(#backend-lane-arrow)") : undefined;

  return (
    <g className={cn("group", isVirtual ? "pointer-events-none" : "pointer-events-auto")}>
      {branchParts ? (
        <>
          <motion.path d={branchParts.solidPath} stroke={connectorStroke} strokeWidth={CONNECTION_WIDTH} strokeLinecap="round" strokeLinejoin="round" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.22 }} />
          <motion.path d={branchParts.dashedPath} stroke={isTraversed ? TRAVERSED_CONNECTION_COLOR : undefined} strokeWidth={CONNECTION_WIDTH} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={BRANCH_CONNECTOR_DASH} fill="none" className={cn("transition-[stroke] duration-150 ease-out", !isTraversed && branchDashStrokeClass)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: "easeOut" }} />
        </>
      ) : (
        <motion.path d={path ?? ""} stroke={connectorStroke} strokeWidth={CONNECTION_WIDTH} strokeLinecap="round" strokeLinejoin="round" fill="none" markerEnd={arrowMarker} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.22 }} />
      )}
      {!isVirtual ? <path d={combinedHitPath} stroke="transparent" strokeWidth={22} strokeLinecap="round" /> : null}
      {!isVirtual && !connection.isPlaceholder ? <ConnectionDropTarget connection={connection} x={mid.x} y={mid.y} /> : null}
      {canDelete && !isVirtual && !connection.isPlaceholder ? (
        <foreignObject x={mid.x - 12} y={mid.y - 12} width={24} height={24} className="overflow-visible">
          <button
            type="button"
            aria-label={`Delete branch starting at ${targetNode?.data.title ?? "node"}`}
            onClick={(event) => { event.stopPropagation(); onRequestDeleteConnection(connection.id); }}
            className="flex size-6 scale-90 items-center justify-center rounded-full border border-rose-100 bg-white text-rose-500 opacity-0 shadow-sm transition-all duration-150 hover:scale-110 hover:border-rose-200 hover:bg-rose-50 hover:shadow-md group-hover:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        </foreignObject>
      ) : null}
    </g>
  );
}

function ConnectionDropTarget({ connection, x, y }: { connection: Connection; x: number; y: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `connection-${connection.id}`,
    data: { target: { kind: "connection", connectionId: connection.id } satisfies DropTarget },
  });
  return (
    <foreignObject x={x - 44} y={y - 22} width={88} height={44} className="overflow-visible">
      <div ref={setNodeRef} className={cn("h-full w-full rounded-full border border-transparent transition-colors", isOver && "border-dashed border-nesy-muted bg-nesy-soft/60")} />
    </foreignObject>
  );
}

function incomingTargetOffset(index: number, total: number) {
  if (total <= 1 || index < 0) return 0;
  const offsets = [-12, 12, 24, -24, 36, -36];
  return offsets[index] ?? (index % 2 === 0 ? 1 : -1) * (24 + Math.ceil(index / 2) * 12);
}

function canvasNodeDimensions(node: CanvasRenderNode): { width: number; height: number } {
  if (node.virtual && (node.visualRole === "backend_header" || node.visualRole === "backend_lane")) {
    return getBackendLaneNodeDimensions(node);
  }
  return { width: NODE_WIDTH, height: NODE_HEIGHT };
}

function getNormalConnectorAnchors(
  sourceNode: WorkflowNode,
  targetNode: WorkflowNode,
  incomingOffset: number,
  sourceSize: { width: number; height: number },
  targetSize: { width: number; height: number },
) {
  const sourceCenter = { x: sourceNode.position.x + sourceSize.width / 2, y: sourceNode.position.y + sourceSize.height / 2 };
  const targetCenter = { x: targetNode.position.x + targetSize.width / 2, y: targetNode.position.y + targetSize.height / 2 };
  const useSideAnchors = Math.abs(targetCenter.x - sourceCenter.x) > sourceSize.width * 0.65 && Math.abs(targetCenter.y - sourceCenter.y) <= sourceSize.height * 1.25;
  if (!useSideAnchors) {
    return {
      mode: "vertical" as const,
      source: { x: sourceNode.position.x + sourceSize.width / 2, y: sourceNode.position.y + sourceSize.height },
      target: { x: targetNode.position.x + targetSize.width / 2 + incomingOffset, y: targetNode.position.y },
    };
  }
  const targetIsLeft = targetCenter.x < sourceCenter.x;
  const sideY = sourceCenter.y + incomingOffset;
  return {
    mode: "side" as const,
    source: { x: targetIsLeft ? sourceNode.position.x : sourceNode.position.x + sourceSize.width, y: sideY },
    target: { x: targetIsLeft ? targetNode.position.x + targetSize.width : targetNode.position.x, y: sideY },
  };
}

function sideConnectorPath(source: { x: number; y: number }, target: { x: number; y: number }) {
  return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
}

function sideConnectorMidPoint(source: { x: number; y: number }, target: { x: number; y: number }) {
  return { x: source.x + (target.x - source.x) / 2, y: source.y + (target.y - source.y) / 2 };
}

function orthogonalConnectorPath(source: { x: number; y: number }, target: { x: number; y: number }) {
  return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
}

function orthogonalMidPoint(source: { x: number; y: number }, target: { x: number; y: number }) {
  return { x: source.x + (target.x - source.x) / 2, y: source.y + Math.max(1, target.y - source.y) / 2 };
}

function getBranchAnchorPoint(sourceNode: WorkflowNode, branchType: BranchType | null, targetNode?: WorkflowNode | null) {
  const defaultY = sourceNode.position.y + NODE_HEIGHT + CONDITION_SPLIT_OFFSET_Y;
  if (branchType && targetNode) {
    return { x: targetNode.position.x + NODE_WIDTH / 2, y: Math.min(defaultY, targetNode.position.y - 36) };
  }
  return { x: sourceNode.position.x + NODE_WIDTH / 2 + (branchType === "true" ? -CONDITION_BRANCH_OFFSET : CONDITION_BRANCH_OFFSET), y: defaultY };
}

function branchConnectorSplitPaths(sourceNode: WorkflowNode, target: { x: number; y: number }, branchType: BranchType, hasTargetNode: boolean): { solidPath: string; dashedPath: string } {
  const sx = sourceNode.position.x + NODE_WIDTH / 2;
  const sy = sourceNode.position.y + NODE_HEIGHT;
  const branchAnchor = hasTargetNode ? { x: target.x, y: Math.min(sy + CONDITION_SPLIT_OFFSET_Y, target.y - 36) } : getBranchAnchorPoint(sourceNode, branchType, null);
  const jy = branchAnchor.y;
  const bx = branchAnchor.x;
  const r = BRANCH_CORNER_RADIUS;
  const horizSpan = Math.abs(bx - sx);
  const tailTooShort = hasTargetNode && Math.abs(target.y - jy) < r + 2;
  if (horizSpan < 2 * r + 6 || tailTooShort) {
    const solidSharp = `M ${sx} ${sy} L ${sx} ${jy}`;
    const dashedPath = hasTargetNode ? `M ${sx} ${jy} L ${bx} ${jy} L ${bx} ${target.y}` : `M ${sx} ${jy} L ${bx} ${jy}`;
    return { solidPath: solidSharp, dashedPath };
  }
  const turnEast = bx >= sx;
  const solidRounded = turnEast ? `M ${sx} ${sy} L ${sx} ${jy - r} Q ${sx} ${jy} ${sx + r} ${jy}` : `M ${sx} ${sy} L ${sx} ${jy - r} Q ${sx} ${jy} ${sx - r} ${jy}`;
  if (!hasTargetNode) {
    const dashedPath = turnEast ? `M ${sx + r} ${jy} L ${bx} ${jy}` : `M ${sx - r} ${jy} L ${bx} ${jy}`;
    return { solidPath: solidRounded, dashedPath };
  }
  const dashedPath = turnEast ? `M ${sx + r} ${jy} L ${bx - r} ${jy} Q ${bx} ${jy} ${bx} ${jy + r} L ${bx} ${target.y}` : `M ${sx - r} ${jy} L ${bx + r} ${jy} Q ${bx} ${jy} ${bx} ${jy + r} L ${bx} ${target.y}`;
  return { solidPath: solidRounded, dashedPath };
}

function branchConnectorMidPoint(sourceNode: WorkflowNode, target: { x: number; y: number }, branchType: BranchType, hasTargetNode: boolean) {
  const sx = sourceNode.position.x + NODE_WIDTH / 2;
  const branchAnchor = hasTargetNode ? { x: target.x, y: Math.min(sourceNode.position.y + NODE_HEIGHT + CONDITION_SPLIT_OFFSET_Y, target.y - 36) } : getBranchAnchorPoint(sourceNode, branchType, null);
  const bx = branchAnchor.x;
  const jy = branchAnchor.y;
  if (!hasTargetNode) return { x: sx + (bx - sx) / 2, y: jy };
  return { x: bx + (target.x - bx) / 2, y: jy + (target.y - jy) / 2 };
}

function WorkflowMiniMap({ nodes, viewport }: { nodes: WorkflowNode[]; viewport: ViewportState }) {
  const markers = useMemo(() => {
    if (nodes.length === 0) return [];
    const bounds = nodes.reduce((acc, node) => ({ minX: Math.min(acc.minX, node.position.x), minY: Math.min(acc.minY, node.position.y), maxX: Math.max(acc.maxX, node.position.x + NODE_WIDTH), maxY: Math.max(acc.maxY, node.position.y + NODE_HEIGHT) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    const mapWidth = 132;
    const mapHeight = 88;
    const padding = 10;
    const scale = Math.min((mapWidth - padding * 2) / Math.max(bounds.maxX - bounds.minX, NODE_WIDTH), (mapHeight - padding * 2) / Math.max(bounds.maxY - bounds.minY, NODE_HEIGHT));
    return nodes.map((node) => ({ id: node.id, x: padding + (node.position.x - bounds.minX) * scale, y: padding + (node.position.y - bounds.minY) * scale, width: Math.max(NODE_WIDTH * scale, 14), height: Math.max(NODE_HEIGHT * scale, 8) }));
  }, [nodes]);

  if (markers.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="pointer-events-none absolute bottom-24 right-5 z-20 hidden h-[104px] w-[148px] rounded-2xl border border-[#ECECF3] bg-[rgba(255,255,255,0.9)] p-2 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-[18px] sm:block"
      aria-hidden
    >
      <div className="relative h-full w-full overflow-hidden rounded-xl bg-slate-50/80">
        {markers.map((marker) => (
          <span key={marker.id} className="absolute rounded-[4px] border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]" style={{ left: marker.x, top: marker.y, width: marker.width, height: marker.height }} />
        ))}
        <span className="absolute rounded-[6px] border border-orange-300/70 bg-orange-100/30" style={{ left: 12 + Math.abs(viewport.x % 18), top: 10 + Math.abs(viewport.y % 14), width: 54, height: 34 }} />
      </div>
    </motion.div>
  );
}

function CanvasToolbarSeparator() {
  return <span className="mx-2 h-7 w-px shrink-0 bg-[#ECECF3]" aria-hidden />;
}

function CanvasToolbarButton({ active, children, danger, disabled, label, onClick }: { active?: boolean; children: ReactNode; danger?: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center text-[#475569] outline-none transition-all duration-150 ease-out",
        "[&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:stroke-[1.9]",
        active ? "rounded-[6px] bg-[#FFF4EC] text-[#F97316] shadow-[inset_0_0_0_1px_rgba(249,115,22,0.08)]" : cn("rounded-xl hover:-translate-y-0.5", danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-[#F8FAFC] hover:text-[#111827]"),
        "focus-visible:ring-2 focus-visible:ring-orange-200/80",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      {children}
    </button>
  );
}

function CanvasControls({ canvasTool, hasNodes, hasSelectedNode, isGridVisible, isMinimapVisible, onCanvasToolChange, onDuplicateNode, onFitToScreen, onRequestSelectedNodeDelete, onToggleGrid, onToggleMinimap, zoomPercent, onZoomIn, onZoomOut, editorLocked }: { canvasTool: CanvasPointerTool; hasNodes: boolean; hasSelectedNode: boolean; isGridVisible: boolean; isMinimapVisible: boolean; onCanvasToolChange: (tool: CanvasPointerTool) => void; onDuplicateNode: () => void; onFitToScreen: () => void; onRequestSelectedNodeDelete: () => void; onToggleGrid: () => void; onToggleMinimap: () => void; zoomPercent: number; onZoomIn: () => void; onZoomOut: () => void; editorLocked: boolean }) {
  if (!hasNodes) return null;
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-5 z-30 flex justify-center">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: "easeOut" }} className="pointer-events-auto flex h-16 max-w-full items-center overflow-x-auto rounded-[6px] border border-[#ECECF3] bg-[rgba(255,255,255,0.96)] px-3 py-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-[18px] [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden" role="toolbar" aria-label="Canvas toolbar">
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Interaction tools">
          <CanvasToolbarButton active={canvasTool === "move"} label="Select tool" onClick={() => onCanvasToolChange("move")}><MousePointer2 /></CanvasToolbarButton>
          <CanvasToolbarButton active={canvasTool === "hand"} label="Hand tool" onClick={() => onCanvasToolChange("hand")}><Hand /></CanvasToolbarButton>
        </div>
        <CanvasToolbarSeparator />
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Zoom controls">
          <CanvasToolbarButton label="Zoom out" onClick={onZoomOut}><ZoomOut /></CanvasToolbarButton>
          <span className="flex h-10 w-14 shrink-0 items-center justify-center text-center text-[15px] font-semibold tabular-nums text-[#334155] sm:w-[62px]">{zoomPercent}%</span>
          <CanvasToolbarButton label="Zoom in" onClick={onZoomIn}><ZoomIn /></CanvasToolbarButton>
        </div>
        <CanvasToolbarSeparator />
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Insert controls">
          <CanvasToolbarButton label="Duplicate selected node" disabled={editorLocked || !hasSelectedNode} onClick={onDuplicateNode}><Copy /></CanvasToolbarButton>
          <CanvasToolbarButton danger label="Delete selected node" disabled={editorLocked || !hasSelectedNode} onClick={onRequestSelectedNodeDelete}><Trash2 /></CanvasToolbarButton>
        </div>
        <CanvasToolbarSeparator />
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Layout and view controls">
          <CanvasToolbarButton label="Fit to screen" onClick={onFitToScreen}><Maximize2 /></CanvasToolbarButton>
          <CanvasToolbarButton active={isMinimapVisible} label="Toggle minimap" onClick={onToggleMinimap}><MapIcon /></CanvasToolbarButton>
          <CanvasToolbarButton active={isGridVisible} label="Toggle grid" onClick={onToggleGrid}><Grid3X3 /></CanvasToolbarButton>
        </div>
      </motion.div>
    </div>
  );
}

function WorkflowCanvasContentShimmer({ title }: { title: string }) {
  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#F8FAFC]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.45]" style={{ backgroundImage: `radial-gradient(circle, ${VIEWPORT_GRID_DOT} ${VIEWPORT_GRID_DOT_RADIUS_PX}px, transparent ${VIEWPORT_GRID_DOT_RADIUS_PX}px)`, backgroundSize: `${VIEWPORT_GRID_SPACING_PX}px ${VIEWPORT_GRID_SPACING_PX}px` }} />
      <div className="relative flex flex-1 items-center justify-center px-8 py-16">
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className="h-16 w-44 animate-pulse rounded-xl bg-slate-200/80 shadow-sm" />
            <div className="h-6 w-px bg-slate-200/90" />
            <div className="h-16 w-44 animate-pulse rounded-xl bg-slate-200/65 shadow-sm" />
            <div className="h-6 w-px bg-slate-200/90" />
            <div className="h-16 w-44 animate-pulse rounded-xl bg-slate-200/55 shadow-sm" />
            <div className="h-6 w-px bg-slate-200/90" />
            <div className="flex gap-12">
              <div className="h-14 w-36 animate-pulse rounded-xl bg-slate-200/45 shadow-sm" />
              <div className="h-14 w-36 animate-pulse rounded-xl bg-slate-200/45 shadow-sm" />
            </div>
          </div>
          <p className="mt-2 text-center text-sm font-medium text-slate-500">Loading workflow\u2026</p>
          <p className="-mt-3 text-center text-xs text-slate-400">{title}</p>
        </div>
      </div>
    </div>
  );
}
