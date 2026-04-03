import { useEffect } from "react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { EntityRow } from "../components/EntityRow";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate } from "../lib/utils";
import { CircleUser } from "lucide-react";
import { useMyIssues } from "../hooks/useMyIssues";

export function MyIssues() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "My Issues" }]);
  }, [setBreadcrumbs]);

  const { data: issues, isLoading, error } = useMyIssues(selectedCompanyId);

  if (!selectedCompanyId) {
    return <EmptyState icon={CircleUser} message="Select a company to view your issues." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const myIssues = issues ?? [];

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {myIssues.length === 0 && (
        <EmptyState icon={CircleUser} message="No active issues require your attention." />
      )}

      {myIssues.length > 0 && (
        <div className="border border-border">
          {myIssues.map((issue) => (
            <EntityRow
              key={issue.id}
              identifier={issue.identifier ?? issue.id.slice(0, 8)}
              title={issue.title}
              to={`/issues/${issue.identifier ?? issue.id}`}
              leading={
                <>
                  <PriorityIcon priority={issue.priority} />
                  <StatusIcon status={issue.status} />
                </>
              }
              trailing={
                <span className="text-xs text-muted-foreground">
                  {formatDate(issue.createdAt)}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
