import { describe, expect, it } from "vitest";
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
});
