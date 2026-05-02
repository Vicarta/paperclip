import type { CSSProperties } from "react";
import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";
import {
  DEFAULT_PERFEX_HEALTH_URL,
  DEFAULT_PERFEX_MCP_URL,
  PERFEX_ACTION_TYPES,
} from "../constants.js";

const stackStyle: CSSProperties = {
  display: "grid",
  gap: "14px",
};

const cardStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "16px",
  background: "var(--card, transparent)",
};

const codeStyle: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "12px",
  whiteSpace: "pre-wrap",
};

export function PerfexCrmSettingsPage(_props: PluginSettingsPageProps) {
  return (
    <div style={stackStyle}>
      <section style={cardStyle}>
        <h2>Perfex CRM MCP Handoff</h2>
        <p>
          Configure the MCP bearer token as a Paperclip secret. Keep task writes disabled
          until the final DiskInternals implementer assignment mapping is approved.
        </p>
      </section>
      <section style={cardStyle}>
        <h3>Defaults</h3>
        <div style={codeStyle}>
          {JSON.stringify(
            {
              perfexMcpUrl: DEFAULT_PERFEX_MCP_URL,
              perfexHealthUrl: DEFAULT_PERFEX_HEALTH_URL,
              enableTaskWrites: false,
              defaultDryRun: true,
              actionTypes: PERFEX_ACTION_TYPES,
            },
            null,
            2,
          )}
        </div>
      </section>
    </div>
  );
}
