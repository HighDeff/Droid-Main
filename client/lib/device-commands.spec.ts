import { describe, expect, it } from "vitest";
import { parseDeviceCommands } from "./device-commands";

describe("device command parser", () => {
  it("converts a reviewed command batch into allowlisted workflow steps", () => {
    expect(
      parseDeviceCommands('click 120,240\ntype "hello" at 300,400\nkey enter\nwait 500'),
    ).toMatchObject([
      { action: "click", x: 120, y: 240 },
      { action: "type_text", x: 300, y: 400, text: "hello" },
      { action: "press_key", keyPayload: "enter" },
      { action: "wait", delayMs: 500 },
    ]);
  });

  it("rejects arbitrary shell commands", () => {
    expect(() => parseDeviceCommands("rm -rf /tmp/example")).toThrow(
      "not an allowlisted device command",
    );
  });
});
