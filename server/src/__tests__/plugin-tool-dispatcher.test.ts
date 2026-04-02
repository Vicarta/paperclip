import { describe, expect, it, vi } from "vitest";
import { createPluginToolDispatcher } from "../services/plugin-tool-dispatcher.js";

describe("plugin tool dispatcher", () => {
  it("registers tools with plugin db ids for execution and db-id filtering", async () => {
    const workerManager = {
      isRunning: vi.fn().mockReturnValue(true),
      call: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] }),
    };

    const dispatcher = createPluginToolDispatcher({ workerManager: workerManager as any });
    dispatcher.registerPluginTools(
      "paperclip.exa-agent-tools",
      {
        id: "paperclip.exa-agent-tools",
        version: "0.1.0",
        name: "Exa Agent Tools",
        description: "Exa-backed tools",
        tools: [
          {
            name: "web-search",
            displayName: "Exa Web Search",
            description: "Search the web",
            parametersSchema: {
              type: "object",
              required: ["query"],
              properties: { query: { type: "string" } },
            },
          },
        ],
      },
      "1771e776-4041-474b-9cde-56667195bd2e",
    );

    expect(
      dispatcher.listToolsForAgent({ pluginId: "1771e776-4041-474b-9cde-56667195bd2e" }),
    ).toEqual([
      expect.objectContaining({
        name: "paperclip.exa-agent-tools:web-search",
        pluginId: "1771e776-4041-474b-9cde-56667195bd2e",
      }),
    ]);

    await dispatcher.executeTool(
      "paperclip.exa-agent-tools:web-search",
      { query: "astrogen money competitors" },
      {
        agentId: "a7e517e4-62dd-4261-b8db-e23cff3d2a45",
        runId: "77af20af-3427-42cc-be1e-88cab30228fa",
        companyId: "c33f6b81-5ced-4270-9288-b46a32f6337a",
        projectId: "db6ccac5-25c7-46b0-a49f-7c614dfe7973",
      },
    );

    expect(workerManager.isRunning).toHaveBeenCalledWith("1771e776-4041-474b-9cde-56667195bd2e");
  });
});
