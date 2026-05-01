import type { CSSProperties } from "react";
import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";

const stack: CSSProperties = {
  display: "grid",
  gap: "12px",
  maxWidth: "760px",
};

const card: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "14px",
};

export function DiskInternalsBigQueryGrowthSettingsPage(_props: PluginSettingsPageProps) {
  return (
    <div style={stack}>
      <h2>DiskInternals BigQuery Growth</h2>
      <div style={card}>
        <p>
          Configure BigQuery project, dataset, location, and credential secret in the
          plugin settings. Agents consume allowlisted tools only; raw SQL and
          credentials stay server-side.
        </p>
      </div>
    </div>
  );
}
