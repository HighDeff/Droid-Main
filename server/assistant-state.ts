import {
  Annotation,
  AssistantPlan,
  AssistantSession,
  AssistantWorkflow,
  OperationPack,
  ProgressEntry,
  SavedState,
  ScreenshotCapture,
  UserInstruction,
  WaitCondition,
  WaitConditionStatusEvent,
  AssistantExecution,
  FrameAnalysis,
} from "../shared/assistant";
import type { RecordedSession } from "../shared/recordings";
import { DurableStore, type StorageOptions } from "./durable-store";

type ResourceMap = {
  captures: ScreenshotCapture;
  instructions: UserInstruction;
  operationPacks: OperationPack;
  progress: ProgressEntry;
  savedStates: SavedState;
  plans: AssistantPlan;
  workflows: AssistantWorkflow;
  waitConditions: WaitCondition;
  conditionEvents: WaitConditionStatusEvent;
  executions: AssistantExecution;
  analyses: FrameAnalysis;
  recordings: RecordedSession;
};

const now = () => new Date().toISOString();
const createId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export class AssistantStateRepository {
  private readonly store: DurableStore;
  private sessions = new Map<string, AssistantSession>();
  private readonly resources: {
    [K in keyof ResourceMap]: Map<string, ResourceMap[K]>;
  } = {
    captures: new Map(),
    instructions: new Map(),
    operationPacks: new Map(),
    progress: new Map(),
    savedStates: new Map(),
    plans: new Map(),
    workflows: new Map(),
    waitConditions: new Map(),
    conditionEvents: new Map(),
    executions: new Map(),
    analyses: new Map(),
    recordings: new Map(),
  };

  constructor(options: StorageOptions = {}) {
    this.store = new DurableStore(options);
    this.load();
  }

  private load(forWrite = false) {
    this.sessions = new Map(
      (forWrite
        ? this.store.readCollectionForWrite<AssistantSession>("sessions")
        : this.store.readCollection<AssistantSession>("sessions"))
        .map((item) => [item.id, item]),
    );
    for (const kind of Object.keys(this.resources) as Array<
      keyof ResourceMap
    >) {
      this.loadResource(kind, forWrite);
    }
  }

  private loadResource<K extends keyof ResourceMap>(kind: K, forWrite = false) {
    const values = forWrite
      ? this.store.readCollectionForWrite<ResourceMap[K]>(kind)
      : this.store.readCollection<ResourceMap[K]>(kind);
    let assignedLegacyIds = false;
    const normalized = kind === "analyses"
      ? values.map((item, recordIndex) => {
          const analysis = item as FrameAnalysis;
          if (!analysis.id) assignedLegacyIds = true;
          const analysisId = analysis.id || `legacy_analysis_${recordIndex + 1}`;
          const rawOcr = Array.isArray(analysis.ocrText)
            ? analysis.ocrText
            : analysis.ocrText == null
              ? []
              : [analysis.ocrText];
          return {
            ...analysis,
            id: analysisId,
            ocrText: rawOcr.flatMap((entry, index) => {
              if (typeof entry === "string") {
                return [{ id: `${analysisId}_legacy_ocr_${index + 1}`, text: entry }];
              }
              if (entry && typeof entry === "object" && typeof (entry as any).text === "string") {
                return [{
                  id: String((entry as any).id || `${analysisId}_legacy_ocr_${index + 1}`),
                  text: (entry as any).text,
                }];
              }
              return [];
            }),
            notes: Array.isArray(analysis.notes)
              ? analysis.notes.map(String)
              : analysis.notes == null
                ? []
                : [String(analysis.notes)],
            regionsOfInterest: Array.isArray(analysis.regionsOfInterest)
              ? analysis.regionsOfInterest
              : [],
            detectedElements: Array.isArray(analysis.detectedElements)
              ? analysis.detectedElements
              : [],
          } as ResourceMap[K];
        })
      : values;
    if (kind === "analyses" && assignedLegacyIds) {
      this.store.writeCollection(kind, normalized);
    }
    this.resources[kind] = new Map(
      normalized.map((item) => [item.id, item]),
    ) as (typeof this.resources)[K];
  }

  private persist(kinds?: Array<keyof ResourceMap | "sessions">) {
    const selected = kinds ?? [
      "sessions",
      ...(Object.keys(this.resources) as Array<keyof ResourceMap>),
    ];
    if (selected.includes("sessions")) {
      this.store.writeCollection("sessions", [...this.sessions.values()]);
    }
    for (const kind of selected.filter(
      (entry): entry is keyof ResourceMap => entry !== "sessions",
    )) {
      this.store.writeCollection(kind, [...this.resources[kind].values()]);
    }
  }

  listSessions(): AssistantSession[] {
    this.load();
    return [...this.sessions.values()];
  }

  getSession(id: string): AssistantSession | undefined {
    this.load();
    return this.sessions.get(id);
  }

  createSession(
    input: Omit<AssistantSession, "id" | "createdAt" | "updatedAt">,
  ): AssistantSession {
    this.sessions = new Map(
      this.store
        .readCollectionForWrite<AssistantSession>("sessions")
        .map((item) => [item.id, item]),
    );
    const timestamp = now();
    const session = {
      ...input,
      id: createId("session"),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.sessions.set(session.id, session);
    this.persist(["sessions"]);
    return session;
  }

  updateSession(
    id: string,
    updates: Partial<
      Pick<AssistantSession, "project" | "status" | "goals" | "savedStateIds">
    >,
  ): AssistantSession | undefined {
    this.sessions = new Map(
      this.store
        .readCollectionForWrite<AssistantSession>("sessions")
        .map((item) => [item.id, item]),
    );
    const session = this.sessions.get(id);
    if (!session) return undefined;
    const updated = { ...session, ...updates, updatedAt: now() };
    this.sessions.set(id, updated);
    this.persist(["sessions"]);
    return updated;
  }

  deleteSession(id: string): boolean {
    this.load(true);
    if (!this.sessions.delete(id)) return false;
    for (const resourceMap of Object.values(this.resources)) {
      for (const [resourceId, resource] of resourceMap) {
        if (
          "sessionId" in resource &&
          (resource as { sessionId?: string }).sessionId === id
        ) {
          resourceMap.delete(resourceId);
        }
      }
    }
    this.persist();
    return true;
  }

  listResource<K extends keyof ResourceMap>(
    kind: K,
    sessionId: string,
  ): ResourceMap[K][] {
    this.load();
    return [...this.resources[kind].values()].filter(
      (resource) =>
        "sessionId" in resource &&
        (resource as { sessionId?: string }).sessionId === sessionId,
    );
  }

  getResource<K extends keyof ResourceMap>(
    kind: K,
    id: string,
    sessionId: string,
  ): ResourceMap[K] | undefined {
    this.load();
    const resource = this.resources[kind].get(id);
    return resource &&
      "sessionId" in resource &&
      (resource as { sessionId?: string }).sessionId === sessionId
      ? resource
      : undefined;
  }

  findExecution(id: string): AssistantExecution | undefined {
    this.load();
    return this.resources.executions.get(id);
  }

  createResource<K extends keyof ResourceMap>(
    kind: K,
    sessionId: string,
    input: unknown,
  ): ResourceMap[K] {
    this.loadResource(kind, true);
    const timestamp = now();
    const inputRecord = input as Record<string, unknown>;
    const resource = {
      ...inputRecord,
      id: createId(kind),
      sessionId,
      createdAt: timestamp,
      ...(kind === "captures"
        ? {
            capturedAt: inputRecord.capturedAt ?? timestamp,
            annotations: (
              (inputRecord.annotations as Array<Record<string, unknown>>) ?? []
            ).map((annotation) => ({
              ...annotation,
              id: annotation.id ?? createId("annotation"),
              ...(annotation.region && typeof annotation.region === "object"
                ? {
                    region: {
                      ...(annotation.region as Record<string, unknown>),
                      id:
                        (annotation.region as Record<string, unknown>).id ??
                        createId("region"),
                    },
                  }
                : {}),
            })),
          }
        : {}),
      ...(kind === "operationPacks" || kind === "workflows"
        ? { updatedAt: timestamp }
        : {}),
    } as ResourceMap[K];
    this.resources[kind].set(resource.id, resource);
    this.persist([kind]);
    return resource;
  }

  updateResource<K extends keyof ResourceMap>(
    kind: K,
    id: string,
    sessionId: string,
    updates: unknown,
  ): ResourceMap[K] | undefined {
    this.loadResource(kind, true);
    const candidate = this.resources[kind].get(id);
    const resource = candidate &&
      "sessionId" in candidate &&
      (candidate as { sessionId?: string }).sessionId === sessionId
      ? candidate
      : undefined;
    if (!resource) return undefined;
    const updated = {
      ...resource,
      ...(updates as Record<string, unknown>),
      ...(kind === "operationPacks" || kind === "workflows"
        ? { updatedAt: now() }
        : {}),
    } as ResourceMap[K];
    this.resources[kind].set(id, updated);
    this.persist([kind]);
    return updated;
  }

  deleteResource<K extends keyof ResourceMap>(
    kind: K,
    id: string,
    sessionId: string,
  ): boolean {
    this.loadResource(kind, true);
    const candidate = this.resources[kind].get(id);
    const exists = candidate &&
      "sessionId" in candidate &&
      (candidate as { sessionId?: string }).sessionId === sessionId;
    if (!exists) return false;
    const deleted = this.resources[kind].delete(id);
    this.persist([kind]);
    return deleted;
  }

  addAnnotation(
    captureId: string,
    sessionId: string,
    annotation: Omit<Annotation, "id">,
  ): ScreenshotCapture | undefined {
    const capture = this.getResource("captures", captureId, sessionId);
    if (!capture) return undefined;
    return this.updateResource("captures", captureId, sessionId, {
      annotations: [
        ...(capture.annotations || []),
        { ...annotation, id: createId("annotation") },
      ],
    });
  }

  listPlans(sessionId: string): AssistantPlan[] {
    return [...this.resources.plans.values()]
      .filter((plan) => plan.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getPlan(id: string, sessionId: string): AssistantPlan | undefined {
    return this.getResource("plans", id, sessionId);
  }

  createPlan(
    sessionId: string,
    plan: Omit<AssistantPlan, "id" | "sessionId" | "createdAt" | "updatedAt" | "title" | "goal" | "status" | "steps"> &
      Partial<Pick<AssistantPlan, "title" | "goal" | "status" | "steps">>,
  ): AssistantPlan {
    return this.createResource("plans", sessionId, {
      ...plan,
      title: plan.title ?? "Assistant plan",
      goal:
        plan.goal ??
        (typeof plan.instruction === "string"
          ? plan.instruction
          : plan.instruction?.text ?? "Complete the approved workflow"),
      status: plan.status ?? "draft",
      steps: Array.isArray(plan.steps) ? plan.steps : [],
    });
  }

  updatePlan(
    id: string,
    sessionId: string,
    updates: Partial<AssistantPlan>,
  ): AssistantPlan | undefined {
    return this.updateResource("plans", id, sessionId, updates);
  }

  listWorkflows(sessionId: string): AssistantWorkflow[] {
    return [...this.resources.workflows.values()]
      .filter((workflow) => workflow.sessionId === sessionId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getWorkflow(id: string, sessionId: string): AssistantWorkflow | undefined {
    return this.getResource("workflows", id, sessionId);
  }

  createWorkflow(
    sessionId: string,
    workflow: Omit<
      AssistantWorkflow,
      "id" | "sessionId" | "createdAt" | "updatedAt" | "steps"
    > & { steps?: AssistantWorkflow["steps"] },
  ): AssistantWorkflow {
    return this.createResource("workflows", sessionId, {
      ...workflow,
      steps: Array.isArray(workflow.steps) ? workflow.steps : [],
    });
  }

  updateWorkflow(
    id: string,
    sessionId: string,
    updates: Partial<AssistantWorkflow>,
  ): AssistantWorkflow | undefined {
    return this.updateResource("workflows", id, sessionId, updates);
  }

  listWaitConditions(sessionId: string): WaitCondition[] {
    return this.listResource("waitConditions", sessionId);
  }

  getWaitCondition(id: string, sessionId: string): WaitCondition | undefined {
    return this.getResource("waitConditions", id, sessionId);
  }

  createWaitCondition(
    sessionId: string,
    condition: WaitCondition,
  ): WaitCondition {
    return this.createResource("waitConditions", sessionId, condition);
  }

  listConditionEvents(sessionId: string): WaitConditionStatusEvent[] {
    return this.listResource("conditionEvents", sessionId).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp),
    );
  }

  addConditionEvent(
    sessionId: string,
    event: Omit<WaitConditionStatusEvent, "id" | "sessionId" | "timestamp">,
  ): WaitConditionStatusEvent {
    return this.createResource("conditionEvents", sessionId, event);
  }
}

export const assistantStateRepository = new AssistantStateRepository();
