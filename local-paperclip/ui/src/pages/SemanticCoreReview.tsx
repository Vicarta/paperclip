import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronRight, HelpCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompany } from "@/context/CompanyContext";
import { seoOpsApi, type SemanticCoreReviewBatch, type SemanticCoreReviewItem } from "@/api/seoOps";
import { queryKeys } from "@/lib/queryKeys";

type HumanDecision = "accept" | "reject" | "product_discovery" | "keep_review";
type ViewMode = "decision_queue" | "accepted_core" | "all";
type ConnectionAssessment = "service_match" | "brand_match" | "topic_match" | "no_match" | "unsure";
type SortColumn = "keyword" | "recommendation" | "reason" | "connection" | "volume" | "decision";
type SortDirection = "asc" | "desc";

const decisionLabels: Record<HumanDecision, string> = {
  accept: "Додати в ядро",
  reject: "Не додавати",
  product_discovery: "Обговорити як послугу",
  keep_review: "Залишити на перевірку",
};

const decisionHelp: Array<{ value: HumanDecision; label: string; help: string }> = [
  { value: "accept", label: "Додати в ядро", help: "Запит точно підходить для Astrogen і може використовуватись у SEO та контент-плані." },
  { value: "reject", label: "Не додавати", help: "Запит не про Astrogen, не про послуги або виглядає як шум із пошуку." },
  { value: "product_discovery", label: "Обговорити як послугу", help: "Запит цікавий, але спершу треба вирішити, чи Astrogen справді пропонує таку послугу." },
  { value: "keep_review", label: "Залишити на перевірку", help: "Потрібен додатковий контекст або рішення не варто приймати зараз." },
];

const connectionLabels: Record<ConnectionAssessment, string> = {
  service_match: "Є зв'язок з послугою",
  brand_match: "Є зв'язок з брендом",
  topic_match: "Схоже на нашу тему",
  no_match: "Не бачу зв'язку",
  unsure: "Не впевнений/не впевнена",
};

const initialColumnWidths = {
  select: 44,
  keyword: 260,
  recommendation: 190,
  reason: 280,
  connection: 230,
  volume: 130,
  decision: 210,
};

function layerLabel(layer: string) {
  const labels: Record<string, string> = {
    core_product_intent: "Етап 1: базові запити про послуги",
    adjacent_use_case_intent: "Етап 2: суміжні запити й сценарії",
    problem_solution_intent: "Етап 3: запити про проблеми та рішення",
    content_plan: "Етап 4: план контенту",
  };
  return labels[layer] ?? layer.replaceAll("_", " ");
}

function layerExplanation(layer: string) {
  const explanations: Record<string, string> = {
    core_product_intent: "На цьому етапі збираємо базове семантичне ядро: бренд, ключові послуги Astrogen і найближчі запити, які можуть привести людину до консультації або сервісу.",
    adjacent_use_case_intent: "На цьому етапі шукаємо суміжні теми: ширші сценарії, інтереси аудиторії та запити, які можуть стати статтями або новими посадковими сторінками.",
    problem_solution_intent: "На цьому етапі відбираємо запити, де людина формулює проблему або потребу, а контент має привести її до рішення.",
    content_plan: "На цьому етапі з перевіреного ядра формується контент-план.",
  };
  return explanations[layer] ?? "Перевірте запити цього набору та прийміть рішення, що додавати у семантичне ядро.";
}

function readinessLabel(readiness: string | null) {
  const labels: Record<string, string> = {
    ready_accepted_only: "Можна додати прийняте ядро",
    ready_after_review: "Потрібна перевірка частини запитів",
    unsafe_for_import: "Не можна імпортувати",
    needs_policy_fix: "Потрібно виправити правила",
  };
  return readiness ? labels[readiness] ?? readiness : "Стан невідомий";
}

function batchStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Чернетка",
    in_review: "На перевірці",
    unsafe_blocked: "Заблоковано",
    approved: "Затверджено",
    imported: "Імпортовано",
  };
  return labels[status] ?? status;
}

function membershipLabel(value: string) {
  const labels: Record<string, string> = {
    accepted: "Уже в ядрі",
    review: "Потрібно вирішити",
    parked: "Не додавати зараз",
    rejected: "Відхилено",
    evidence: "Лише сигнал із пошуку",
  };
  return labels[value] ?? value;
}

function recommendationLabel(value: string | null) {
  const labels: Record<string, string> = {
    accept: "Додати",
    reject: "Не додавати",
    defer: "Відкласти",
    revise: "Уточнити",
    keep_review: "Перевірити вручну",
    product_discovery: "Обговорити як послугу",
    needs_product_decision: "Потрібно вирішити, чи це наша тема",
    n_a: "Рішення не потрібне",
  };
  if (!value || value === "n/a") return "Рішення не потрібне";
  return labels[value] ?? value.replaceAll("_", " ");
}

function machineConnectionLabel(value: string | null, companyName = "проєктом") {
  const labels: Record<string, string> = {
    canonized_product: "Система бачить зв'язок із послугою",
    brand_binding: `Система бачить зв'язок із брендом ${companyName}`,
    topic_only: "Система бачить лише тематичну схожість",
    proposed_product: "Може бути новою послугою",
    unknown: "Система не бачить чіткого зв'язку",
  };
  return value ? labels[value] ?? value.replaceAll("_", " ") : "Система не бачить чіткого зв'язку";
}

function humanConnectionLabel(value: string | null) {
  return value && value in connectionLabels
    ? connectionLabels[value as ConnectionAssessment]
    : "Людина ще не вказала";
}

function readableReason(reason: string | null | undefined) {
  if (!reason) return "Немає застережень";
  const labels: Record<string, string> = {
    no_entity_anchor: "Не видно чіткого зв'язку з послугою або брендом",
    competitor_content_evidence_cannot_be_accepted_directly: "Знайдено у конкурентів, але цього недостатньо для додавання",
    competitor_content_evidence: "Знайдено у конкурентів, потрібна перевірка",
    content_parsing: "Схоже на текст зі сторінки, а не на запит людини",
    serp_content: "Сигнал із результатів пошуку, потрібна перевірка",
    ui_noise: "Схоже на технічний або інтерфейсний шум",
    mixed_language: "Змішана мова, потрібна перевірка",
    unsupported_locale: "Потрібна перевірка мови",
    explainable_edge_case: "Пояснений мовний виняток",
    needs_review: "Потрібна перевірка",
    unsafe: "Небезпечно додавати",
    none: "Немає",
    locale_warning_requires_valid_override: "Щоб додати цей запит, потрібне пояснення мовного винятку",
    locale_warning_requires_explainable_edge_case_severity: "Мовне попередження не позначене як безпечний виняток",
    locale_override_requires_high_domain_topic_match: "Недостатньо сильний зв'язок із темою проєкту",
    locale_override_requires_canonized_or_brand_binding: "Недостатньо чіткий зв'язок із брендом або послугою",
    locale_override_requires_high_or_medium_source_precision: "Джерело недостатньо надійне для винятку",
    locale_warning_severity_cannot_be_auto_accepted: "Це мовне попередження не можна приймати автоматично",
    unknown_product_binding_requires_resolution: "Потрібно зрозуміти, чи це наша тема",
    no_entity_anchor_requires_product_binding_or_discovery: "Потрібно прив'язати до послуги або винести на обговорення",
  };
  return labels[reason] ?? reason.replaceAll("_", " ");
}

function primaryReason(item: SemanticCoreReviewItem) {
  return item.validationReasons[0]
    ?? item.policyWarnings[0]
    ?? item.humanReviewReason
    ?? null;
}

function reasonLabel(item: SemanticCoreReviewItem) {
  return readableReason(primaryReason(item));
}

function readinessVariant(readiness: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (readiness === "ready_accepted_only") return "default";
  if (readiness === "ready_after_review") return "secondary";
  if (readiness === "unsafe_for_import" || readiness === "needs_policy_fix") return "destructive";
  return "outline";
}

function warningClass(item: SemanticCoreReviewItem) {
  const warnings = item.policyWarnings.join(" ").toLowerCase();
  if (item.validationOutcome === "blocked") return "border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200";
  if (item.localeWarningSeverity === "unsafe" || item.localeWarningSeverity === "needs_review") return "border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200";
  if (item.acceptedLocaleWarningOverridden) return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200";
  if (warnings.includes("locale") || warnings.includes("mixed")) return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200";
  if (warnings.includes("competitor")) return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200";
  if (warnings.includes("no_entity")) return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
  return "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200";
}

function hasLocaleWarning(item: SemanticCoreReviewItem) {
  const warnings = item.policyWarnings.join(" ").toLowerCase();
  return warnings.includes("locale") || warnings.includes("mixed_language") || warnings.includes("unsupported_language");
}

function overrideReasonForDecision(item: SemanticCoreReviewItem, decision: HumanDecision) {
  if (decision !== "accept" || !hasLocaleWarning(item) || item.acceptedLocaleWarningOverridden) {
    return item.localeOverrideReason ?? undefined;
  }
  return window.prompt("Чому цей запит, попри мовне попередження, варто додати?")?.trim() || undefined;
}

function matchesQuery(item: SemanticCoreReviewItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return item.displayKeyword.toLowerCase().includes(normalized)
    || reasonLabel(item).toLowerCase().includes(normalized)
    || (item.evidenceSummary ?? "").toLowerCase().includes(normalized)
    || (item.humanReviewReason ?? "").toLowerCase().includes(normalized);
}

function filterItems(items: SemanticCoreReviewItem[], viewMode: ViewMode, query: string) {
  return items.filter((item) => {
    if (viewMode === "accepted_core" && item.currentMachineMembership !== "accepted") return false;
    if (viewMode === "decision_queue" && item.currentMachineMembership === "accepted") return false;
    return matchesQuery(item, query);
  });
}

function compareText(left: string | null | undefined, right: string | null | undefined) {
  const leftValue = left?.trim();
  const rightValue = right?.trim();
  if (!leftValue && !rightValue) return 0;
  if (!leftValue) return 1;
  if (!rightValue) return -1;
  return leftValue.localeCompare(rightValue, "uk", { sensitivity: "base", numeric: true });
}

function compareNumbers(left: number | null | undefined, right: number | null | undefined) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left - right;
}

function itemSortValue(item: SemanticCoreReviewItem, column: SortColumn, companyName?: string) {
  if (column === "keyword") return item.displayKeyword;
  if (column === "recommendation") {
    return `${membershipLabel(item.currentMachineMembership)} ${recommendationLabel(item.recommendedHumanDecision)}`;
  }
  if (column === "reason") return reasonLabel(item);
  if (column === "connection") {
    return `${humanConnectionLabel(item.humanConnectionAssessment)} ${machineConnectionLabel(item.productBindingStatus, companyName)}`;
  }
  if (column === "decision") {
    return item.humanDecision && item.humanDecision in decisionLabels
      ? decisionLabels[item.humanDecision as HumanDecision]
      : "Без рішення";
  }
  return null;
}

function sortItems(
  items: SemanticCoreReviewItem[],
  sort: { column: SortColumn; direction: SortDirection } | null,
  companyName?: string,
) {
  if (!sort) return items;
  return [...items].sort((left, right) => {
    const compared = sort.column === "volume"
      ? compareNumbers(left.geoSearchVolume, right.geoSearchVolume)
        || compareNumbers(left.globalSearchVolume, right.globalSearchVolume)
      : compareText(
          itemSortValue(left, sort.column, companyName),
          itemSortValue(right, sort.column, companyName),
        );
    return sort.direction === "asc" ? compared : -compared;
  });
}

function BatchSummary({ batch, items }: { batch: SemanticCoreReviewBatch; items: SemanticCoreReviewItem[] }) {
  const accepted = items.filter((item) => item.currentMachineMembership === "accepted").length;
  const needsDecision = items.filter((item) => item.currentMachineMembership !== "accepted" && item.decisionStatus === "pending").length;
  return (
    <section className="border-b border-neutral-200 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-normal text-[#810e2b] dark:text-[#C69C6D]">Перевірка ключових запитів</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-neutral-950 dark:text-neutral-50">{layerLabel(batch.layer)}</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{layerExplanation(batch.layer)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={readinessVariant(batch.importReadiness)}>{readinessLabel(batch.importReadiness)}</Badge>
          <Badge variant={batch.status === "unsafe_blocked" ? "destructive" : "outline"}>{batchStatusLabel(batch.status)}</Badge>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div className="border-l-2 border-[#810e2b] pl-3 dark:border-[#C69C6D]">
          <div className="text-neutral-500 dark:text-neutral-400">Уже в ядрі</div>
          <div className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">{accepted}</div>
        </div>
        <div className="border-l-2 border-[#C69C6D] pl-3">
          <div className="text-neutral-500 dark:text-neutral-400">Потрібно вирішити</div>
          <div className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">{needsDecision}</div>
        </div>
        <div className="border-l-2 border-neutral-300 pl-3 dark:border-neutral-700">
          <div className="text-neutral-500 dark:text-neutral-400">Усього запитів</div>
          <div className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">{items.length}</div>
        </div>
        <div className="border-l-2 border-red-300 pl-3 dark:border-red-800">
          <div className="text-neutral-500 dark:text-neutral-400">Без рішення</div>
          <div className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">{batch.unresolvedReviewCount}</div>
        </div>
      </div>
    </section>
  );
}

function BatchPicker({
  batches,
  selectedBatchId,
  onSelect,
}: {
  batches: SemanticCoreReviewBatch[];
  selectedBatchId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="border-r border-neutral-200 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Набори запитів</div>
      <div className="grid gap-2">
        {batches.map((batch) => (
          <button
            key={batch.id}
            className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
              selectedBatchId === batch.id
                ? "border-[#810e2b] bg-white text-neutral-950 shadow-sm dark:border-[#C69C6D] dark:bg-neutral-900 dark:text-neutral-50"
                : "border-neutral-200 bg-white/70 text-neutral-700 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-300 dark:hover:bg-neutral-900"
            }`}
            onClick={() => onSelect(batch.id)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{layerLabel(batch.layer)}</span>
              <ChevronRight className="size-4 text-neutral-400" />
            </div>
            <div className="mt-2 flex gap-1">
              <Badge variant={readinessVariant(batch.importReadiness)}>{readinessLabel(batch.importReadiness)}</Badge>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function DecisionGuide() {
  return (
    <section className="border-b border-neutral-200 bg-[#fbf7f8] px-5 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="mb-2 flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
        <HelpCircle className="size-4 text-[#810e2b] dark:text-[#C69C6D]" />
        Що означають рішення
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {decisionHelp.map((item) => (
          <div key={item.value} className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="font-medium text-neutral-950 dark:text-neutral-50">{item.label}</div>
            <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{item.help}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DetailDrawer({
  item,
  companyName,
  onConnectionChange,
  connectionPending,
}: {
  item: SemanticCoreReviewItem | null;
  companyName?: string;
  onConnectionChange: (item: SemanticCoreReviewItem, assessment: ConnectionAssessment | null) => void;
  connectionPending: boolean;
}) {
  if (!item) {
    return (
      <aside className="hidden border-l border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 xl:block">
        Виберіть запит, щоб побачити пояснення.
      </aside>
    );
  }

  return (
    <aside className="hidden overflow-y-auto border-l border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950 xl:block">
      <div className="text-xs font-semibold uppercase tracking-normal text-[#810e2b] dark:text-[#C69C6D]">Деталі запиту</div>
      <h2 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-neutral-50">{item.displayKeyword}</h2>
      <div className="mt-3 grid gap-3 text-sm">
        <div>
          <span className="text-neutral-500 dark:text-neutral-400">Рекомендація системи</span>
          <div className="font-medium text-neutral-950 dark:text-neutral-50">{membershipLabel(item.currentMachineMembership)}</div>
        </div>
        <div>
          <span className="text-neutral-500 dark:text-neutral-400">Оцінка людини: зв'язок з {companyName ?? "проєктом"}</span>
          <select
            className="mt-1 h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-950 outline-none focus:border-[#810e2b] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
            value={item.humanConnectionAssessment ?? ""}
            disabled={connectionPending}
            onChange={(event) => onConnectionChange(item, event.target.value ? event.target.value as ConnectionAssessment : null)}
          >
            <option value="">Не вказано</option>
            {Object.entries(connectionLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Це місце, де власник може явно сказати, що запит пов'язаний із послугою або брендом, навіть якщо система не була впевнена.
          </p>
        </div>
        <div>
          <span className="text-neutral-500 dark:text-neutral-400">Що побачила система</span>
          <p className="mt-1 text-neutral-800 dark:text-neutral-200">{machineConnectionLabel(item.productBindingStatus, companyName)}</p>
        </div>
        <div>
          <span className="text-neutral-500 dark:text-neutral-400">На що звернути увагу</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {item.policyWarnings.length
              ? item.policyWarnings.map((warning) => <Badge key={warning} variant="outline">{readableReason(warning)}</Badge>)
              : <span className="text-neutral-400">Немає застережень</span>}
          </div>
        </div>
        <div>
          <span className="text-neutral-500 dark:text-neutral-400">Мовне попередження</span>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="outline">{item.localeWarningSeverity && item.localeWarningSeverity !== "none" ? readableReason(item.localeWarningSeverity) : "Немає"}</Badge>
            {item.acceptedLocaleWarningOverridden && <Badge variant="outline">Пояснений виняток</Badge>}
            {item.humanDecisionApplied && <Badge variant="outline">Рішення враховано</Badge>}
          </div>
          {item.localeOverrideReason && <p className="mt-1 text-neutral-800 dark:text-neutral-200">{item.localeOverrideReason}</p>}
          {item.humanDecisionBlockedReason && <p className="mt-1 text-red-700 dark:text-red-300">{readableReason(item.humanDecisionBlockedReason)}</p>}
        </div>
        <div>
          <span className="text-neutral-500 dark:text-neutral-400">Причина</span>
          <p className="mt-1 text-neutral-800 dark:text-neutral-200">{reasonLabel(item)}</p>
        </div>
        <div>
          <span className="text-neutral-500 dark:text-neutral-400">Попит</span>
          <div className="font-medium text-neutral-950 dark:text-neutral-50">Україна: {item.geoSearchVolume ?? "немає даних"} · Загалом: {item.globalSearchVolume ?? "немає даних"}</div>
        </div>
      </div>
    </aside>
  );
}

export function SemanticCoreReview() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("decision_queue");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [columnWidths, setColumnWidths] = useState(initialColumnWidths);
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection } | null>(null);

  const batchesQuery = useQuery({
    queryKey: ["seoOps", "semanticCoreReviewBatches", selectedCompanyId],
    queryFn: () => seoOpsApi.listSemanticCoreReviewBatches(selectedCompanyId ?? ""),
    enabled: Boolean(selectedCompanyId),
  });

  const selectedBatch = useMemo(() => {
    const batches = batchesQuery.data ?? [];
    if (selectedBatchId) return batches.find((batch) => batch.id === selectedBatchId) ?? null;
    return batches[0] ?? null;
  }, [batchesQuery.data, selectedBatchId]);

  const batchQuery = useQuery({
    queryKey: ["seoOps", "semanticCoreReviewBatch", selectedBatch?.id],
    queryFn: () => seoOpsApi.getSemanticCoreReviewBatch(selectedBatch?.id ?? ""),
    enabled: Boolean(selectedBatch?.id),
  });

  const items = batchQuery.data?.items ?? [];
  const filteredItems = useMemo(() => filterItems(items, viewMode, query), [items, viewMode, query]);
  const visibleItems = useMemo(() => sortItems(filteredItems, sort, selectedCompany?.name), [filteredItems, sort, selectedCompany?.name]);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? visibleItems[0] ?? null;

  const toggleSort = useCallback((column: SortColumn) => {
    setSort((current) => {
      if (current?.column !== column) return { column, direction: "asc" };
      return { column, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  }, []);

  const startResize = useCallback((column: keyof typeof initialColumnWidths, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = columnWidths[column];
    const onMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(90, startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) => ({ ...current, [column]: nextWidth }));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [columnWidths]);

  const decisionMutation = useMutation({
    mutationFn: ({ item, humanDecision }: { item: SemanticCoreReviewItem; humanDecision: HumanDecision }) =>
      seoOpsApi.updateSemanticCoreReviewDecision(item.id, {
        humanDecision,
        overrideReason: overrideReasonForDecision(item, humanDecision),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seoOps"] });
      if (selectedCompanyId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(selectedCompanyId) });
      }
    },
  });

  const connectionMutation = useMutation({
    mutationFn: ({ item, assessment }: { item: SemanticCoreReviewItem; assessment: ConnectionAssessment | null }) =>
      seoOpsApi.updateSemanticCoreReviewConnection(item.id, {
        humanConnectionAssessment: assessment,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seoOps"] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (humanDecision: HumanDecision) => {
      const selectedItems = items.filter((item) => selectedIds.has(item.id));
      const needsLocaleOverride = humanDecision === "accept"
        && selectedItems.some((item) => hasLocaleWarning(item) && !item.acceptedLocaleWarningOverridden);
      const overrideReason = needsLocaleOverride
        ? window.prompt("Чому ці запити, попри мовне попередження, варто додати?")?.trim() || undefined
        : undefined;
      return seoOpsApi.bulkUpdateSemanticCoreReviewDecision(selectedBatch?.id ?? "", {
        itemIds: [...selectedIds],
        humanDecision,
        overrideReason,
      });
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      void queryClient.invalidateQueries({ queryKey: ["seoOps"] });
    },
  });

  function tableHeader(label: string, column: keyof typeof initialColumnWidths, sortColumn?: SortColumn) {
    const active = sortColumn && sort?.column === sortColumn;
    const SortIcon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className="relative border-b border-neutral-200 px-3 py-2 dark:border-neutral-800" style={{ width: columnWidths[column] }}>
        {sortColumn ? (
          <button
            type="button"
            className="inline-flex max-w-full items-center gap-1 rounded text-left hover:text-[#810e2b] focus:outline-none focus:ring-2 focus:ring-[#810e2b]/30 dark:hover:text-[#C69C6D] dark:focus:ring-[#C69C6D]/30"
            onClick={() => toggleSort(sortColumn)}
            aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
          >
            <span className="truncate">{label}</span>
            <SortIcon className={`size-3.5 shrink-0 ${active ? "text-[#810e2b] dark:text-[#C69C6D]" : "text-neutral-400"}`} />
          </button>
        ) : (
          <span>{label}</span>
        )}
        <button
          aria-label={`Змінити ширину колонки ${label}`}
          className="absolute right-0 top-0 h-full w-2 cursor-col-resize border-r border-transparent hover:border-[#810e2b] dark:hover:border-[#C69C6D]"
          onMouseDown={(event) => startResize(column, event)}
        />
      </th>
    );
  }

  if (!selectedCompanyId) {
    return <div className="p-6 text-sm text-neutral-500 dark:text-neutral-400">Спочатку виберіть компанію.</div>;
  }

  if (batchesQuery.isLoading) {
    return <div className="p-6 text-sm text-neutral-500 dark:text-neutral-400">Завантажую набори запитів...</div>;
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-white font-[Montserrat,ui-sans-serif,system-ui] text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="grid min-h-[calc(100vh-3rem)] grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <BatchPicker
          batches={batchesQuery.data ?? []}
          selectedBatchId={selectedBatch?.id ?? null}
          onSelect={(id) => {
            setSelectedBatchId(id);
            setSelectedIds(new Set());
            setSelectedItemId(null);
          }}
        />
        <main className="min-w-0">
          {selectedBatch ? <BatchSummary batch={selectedBatch} items={items} /> : null}
          {!selectedBatch ? (
            <div className="p-6 text-sm text-neutral-500 dark:text-neutral-400">Немає наборів запитів для перевірки.</div>
          ) : (
            <div className="grid min-h-[calc(100vh-15rem)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_25rem]">
              <section className="min-w-0">
                <DecisionGuide />
                <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-5 py-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className="h-9 w-72 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none focus:border-[#810e2b] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:placeholder:text-neutral-500"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Пошук за запитом або поясненням"
                    />
                    <div className="flex rounded-md border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
                      {[
                        ["decision_queue", "Потрібні рішення"],
                        ["accepted_core", "Автоматично додане ядро"],
                        ["all", "Усі запити"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          className={`rounded px-3 py-1.5 text-sm ${
                            viewMode === value
                              ? "bg-white text-[#810e2b] shadow-sm dark:bg-neutral-800 dark:text-[#C69C6D]"
                              : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-neutral-50"
                          }`}
                          onClick={() => {
                            setViewMode(value as ViewMode);
                            setSelectedIds(new Set());
                            setSelectedItemId(null);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-sm">
                    <colgroup>
                      {Object.entries(columnWidths).map(([key, width]) => <col key={key} style={{ width }} />)}
                    </colgroup>
                    <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-normal text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                      <tr>
                        {tableHeader("", "select")}
                        {tableHeader("Запит", "keyword", "keyword")}
                        {tableHeader("Рекомендація", "recommendation", "recommendation")}
                        {tableHeader("Чому", "reason", "reason")}
                        {tableHeader("Зв'язок з Astrogen", "connection", "connection")}
                        {tableHeader("Попит", "volume", "volume")}
                        {tableHeader("Ваше рішення", "decision", "decision")}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((item) => {
                        const selected = selectedIds.has(item.id);
                        return (
                          <tr
                            key={item.id}
                            className={`cursor-pointer ${
                              selectedItem?.id === item.id
                                ? "bg-[#f8f1f3] dark:bg-[#2c151d]"
                                : "bg-white hover:bg-neutral-50 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                            }`}
                            onClick={() => setSelectedItemId(item.id)}
                          >
                            <td className="border-b border-neutral-100 px-3 py-2 dark:border-neutral-900" onClick={(event) => event.stopPropagation()}>
                              <Checkbox
                                checked={selected}
                                onCheckedChange={(checked) => {
                                  const next = new Set(selectedIds);
                                  if (checked) next.add(item.id);
                                  else next.delete(item.id);
                                  setSelectedIds(next);
                                }}
                              />
                            </td>
                            <td className="border-b border-neutral-100 px-3 py-2 font-medium text-neutral-950 dark:border-neutral-900 dark:text-neutral-50">{item.displayKeyword}</td>
                            <td className="border-b border-neutral-100 px-3 py-2 dark:border-neutral-900">
                              <div className="font-medium text-neutral-900 dark:text-neutral-100">{membershipLabel(item.currentMachineMembership)}</div>
                              <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{recommendationLabel(item.recommendedHumanDecision)}</div>
                            </td>
                            <td className="border-b border-neutral-100 px-3 py-2 dark:border-neutral-900">
                              <span className={`inline-flex max-w-full items-center gap-1 truncate rounded-md border px-2 py-1 text-xs ${warningClass(item)}`}>
                                {item.validationOutcome === "blocked" ? <ShieldAlert className="size-3" /> : item.policyWarnings.length ? <AlertTriangle className="size-3" /> : <Check className="size-3" />}
                                <span className="truncate">{reasonLabel(item)}</span>
                              </span>
                            </td>
                            <td className="border-b border-neutral-100 px-3 py-2 dark:border-neutral-900" onClick={(event) => event.stopPropagation()}>
                              <select
                                className="h-8 w-full rounded-md border border-neutral-300 bg-white px-2 text-xs text-neutral-950 outline-none focus:border-[#810e2b] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
                                value={item.humanConnectionAssessment ?? ""}
                                disabled={connectionMutation.isPending}
                                onChange={(event) => connectionMutation.mutate({
                                  item,
                                  assessment: event.target.value ? event.target.value as ConnectionAssessment : null,
                                })}
                              >
                                <option value="">Не вказано</option>
                                {Object.entries(connectionLabels).map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                              <div className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">{machineConnectionLabel(item.productBindingStatus, selectedCompany?.name)}</div>
                            </td>
                            <td className="border-b border-neutral-100 px-3 py-2 dark:border-neutral-900">
                              {item.geoSearchVolume ?? "немає"} / {item.globalSearchVolume ?? "немає"}
                            </td>
                            <td className="border-b border-neutral-100 px-3 py-2 dark:border-neutral-900" onClick={(event) => event.stopPropagation()}>
                              <select
                                className="h-8 w-full rounded-md border border-neutral-300 bg-white px-2 text-xs text-neutral-950 outline-none focus:border-[#810e2b] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
                                value={item.humanDecision ?? ""}
                                onChange={(event) => {
                                  const value = event.target.value as HumanDecision;
                                  if (value) decisionMutation.mutate({ item, humanDecision: value });
                                }}
                              >
                                <option value="">Без рішення</option>
                                {decisionHelp.map(({ value, label }) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-white px-5 py-3 shadow-[0_-8px_20px_rgba(0,0,0,0.04)] dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="text-sm text-neutral-600 dark:text-neutral-300">
                    Обрано: {selectedIds.size} · Показано: {visibleItems.length} · Усього: {items.length}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={selectedIds.size === 0 || bulkMutation.isPending} onClick={() => bulkMutation.mutate("accept")}>
                      Додати в ядро
                    </Button>
                    <Button size="sm" variant="outline" disabled={selectedIds.size === 0 || bulkMutation.isPending} onClick={() => bulkMutation.mutate("keep_review")}>
                      Залишити на перевірку
                    </Button>
                    <Button size="sm" variant="outline" disabled={selectedIds.size === 0 || bulkMutation.isPending} onClick={() => bulkMutation.mutate("product_discovery")}>
                      Обговорити як послугу
                    </Button>
                    <Button size="sm" variant="destructive" disabled={selectedIds.size === 0 || bulkMutation.isPending} onClick={() => bulkMutation.mutate("reject")}>
                      Не додавати
                    </Button>
                  </div>
                </div>
              </section>
              <DetailDrawer
                item={selectedItem}
                companyName={selectedCompany?.name}
                onConnectionChange={(item, assessment) => connectionMutation.mutate({ item, assessment })}
                connectionPending={connectionMutation.isPending}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
