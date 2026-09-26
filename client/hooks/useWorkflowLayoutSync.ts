import { useState, useEffect, useRef, useCallback } from "react";
import { FlowNode, FlowEdge } from "../components/WorkflowFlowchartView";
import { toast } from "sonner";

export interface WorkflowLayoutPersistenceData {
  version: number;
  timestamp: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  metadata?: {
    totalNodes: number;
    totalEdges: number;
    viewport?: { x: number; y: number; zoom: number };
  };
}

export interface UseWorkflowLayoutSyncOptions {
  storageKey?: string;
  autoSyncDebounceMs?: number;
  enableCrossTabSync?: boolean;
  onSyncSuccess?: (data: WorkflowLayoutPersistenceData) => void;
  onSyncError?: (error: Error) => void;
}

export const DEFAULT_LAYOUT_STORAGE_KEY = "sightline_flowchart_layout_v2";

/**
 * Custom hook to synchronize workflow graph layout (node positions, data, and edge connections)
 * to localStorage with debounced persistence, cross-tab sync, and import/export capabilities.
 */
export function useWorkflowLayoutSync(
  initialNodes: FlowNode[],
  initialEdges: FlowEdge[],
  options: UseWorkflowLayoutSyncOptions = {}
) {
  const storageKey = options.storageKey || DEFAULT_LAYOUT_STORAGE_KEY;
  const autoSyncDebounceMs = options.autoSyncDebounceMs ?? 600;
  const enableCrossTabSync = options.enableCrossTabSync ?? true;

  // Primary Graph State
  const [nodes, setNodes] = useState<FlowNode[]>(initialNodes);
  const [edges, setEdges] = useState<FlowEdge[]>(initialEdges);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number | null>(null);
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(true);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef<boolean>(true);

  /**
   * Load saved layout from localStorage
   */
  const loadLayout = useCallback((): boolean => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setNodes(initialNodes);
        setEdges(initialEdges);
        setIsLoaded(true);
        return false;
      }

      const parsed: WorkflowLayoutPersistenceData = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        setNodes(parsed.nodes);
        setEdges(parsed.edges);
        setLastSavedTimestamp(parsed.timestamp || Date.now());
        setIsDirty(false);
        setIsLoaded(true);
        return true;
      }
    } catch (e) {
      console.warn("[useWorkflowLayoutSync] Failed to parse stored workflow layout:", e);
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
    setIsLoaded(true);
    return false;
  }, [storageKey, initialNodes, initialEdges]);

  /**
   * Save layout directly to localStorage
   */
  const saveLayout = useCallback(
    (customNodes?: FlowNode[], customEdges?: FlowEdge[], notify: boolean = false): boolean => {
      try {
        const nodesToSave = customNodes || nodes;
        const edgesToSave = customEdges || edges;
        const now = Date.now();

        const payload: WorkflowLayoutPersistenceData = {
          version: 2,
          timestamp: now,
          nodes: nodesToSave,
          edges: edgesToSave,
          metadata: {
            totalNodes: nodesToSave.length,
            totalEdges: edgesToSave.length,
          },
        };

        localStorage.setItem(storageKey, JSON.stringify(payload));
        setLastSavedTimestamp(now);
        setIsDirty(false);

        if (options.onSyncSuccess) {
          options.onSyncSuccess(payload);
        }

        if (notify) {
          toast.success("Workflow graph layout synchronized to local storage");
        }
        return true;
      } catch (err: any) {
        console.error("[useWorkflowLayoutSync] Save layout error:", err);
        if (options.onSyncError) {
          options.onSyncError(err);
        }
        if (notify) {
          toast.error("Failed to save workflow graph layout");
        }
        return false;
      }
    },
    [nodes, edges, storageKey, options]
  );

  /**
   * Reset layout back to default configuration
   */
  const resetLayout = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    try {
      localStorage.removeItem(storageKey);
      setIsDirty(false);
      setLastSavedTimestamp(Date.now());
      toast.info("Workflow graph reset to default topology");
    } catch (e) {
      console.warn("[useWorkflowLayoutSync] Reset failed:", e);
    }
  }, [initialNodes, initialEdges, storageKey]);

  /**
   * Update a specific node position and schedule debounced sync
   */
  const updateNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    setNodes((prevNodes) =>
      prevNodes.map((n) => (n.id === nodeId ? { ...n, x: Math.round(x), y: Math.round(y) } : n))
    );
    setIsDirty(true);
  }, []);

  /**
   * Update a specific node data fields
   */
  const updateNodeData = useCallback((nodeId: string, partialData: Partial<FlowNode["data"]>) => {
    setNodes((prevNodes) =>
      prevNodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...partialData } } : n))
    );
    setIsDirty(true);
  }, []);

  /**
   * Export layout as JSON string
   */
  const exportLayoutJson = useCallback((): string => {
    const payload: WorkflowLayoutPersistenceData = {
      version: 2,
      timestamp: Date.now(),
      nodes,
      edges,
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
      },
    };
    return JSON.stringify(payload, null, 2);
  }, [nodes, edges]);

  /**
   * Import layout from JSON string
   */
  const importLayoutJson = useCallback(
    (jsonString: string): boolean => {
      try {
        const parsed = JSON.parse(jsonString);
        if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
          saveLayout(parsed.nodes, parsed.edges, false);
          toast.success("Successfully imported workflow layout!");
          return true;
        } else {
          throw new Error("Invalid graph structure in JSON");
        }
      } catch (err: any) {
        toast.error(`Import failed: ${err.message}`);
        return false;
      }
    },
    [saveLayout]
  );

  // Initial load on mount
  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  // Debounced auto-save on node/edge changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!isLoaded || !isAutoSyncEnabled) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      saveLayout(nodes, edges, false);
    }, autoSyncDebounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [nodes, edges, isLoaded, isAutoSyncEnabled, autoSyncDebounceMs, saveLayout]);

  // Cross-tab synchronization listener
  useEffect(() => {
    if (!enableCrossTabSync) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const parsed: WorkflowLayoutPersistenceData = JSON.parse(e.newValue);
          if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
            setNodes(parsed.nodes);
            setEdges(parsed.edges);
            setLastSavedTimestamp(parsed.timestamp || Date.now());
            setIsDirty(false);
          }
        } catch (err) {
          console.warn("[useWorkflowLayoutSync] Error syncing from storage event:", err);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [storageKey, enableCrossTabSync]);

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    isLoaded,
    isDirty,
    lastSavedTimestamp,
    isAutoSyncEnabled,
    setIsAutoSyncEnabled,
    saveLayout,
    loadLayout,
    resetLayout,
    updateNodePosition,
    updateNodeData,
    exportLayoutJson,
    importLayoutJson,
  };
}
