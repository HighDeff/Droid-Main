import { Request, Response, Router } from "express";
import { z } from "zod";
import { methodLearningSystem, type LearningContext } from "../method-learning";
import { assistantStateRepository } from "../assistant-state";

const router = Router();

const learnBody = z.object({
  executionId: z.string().min(1),
  sessionId: z.string().min(1),
  context: z.object({
    applicationName: z.string().optional(),
    screenLayout: z.string().optional(),
    userIntent: z.string().min(1),
    environmentalFactors: z.array(z.string()).default([]),
    timeOfDay: z.string().default(new Date().toISOString()),
    deviceType: z.string().default("desktop"),
  }),
});

// Learn from an execution
router.post("/learn", async (req: Request, res: Response) => {
  try {
    const body = learnBody.parse(req.body);
    
    const context: LearningContext = {
      sessionId: body.sessionId,
      applicationName: body.context.applicationName,
      screenLayout: body.context.screenLayout || "unknown",
      userIntent: body.context.userIntent,
      environmentalFactors: body.context.environmentalFactors,
      timeOfDay: body.context.timeOfDay,
      deviceType: body.context.deviceType,
    };
    
    const execution = assistantStateRepository.getResource(
      "executions",
      body.executionId,
      body.sessionId,
    );
    if (!execution) {
      return res.status(404).json({ success: false, error: "Execution not found in this session" });
    }
    if (!new Set(["completed", "failed", "cancelled"]).has(execution.status)) {
      return res.status(409).json({
        success: false,
        error: "Learning requires a terminal execution so the result is known",
      });
    }
    const plan = assistantStateRepository.getPlan(execution.planId, body.sessionId);
    if (!plan) {
      return res.status(404).json({ success: false, error: "Execution plan not found" });
    }
    const method = methodLearningSystem.learnFromExecution(execution, plan, context);
    const suggestions = methodLearningSystem.suggestOptimizations(method.id);
    
    res.json({ 
      success: true, 
      method,
      suggestions,
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    res.status(status).json({
      success: false, 
      error: error instanceof Error ? error.message : "Failed to learn from execution" 
    });
  }
});

// Get best method for a context
router.post("/best-method", async (req: Request, res: Response) => {
  try {
    const body = z.object({
      context: z.object({
        sessionId: z.string().min(1),
        applicationName: z.string().optional(),
        userIntent: z.string().min(1),
        screenLayout: z.string().optional(),
        deviceType: z.string().default("desktop"),
      }),
    }).parse(req.body);
    
    const context: LearningContext = {
      sessionId: body.context.sessionId,
      applicationName: body.context.applicationName,
      screenLayout: body.context.screenLayout || "unknown",
      userIntent: body.context.userIntent,
      environmentalFactors: [],
      timeOfDay: new Date().toISOString(),
      deviceType: body.context.deviceType,
    };
    
    const bestMethod = methodLearningSystem.getBestMethodForContext(context);
    
    res.json({ 
      success: true, 
      bestMethod,
      hasMethod: bestMethod !== null,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get best method" 
    });
  }
});

// Compare two methods
router.post("/compare", async (req: Request, res: Response) => {
  try {
    const body = z.object({
      methodId1: z.string().min(1),
      methodId2: z.string().min(1),
    }).parse(req.body);
    
    const comparison = methodLearningSystem.compareMethods(body.methodId1, body.methodId2);
    
    res.json({ success: true, comparison });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to compare methods" 
    });
  }
});

// Get optimization suggestions for a method
router.get("/optimize/:methodId", async (req: Request, res: Response) => {
  try {
    const { methodId } = req.params;
    const suggestions = methodLearningSystem.suggestOptimizations(methodId);
    
    res.json({ success: true, suggestions });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get optimization suggestions" 
    });
  }
});

// Get detailed method insights
router.get("/insights/:methodId", async (req: Request, res: Response) => {
  try {
    const { methodId } = req.params;
    const insights = methodLearningSystem.getMethodInsights(methodId);
    
    if (!insights) {
      return res.status(404).json({ 
        success: false, 
        error: "Method not found" 
      });
    }
    
    res.json({ success: true, insights });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get method insights" 
    });
  }
});

// Get all learned methods
router.get("/methods", async (_req: Request, res: Response) => {
  try {
    const methods = methodLearningSystem.getAllMethods();
    
    res.json({ success: true, methods, count: methods.length });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get methods" 
    });
  }
});

// Get specific method
router.get("/method/:methodId", async (req: Request, res: Response) => {
  try {
    const { methodId } = req.params;
    const method = methodLearningSystem.getMethod(methodId);
    
    if (!method) {
      return res.status(404).json({ 
        success: false, 
        error: "Method not found" 
      });
    }
    
    res.json({ success: true, method });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get method" 
    });
  }
});

export { router as methodLearningRouter };
