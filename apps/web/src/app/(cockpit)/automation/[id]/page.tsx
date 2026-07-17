import { WorkflowEditorPage } from "./workflow-editor";

type WorkflowDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function WorkflowDetailPage({ params }: WorkflowDetailPageProps) {
  const { id } = await params;

  return <WorkflowEditorPage workflowId={id} />;
}
