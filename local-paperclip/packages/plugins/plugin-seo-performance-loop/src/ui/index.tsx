import {
  usePluginData,
  type PluginSettingsPageProps,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";

type LoopOverview = {
  status: "ok";
  checkedAt: string;
  registryBackend: string;
  telemetrySource: string;
  registeredArticleCount: number;
  lastCollectionRun: { completedAt?: string; enabled?: boolean; note?: string } | null;
  lastDecisionRun: { completedAt?: string; evaluatedArticleCount?: number; note?: string } | null;
  configSnapshot: {
    propertyUrl: string | null;
    rankProvider: string | null;
    rankGeo: string | null;
    rankLanguage: string | null;
    weeklyReportTimezone: string | null;
    telegramReportMode: string | null;
    detailedReportChannel: string | null;
  };
  reportPolicy: {
    telegramMode: string;
    detailedChannel: string;
    detailedDeliveryReady: boolean;
  };
};

function OverviewCard({ title, compact }: { title: string; compact?: boolean }) {
  const { data, loading, error } = usePluginData<LoopOverview>("overview");

  if (loading) return <div>Loading SEO performance loop overview...</div>;
  if (error) return <div>Plugin error: {error.message}</div>;

  const gap = compact ? "0.35rem" : "0.75rem";

  return (
    <div style={{ display: "grid", gap }}>
      <strong>{title}</strong>
      <div>Status: {data?.status ?? "unknown"}</div>
      <div>Registry: {data?.registryBackend ?? "unknown"}</div>
      <div>Registered Articles: {data?.registeredArticleCount ?? 0}</div>
      <div>Telemetry: {data?.telemetrySource ?? "unknown"}</div>
      <div>GSC Property: {data?.configSnapshot.propertyUrl || "not configured"}</div>
      <div>Rank Provider: {data?.configSnapshot.rankProvider || "not configured"}</div>
      <div>
        Default Geo/Language: {data?.configSnapshot.rankGeo || "n/a"} /{" "}
        {data?.configSnapshot.rankLanguage || "n/a"}
      </div>
      <div>Last Collection Run: {data?.lastCollectionRun?.completedAt || "never"}</div>
      <div>
        Weekly Report: Telegram {data?.reportPolicy.telegramMode || "n/a"} /{" "}
        Detailed {data?.reportPolicy.detailedChannel || "n/a"}
        {data?.reportPolicy.detailedDeliveryReady === false ? " (email recipients missing)" : ""}
      </div>
      <div>
        Last Decision Run: {data?.lastDecisionRun?.completedAt || "never"}
        {typeof data?.lastDecisionRun?.evaluatedArticleCount === "number"
          ? ` (${data.lastDecisionRun.evaluatedArticleCount} articles)`
          : ""}
      </div>
      {!compact && (
        <div style={{ color: "#666" }}>
          This slice stores published-article registry records, telemetry snapshots,
          and weekly SEO decisions. External GSC/rank collection remains an integration boundary.
        </div>
      )}
    </div>
  );
}

export function SeoPerformanceDashboardWidget(_props: PluginWidgetProps) {
  return <OverviewCard title="SEO Performance Loop" compact />;
}

export function SeoPerformanceSettingsPage(_props: PluginSettingsPageProps) {
  return <OverviewCard title="SEO Performance Loop Settings" />;
}
