import { AssistantWorkspace, AssistantView } from "@/components/assistant-workspace";

export default function Workspace({ view }: { view?: AssistantView }) {
  return <AssistantWorkspace view={view} />;
}

