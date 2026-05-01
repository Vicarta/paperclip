// src/constants.ts
var DEFAULT_PERFEX_MCP_URL = "https://pxmc.aibizmate.com/mcp";
var DEFAULT_PERFEX_HEALTH_URL = "https://pxmc.aibizmate.com/healthz";
var PERFEX_ACTION_TYPES = [
  "seo_refresh",
  "cro_experiment",
  "internal_linking",
  "localization",
  "tracking",
  "indexing",
  "data_quality"
];

// src/ui/index.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var stackStyle = {
  display: "grid",
  gap: "14px"
};
var cardStyle = {
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "16px",
  background: "var(--card, transparent)"
};
var codeStyle = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "12px",
  whiteSpace: "pre-wrap"
};
function PerfexCrmSettingsPage(_props) {
  return /* @__PURE__ */ jsxs("div", { style: stackStyle, children: [
    /* @__PURE__ */ jsxs("section", { style: cardStyle, children: [
      /* @__PURE__ */ jsx("h2", { children: "Perfex CRM MCP Handoff" }),
      /* @__PURE__ */ jsx("p", { children: "Configure the MCP bearer token as a Paperclip secret. Keep task writes disabled until the DiskInternals project ID, manager ID, and assignee mapping are approved." })
    ] }),
    /* @__PURE__ */ jsxs("section", { style: cardStyle, children: [
      /* @__PURE__ */ jsx("h3", { children: "Defaults" }),
      /* @__PURE__ */ jsx("div", { style: codeStyle, children: JSON.stringify(
        {
          perfexMcpUrl: DEFAULT_PERFEX_MCP_URL,
          perfexHealthUrl: DEFAULT_PERFEX_HEALTH_URL,
          enableTaskWrites: false,
          defaultDryRun: true,
          actionTypes: PERFEX_ACTION_TYPES
        },
        null,
        2
      ) })
    ] })
  ] });
}
export {
  PerfexCrmSettingsPage
};
//# sourceMappingURL=index.js.map
