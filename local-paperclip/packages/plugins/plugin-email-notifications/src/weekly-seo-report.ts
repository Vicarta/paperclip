type ReportMetric = {
  label: string;
  current: string;
  previous: string;
  interpretation: string;
};

type ReportAction = {
  issueId: string;
  title: string;
  owner: string;
  status: string;
  nextStep: string;
  url: string;
};

type ReportWatch = {
  title: string;
  reason: string;
  nextReview: string;
};

type ReportDetail = {
  title: string;
  body: string;
};

export type WeeklySeoEmailReport = {
  period: string;
  executiveSummary: string;
  metrics: ReportMetric[];
  actions: ReportAction[];
  watchItems: ReportWatch[];
  noActionReason: string;
  ownerAction: string;
  details: ReportDetail[];
};

export type DetailedReportEmailBody = {
  text: string;
  html: string;
  format: "structured_html" | "provided_html" | "generated_html";
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown, max = 4_000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function arrayValue(value: unknown, max = 20): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.slice(0, max).map(objectValue).filter((item) => Object.keys(item).length > 0)
    : [];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeHttpUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function paragraphs(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p style="margin:0 0 12px;line-height:1.55;color:#25313c;">${escapeHtml(part).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function parseReport(value: unknown): WeeklySeoEmailReport | null {
  const input = objectValue(value);
  if (!Object.keys(input).length) return null;

  const period = stringValue(input.period, 300);
  const executiveSummary = stringValue(input.executiveSummary, 2_500);
  if (!period || !executiveSummary) {
    throw new Error("structured SEO report requires period and executiveSummary");
  }

  return {
    period,
    executiveSummary,
    metrics: arrayValue(input.metrics, 15).map((item) => ({
      label: stringValue(item.label, 200),
      current: stringValue(item.current, 100),
      previous: stringValue(item.previous, 100),
      interpretation: stringValue(item.interpretation, 500),
    })).filter((item) => item.label && item.current),
    actions: arrayValue(input.actions, 12).map((item) => ({
      issueId: stringValue(item.issueId, 50),
      title: stringValue(item.title, 300),
      owner: stringValue(item.owner, 150),
      status: stringValue(item.status, 100),
      nextStep: stringValue(item.nextStep, 700),
      url: safeHttpUrl(stringValue(item.url, 1_000)),
    })).filter((item) => item.title && item.nextStep),
    watchItems: arrayValue(input.watchItems, 12).map((item) => ({
      title: stringValue(item.title, 300),
      reason: stringValue(item.reason, 700),
      nextReview: stringValue(item.nextReview, 200),
    })).filter((item) => item.title && item.reason),
    noActionReason: stringValue(input.noActionReason, 1_500),
    ownerAction: stringValue(input.ownerAction, 1_000),
    details: arrayValue(input.details, 8).map((item) => ({
      title: stringValue(item.title, 300),
      body: stringValue(item.body, 3_000),
    })).filter((item) => item.title && item.body),
  };
}

function renderMetricRows(metrics: ReportMetric[]): string {
  return metrics.map((metric) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #dfe5e8;font-weight:600;">${escapeHtml(metric.label)}</td>
      <td style="padding:10px;border-bottom:1px solid #dfe5e8;white-space:nowrap;">${escapeHtml(metric.current)}</td>
      <td style="padding:10px;border-bottom:1px solid #dfe5e8;white-space:nowrap;color:#52616d;">${escapeHtml(metric.previous)}</td>
      <td style="padding:10px;border-bottom:1px solid #dfe5e8;color:#52616d;">${escapeHtml(metric.interpretation)}</td>
    </tr>`).join("");
}

function renderActions(actions: ReportAction[]): string {
  if (!actions.length) {
    return '<p style="margin:0;color:#52616d;">Нових завдань цього тижня немає.</p>';
  }

  return actions.map((action) => {
    const label = [action.issueId, action.title].filter(Boolean).join(" - ");
    const linkedLabel = action.url
      ? `<a href="${escapeHtml(action.url)}" style="color:#0b6b57;text-decoration:underline;">${escapeHtml(label)}</a>`
      : escapeHtml(label);
    const meta = [action.owner && `Виконавець: ${action.owner}`, action.status && `Статус: ${action.status}`]
      .filter(Boolean)
      .join(" · ");
    return `<div style="margin:0 0 12px;padding:14px;border:1px solid #dfe5e8;border-radius:6px;">
      <div style="font-weight:700;margin-bottom:6px;">${linkedLabel}</div>
      ${meta ? `<div style="font-size:13px;color:#52616d;margin-bottom:7px;">${escapeHtml(meta)}</div>` : ""}
      <div style="line-height:1.5;color:#25313c;">${escapeHtml(action.nextStep)}</div>
    </div>`;
  }).join("");
}

function renderWatchItems(items: ReportWatch[]): string {
  if (!items.length) return "";
  return `<h2 style="font-size:18px;margin:26px 0 12px;color:#17212b;">Що поки спостерігаємо</h2>
    ${items.map((item) => `<div style="margin:0 0 12px;">
      <strong>${escapeHtml(item.title)}</strong><br>
      <span style="color:#52616d;line-height:1.5;">${escapeHtml(item.reason)}${item.nextReview ? ` Наступна перевірка: ${escapeHtml(item.nextReview)}.` : ""}</span>
    </div>`).join("")}`;
}

function renderStructuredReport(report: WeeklySeoEmailReport): DetailedReportEmailBody {
  const metricSection = report.metrics.length
    ? `<h2 style="font-size:18px;margin:26px 0 12px;color:#17212b;">Основні показники</h2>
      <div style="overflow-x:auto;">
        <table role="presentation" style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead><tr style="background:#f3f6f5;text-align:left;">
            <th style="padding:10px;">Показник</th><th style="padding:10px;">Зараз</th><th style="padding:10px;">Було</th><th style="padding:10px;">Що це означає</th>
          </tr></thead>
          <tbody>${renderMetricRows(report.metrics)}</tbody>
        </table>
      </div>`
    : "";
  const details = report.details.length
    ? `<h2 style="font-size:18px;margin:26px 0 12px;color:#17212b;">Деталі</h2>${report.details.map((detail) => `<h3 style="font-size:15px;margin:18px 0 7px;color:#17212b;">${escapeHtml(detail.title)}</h3>${paragraphs(detail.body)}`).join("")}`
    : "";
  const ownerAction = `<div style="margin:24px 0 0;padding:14px;background:${report.ownerAction ? "#fff7df" : "#edf7f3"};border-left:4px solid ${report.ownerAction ? "#c98600" : "#0b6b57"};">
    <strong>${report.ownerAction ? "Що потрібно від вас" : "Від вас нічого не потрібно"}</strong>
    <div style="margin-top:6px;line-height:1.5;">${escapeHtml(report.ownerAction || "Paperclip продовжує роботу за призначеними завданнями.")}</div>
  </div>`;

  const html = `<!doctype html>
<html lang="uk"><body style="margin:0;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#17212b;">
  <div style="max-width:760px;margin:0 auto;padding:20px 12px;">
    <div style="background:#ffffff;border:1px solid #dfe5e8;border-radius:8px;padding:24px;">
      <div style="font-size:13px;color:#52616d;margin-bottom:8px;">${escapeHtml(report.period)}</div>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 14px;color:#17212b;">Щотижневий SEO/GEO звіт Astrogen</h1>
      ${paragraphs(report.executiveSummary)}
      <h2 style="font-size:18px;margin:26px 0 12px;color:#17212b;">Що Paperclip робить далі</h2>
      ${renderActions(report.actions)}
      ${metricSection}
      ${renderWatchItems(report.watchItems)}
      ${report.noActionReason ? `<h2 style="font-size:18px;margin:26px 0 12px;color:#17212b;">Чому деякі роботи не запускаємо</h2>${paragraphs(report.noActionReason)}` : ""}
      ${details}
      ${ownerAction}
    </div>
  </div>
</body></html>`;

  const lines = [
    `Період: ${report.period}`,
    "",
    report.executiveSummary,
    "",
    "ЩО PAPERCLIP РОБИТЬ ДАЛІ",
    ...(report.actions.length
      ? report.actions.map((action) => `- ${[action.issueId, action.title].filter(Boolean).join(" - ")}: ${action.nextStep}${action.owner ? ` Виконавець: ${action.owner}.` : ""}${action.status ? ` Статус: ${action.status}.` : ""}${action.url ? ` ${action.url}` : ""}`)
      : ["- Нових завдань цього тижня немає."]),
    ...(report.metrics.length ? ["", "ОСНОВНІ ПОКАЗНИКИ", ...report.metrics.map((metric) => `- ${metric.label}: ${metric.current}; було ${metric.previous}. ${metric.interpretation}`)] : []),
    ...(report.watchItems.length ? ["", "ЩО ПОКИ СПОСТЕРІГАЄМО", ...report.watchItems.map((item) => `- ${item.title}: ${item.reason}${item.nextReview ? ` Наступна перевірка: ${item.nextReview}.` : ""}`)] : []),
    ...(report.noActionReason ? ["", "ЧОМУ ДЕЯКІ РОБОТИ НЕ ЗАПУСКАЄМО", report.noActionReason] : []),
    ...report.details.flatMap((detail) => ["", detail.title.toUpperCase(), detail.body]),
    "",
    report.ownerAction ? `ЩО ПОТРІБНО ВІД ВАС: ${report.ownerAction}` : "ВІД ВАС НІЧОГО НЕ ПОТРІБНО: Paperclip продовжує роботу за призначеними завданнями.",
  ];

  return { text: lines.join("\n"), html, format: "structured_html" };
}

function renderGeneratedHtml(text: string): string {
  const blocks = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return `<!doctype html><html lang="uk"><body style="margin:0;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#17212b;">
    <div style="max-width:760px;margin:0 auto;padding:20px 12px;">
      <div style="background:#fff;border:1px solid #dfe5e8;border-radius:8px;padding:24px;">
        ${blocks.map((block) => paragraphs(block)).join("")}
      </div>
    </div>
  </body></html>`;
}

export function buildDetailedReportEmail(params: Record<string, unknown>): DetailedReportEmailBody {
  const report = parseReport(params.report);
  if (report) return renderStructuredReport(report);

  const text = stringValue(params.text, 50_000);
  const providedHtml = stringValue(params.html, 100_000);
  if (!text) throw new Error("text is required when structured report is not provided");

  return {
    text,
    html: providedHtml || renderGeneratedHtml(text),
    format: providedHtml ? "provided_html" : "generated_html",
  };
}
