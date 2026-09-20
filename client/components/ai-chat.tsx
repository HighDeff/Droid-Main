import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2, RotateCcw } from "lucide-react";
import { ensureAssistantSession } from "@/lib/assistant-session";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: Date;
}

class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new RequestError(
      body?.error || `Assistant request failed (${response.status})`,
      response.status,
    );
  }
  if (!body) throw new Error("Assistant returned an empty response");
  return body;
}

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize with a welcome message
  useEffect(() => {
    setMessages([
      {
        id: "1",
        content:
          "Hello! I'm your AI assistant. How can I help you with your automation today?",
        role: "assistant",
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const messageText = (overrideText !== undefined ? overrideText : input).trim();
    if (!messageText) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      role: "user",
      timestamp: new Date(),
    };

    if (overrideText === undefined) {
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
    }
    setIsLoading(true);

    try {
      const sessionId = await ensureAssistantSession({
        project: { name: "Automation chat" },
      });

      const planned = await requestJson("/api/assistant/plans", {
        method: "POST",
        body: JSON.stringify({ sessionId, instructionText: messageText }),
      });
      const steps: Array<{ order: number; title: string }> = planned.plan?.steps;
      if (!Array.isArray(steps) || steps.length === 0) {
        throw new Error("The planner returned no reviewable steps.");
      }
      const stepSummary = steps
        .map((step: { order: number; title: string }) => `${step.order}. ${step.title}`)
        .join("\n");

      const response: Message = {
        id: (Date.now() + 1).toString(),
        content: `Prepared a ${steps.length}-step draft for review. Nothing has executed yet.\n${stepSummary}\nOpen Automation to edit and approve it.`,
        role: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, response]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: "error-" + Date.now(),
        content:
          error instanceof Error
            ? `I could not prepare that plan: ${error.message}`
            : "I could not prepare that plan. Please try again.",
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateLast = () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) return;
    handleSendMessage(undefined, lastUserMessage.content);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {messages.map((message, idx) => {
              const isLastAssistant =
                message.role === "assistant" &&
                idx === messages.length - 1 &&
                messages.some((m) => m.role === "user");

              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`flex items-start max-w-[85%] p-3 rounded-lg ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <Bot className="w-5 h-5 mr-2 mt-0.5 text-muted-foreground shrink-0" />
                    )}
                    {message.role === "user" && (
                      <User className="w-5 h-5 mr-2 mt-0.5 text-primary-foreground shrink-0" />
                    )}
                    <p className="text-sm whitespace-pre-line">{message.content}</p>
                  </div>

                  {isLastAssistant && (
                    <div className="mt-1 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRegenerateLast}
                        disabled={isLoading}
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                        title="Regenerate AI response with previous prompt"
                      >
                        <RotateCcw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                        <span>Regenerate</span>
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center p-3 rounded-lg bg-muted">
                  <Bot className="w-5 h-5 mr-2 text-muted-foreground" />
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      <form onSubmit={(e) => handleSendMessage(e)} className="p-4 border-t">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
