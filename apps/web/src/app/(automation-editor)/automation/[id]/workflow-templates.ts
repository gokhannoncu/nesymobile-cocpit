import { WorkflowNodeType, type SourceHandle, type TargetHandle } from "./workflow-types";

export type WorkflowTemplateNode = {
  id: string;
  type: WorkflowNodeType;
};

export type WorkflowTemplateConnection = {
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: SourceHandle;
  targetHandle: TargetHandle;
  label?: "True" | "False";
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  subtitle: string;
  icon: string;
  tone: string;
  category: "Templates";
  nodes: WorkflowTemplateNode[];
  connections: WorkflowTemplateConnection[];
};

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "login-flow",
    name: "Login Flow",
    description: "Authentication, route, and stop list",
    subtitle: "Auth + Route + StopList",
    icon: "UserCheck",
    tone: "text-purple-600 bg-purple-50 border-purple-100",
    category: "Templates",
    nodes: [
      { id: "launch-app", type: WorkflowNodeType.LAUNCH_APP },
      { id: "if-login", type: WorkflowNodeType.IF_LOGIN },
      { id: "auth-login", type: WorkflowNodeType.AUTH_LOGIN },
      { id: "check-route", type: WorkflowNodeType.CHECK_ROUTE },
      { id: "select-route", type: WorkflowNodeType.SELECT_ROUTE },
      { id: "validate-stoplist", type: WorkflowNodeType.VALIDATE_STOPLIST },
    ],
    connections: [
      {
        sourceNodeId: "launch-app",
        targetNodeId: "if-login",
        sourceHandle: "default",
        targetHandle: "top",
      },
      {
        sourceNodeId: "if-login",
        targetNodeId: "check-route",
        sourceHandle: "true",
        targetHandle: "top",
        label: "True",
      },
      {
        sourceNodeId: "if-login",
        targetNodeId: "auth-login",
        sourceHandle: "false",
        targetHandle: "top",
        label: "False",
      },
      {
        sourceNodeId: "auth-login",
        targetNodeId: "check-route",
        sourceHandle: "default",
        targetHandle: "top",
      },
      {
        sourceNodeId: "check-route",
        targetNodeId: "validate-stoplist",
        sourceHandle: "true",
        targetHandle: "top",
        label: "True",
      },
      {
        sourceNodeId: "check-route",
        targetNodeId: "select-route",
        sourceHandle: "false",
        targetHandle: "top",
        label: "False",
      },
      {
        sourceNodeId: "select-route",
        targetNodeId: "validate-stoplist",
        sourceHandle: "default",
        targetHandle: "top",
      },
    ],
  },
];

export function getWorkflowTemplate(templateId: string) {
  return workflowTemplates.find((template) => template.id === templateId) ?? null;
}
