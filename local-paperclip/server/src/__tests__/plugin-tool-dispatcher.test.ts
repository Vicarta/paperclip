import { describe, expect, it, vi } from "vitest";
import { createPluginToolDispatcher } from "../services/plugin-tool-dispatcher.js";

describe("plugin tool dispatcher", () => {
  it("preserves plugin database ids when tools are registered", () => {
    const dispatcher = createPluginToolDispatcher();

    dispatcher.registerPluginTools(
      "paperclip.serper-agent-tools",
      {
        schemaVersion: "1",
        id: "paperclip.serper-agent-tools",
        displayName: "Serper",
        version: "0.1.0",
        runtime: { entry: "dist/worker.js" },
        tools: [
          {
            name: "google-search",
            displayName: "Google Search",
            description: "Search Google through Serper",
            parametersSchema: { type: "object" },
          },
        ],
      },
      "plugin-db-uuid-1",
    );

    const tool = dispatcher.getTool("paperclip.serper-agent-tools:google-search");
    expect(tool).not.toBeNull();
    expect(tool?.pluginId).toBe("paperclip.serper-agent-tools");
    expect(tool?.pluginDbId).toBe("plugin-db-uuid-1");
  });

  it("passes tool-level execution timeout to worker manager calls", async () => {
    const call = vi.fn(async () => ({ content: "ok" }));
    const dispatcher = createPluginToolDispatcher({
      workerManager: {
        isRunning: () => true,
        call,
      } as never,
    });

    dispatcher.registerPluginTools(
      "paperclip.bright-data-agent-tools",
      {
        schemaVersion: "1",
        id: "paperclip.bright-data-agent-tools",
        displayName: "Bright Data",
        version: "0.3.0",
        runtime: { entry: "dist/worker.js" },
        tools: [
          {
            name: "resolve-instagram-account-post-set",
            displayName: "Resolve Instagram Account Post Set",
            description: "Resolve canonical Instagram posts",
            parametersSchema: { type: "object" },
            executionTimeoutMs: 180000,
          },
        ],
      },
      "plugin-db-uuid-2",
    );

    await dispatcher.executeTool(
      "paperclip.bright-data-agent-tools:resolve-instagram-account-post-set",
      { handleOrUrl: "https://www.instagram.com/astrogen.com.ua/" },
      { agentId: "agent-1", runId: "run-1", companyId: "company-1", projectId: "project-1" },
    );

    expect(call).toHaveBeenCalledWith(
      "plugin-db-uuid-2",
      "executeTool",
      expect.objectContaining({
        toolName: "resolve-instagram-account-post-set",
      }),
      180000,
    );
  });
});
