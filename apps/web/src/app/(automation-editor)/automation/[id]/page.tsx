import { WorkflowEditorLoader } from "./workflow-editor-loader";

type WorkflowDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function WorkflowDetailPage({ params }: WorkflowDetailPageProps) {
  const { id } = await params;

  return <WorkflowEditorLoader workflowId={id} />;
}
