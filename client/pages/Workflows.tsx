import { WorkflowLibraryPanel } from "@/components/workflow-library-panel";
import { AutonomousWorkflowLearnerPanel } from "@/components/autonomous-workflow-learner-panel";

export default function Workflows() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 space-y-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="mb-2 text-2xl font-semibold">Autonomous Workflows & Learning Hub</h1>
          <p className="mb-6 text-slate-400">
            Self-learning engine detecting repeated action patterns, assembling live tasks, and executing low-level native PC commands.
          </p>
          <AutonomousWorkflowLearnerPanel />
        </div>
        <div>
          <h2 className="mb-2 text-xl font-semibold">Saved Workflows Library</h2>
          <WorkflowLibraryPanel />
        </div>
      </div>
    </main>
  );
}
