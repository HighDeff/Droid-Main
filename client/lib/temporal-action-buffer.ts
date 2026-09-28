export interface TemporalAction {
  id: string;
  timestamp: number;
  timeStr: string;
  type: string;
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  source: "user" | "ai" | "hardware";
  description: string;
}

export interface TemporalSnapshotBundle {
  id: string;
  imageUrl: string;
  capturedAt: number;
  note?: string;
  actionsBefore10s: TemporalAction[];
  actionsAfter10s: TemporalAction[];
  slotIndex: number;
  refinedByAi?: boolean;
}

const rollingActionHistory: TemporalAction[] = [];
const savedSnapshotBundles: TemporalSnapshotBundle[] = [];

// Record any action to rolling temporal buffer
export function recordTemporalAction(action: Omit<TemporalAction, "id" | "timestamp" | "timeStr">): TemporalAction {
  const item: TemporalAction = {
    ...action,
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    timeStr: new Date().toLocaleTimeString(),
  };

  rollingActionHistory.push(item);

  // Keep last 300 actions
  if (rollingActionHistory.length > 300) {
    rollingActionHistory.shift();
  }

  // Check any pending snapshots waiting for post-10s actions
  savedSnapshotBundles.forEach((bundle) => {
    if (item.timestamp > bundle.capturedAt && item.timestamp <= bundle.capturedAt + 10000) {
      if (!bundle.actionsAfter10s.some((a) => a.id === item.id)) {
        bundle.actionsAfter10s.push(item);
      }
    }
  });

  return item;
}

// Bundle snapshot with actions 10s before and prepare listener for 10s after
export function captureSnapshotWith10sBuffer(
  imageUrl: string,
  slotIndex: number = 0,
  note?: string
): TemporalSnapshotBundle {
  const now = Date.now();
  const pre10sTimestamp = now - 10000;

  const actionsBefore = rollingActionHistory.filter(
    (a) => a.timestamp >= pre10sTimestamp && a.timestamp <= now
  );

  const bundle: TemporalSnapshotBundle = {
    id: `bundle_${now}`,
    imageUrl,
    capturedAt: now,
    note: note || `Snapshot #${slotIndex + 1} with 10s pre/post action ledger`,
    actionsBefore10s: [...actionsBefore],
    actionsAfter10s: [],
    slotIndex,
  };

  savedSnapshotBundles.unshift(bundle);

  // Broadcast to 10 screenshots tab
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("add-10-screenshot", {
        detail: {
          slotIndex,
          imageUrl,
          bundle,
        },
      })
    );
  }

  // Also sync snapshot to AI backend
  fetch("/api/analyze-screenshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageData: imageUrl,
      context: {
        actionsBeforeCount: actionsBefore.length,
        slotIndex,
        timestamp: now,
      },
    }),
  }).catch(() => {});

  return bundle;
}

export function getSavedSnapshotBundles(): TemporalSnapshotBundle[] {
  return savedSnapshotBundles;
}
