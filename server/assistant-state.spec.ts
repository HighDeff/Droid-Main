import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AssistantStateRepository } from "./assistant-state";

describe("AssistantStateRepository", () => {
  it("reloads sessions after a transient read failure before creating a session", () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-state-retry-"));
    const sessionsPath = path.join(storageDir, "sessions.json");
    try {
      fs.mkdirSync(sessionsPath);
      const repository = new AssistantStateRepository({ storageDir });
      fs.rmdirSync(sessionsPath);
      const timestamp = new Date().toISOString();
      fs.writeFileSync(
        sessionsPath,
        JSON.stringify([{
          id: "existing-session",
          project: { id: "existing-project", name: "Existing" },
          status: "active",
          goals: [],
          savedStateIds: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        }]),
      );

      repository.createSession({
        project: { id: "new-project", name: "New" },
        status: "active",
        goals: [],
        savedStateIds: [],
      });

      const persisted = JSON.parse(fs.readFileSync(sessionsPath, "utf-8"));
      expect(persisted.map((session: { id: string }) => session.id)).toContain("existing-session");
      expect(persisted).toHaveLength(2);
    } finally {
      fs.rmSync(storageDir, { recursive: true, force: true });
    }
  });

  it("blocks session creation while the sessions collection remains unreadable", () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-state-blocked-"));
    const sessionsPath = path.join(storageDir, "sessions.json");
    try {
      fs.mkdirSync(sessionsPath);
      const repository = new AssistantStateRepository({ storageDir });

      expect(() => repository.createSession({
        project: { id: "blocked-project", name: "Blocked" },
        status: "active",
        goals: [],
        savedStateIds: [],
      })).toThrow("Restore access");
      expect(fs.statSync(sessionsPath).isDirectory()).toBe(true);
    } finally {
      fs.rmSync(storageDir, { recursive: true, force: true });
    }
  });

  it("migrates legacy OCR strings and scalar notes without losing text", () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-state-"));
    try {
      fs.writeFileSync(
        path.join(storageDir, "analyses.json"),
        JSON.stringify([
          {
            id: "legacy-analysis",
            sessionId: "legacy-session",
            timestamp: new Date().toISOString(),
            summary: "Legacy frame",
            confidence: 0.5,
            ocrText: ["Submit", { id: "ocr_2", text: "Cancel" }],
            notes: "Needs review",
          },
        ]),
      );

      const repository = new AssistantStateRepository({ storageDir });
      const [analysis] = repository.listResource("analyses", "legacy-session");

      expect(analysis.ocrText).toEqual([
        { id: "legacy-analysis_legacy_ocr_1", text: "Submit" },
        { id: "ocr_2", text: "Cancel" },
      ]);
      expect(analysis.notes).toEqual(["Needs review"]);
    } finally {
      fs.rmSync(storageDir, { recursive: true, force: true });
    }
  });

  it("quarantines corrupt data and rebuilds the collection", () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-state-corrupt-"));
    try {
      fs.writeFileSync(path.join(storageDir, "analyses.json"), "{not-json");
      const repository = new AssistantStateRepository({ storageDir });

      expect(repository.listResource("analyses", "session")).toEqual([]);
      expect(() =>
        repository.createSession({
          project: {
            id: "project-recovery",
            name: "Recovery test",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          status: "active",
          goals: [],
          savedStateIds: [],
        }),
      ).not.toThrow();
      expect(() =>
        repository.createResource("analyses", "session", {
          summary: "Rebuilt after quarantine",
          confidence: 0,
          ocrText: [],
          notes: [],
          regionsOfInterest: [],
          detectedElements: [],
          timestamp: new Date().toISOString(),
        }),
      ).not.toThrow();
      expect(
        fs.readdirSync(storageDir).some((name) => name.startsWith("analyses.json.corrupt.")),
      ).toBe(true);
      expect(JSON.parse(fs.readFileSync(path.join(storageDir, "analyses.json"), "utf-8"))).toHaveLength(1);
    } finally {
      fs.rmSync(storageDir, { recursive: true, force: true });
    }
  });

  it("creates sessions and isolates resources by session", () => {
    const repository = new AssistantStateRepository({ mode: "memory" });
    const first = repository.createSession({
      project: {
        id: "project-one",
        name: "First project",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      status: "active",
      goals: [],
      savedStateIds: [],
    });
    const second = repository.createSession({
      project: {
        id: "project-two",
        name: "Second project",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      status: "active",
      goals: [],
      savedStateIds: [],
    });

    repository.createResource("progress", first.id, {
      kind: "accomplishment",
      message: "Created the first workflow",
    });

    expect(repository.listResource("progress", first.id)).toHaveLength(1);
    expect(repository.listResource("progress", second.id)).toHaveLength(0);
  });

  it("updates and deletes a resource only for its owning session", () => {
    const repository = new AssistantStateRepository({ mode: "memory" });
    const session = repository.createSession({
      project: {
        id: "project",
        name: "Project",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      status: "active",
      goals: [],
      savedStateIds: [],
    });
    const entry = repository.createResource("progress", session.id, {
      kind: "obstacle",
      message: "Initial obstacle",
    });

    expect(
      repository.updateResource("progress", entry.id, "other-session", {
        message: "Wrong owner",
      }),
    ).toBeUndefined();
    expect(
      repository.updateResource("progress", entry.id, session.id, {
        message: "Resolved obstacle",
      })?.message,
    ).toBe("Resolved obstacle");
    expect(
      repository.deleteResource("progress", entry.id, "other-session"),
    ).toBe(false);
    expect(repository.deleteResource("progress", entry.id, session.id)).toBe(
      true,
    );
  });

  it("cascades resource cleanup when a session is deleted", () => {
    const repository = new AssistantStateRepository({ mode: "memory" });
    const session = repository.createSession({
      project: {
        id: "project",
        name: "Project",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      status: "active",
      goals: [],
      savedStateIds: [],
    });
    repository.createResource("instructions", session.id, {
      text: "Keep this instruction",
    });

    expect(repository.deleteSession(session.id)).toBe(true);
    expect(repository.listResource("instructions", session.id)).toHaveLength(0);
    expect(repository.deleteSession(session.id)).toBe(false);
  });

  it("stores plans within their owning session and preserves approval state", () => {
    const repository = new AssistantStateRepository({ mode: "memory" });
    const session = repository.createSession({
      project: {
        id: "project",
        name: "Project",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      status: "active",
      goals: [],
      savedStateIds: [],
    });
    const plan = repository.createPlan(session.id, {
      instruction: {
        id: "instruction",
        sessionId: session.id,
        text: "Review the screen",
        createdAt: new Date().toISOString(),
      },
      sourceCaptureIds: [],
      sourceNoteIds: [],
      clarifications: [],
      steps: [],
      prerequisites: [],
      risks: [],
      timing: "when_ready",
      confidence: 0.7,
      approvalState: "proposed",
    });

    expect(repository.listPlans(session.id)).toHaveLength(1);
    expect(
      repository.updatePlan(plan.id, session.id, {
        approvalState: "approved",
      })?.approvalState,
    ).toBe("approved");
    expect(repository.getPlan(plan.id, "other-session")).toBeUndefined();
  });

  it("stores workflow scheduling state and isolates it by session", () => {
    const repository = new AssistantStateRepository({ mode: "memory" });
    const session = repository.createSession({
      project: {
        id: "project",
        name: "Project",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      status: "active",
      goals: [],
      savedStateIds: [],
    });
    const workflow = repository.createWorkflow(session.id, {
      name: "Nightly verification",
      status: "paused",
      operationPackIds: [],
      checkpointIds: [],
      repeatCount: 3,
      schedule: {
        enabled: true,
        nextRunAt: "2030-01-01T00:00:00.000Z",
        timezone: "UTC",
      },
      pauseResumePolicy: {
        pauseOnError: true,
        allowResume: true,
        resumeMode: "scheduled",
      },
      goals: [],
    });

    expect(repository.listWorkflows(session.id)).toEqual([workflow]);
    expect(
      repository.getWorkflow(workflow.id, "other-session"),
    ).toBeUndefined();
    expect(
      repository.updateWorkflow(workflow.id, session.id, {
        repeatCount: 4,
      })?.repeatCount,
    ).toBe(4);
  });
});
