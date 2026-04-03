import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import {
  findHumanDecisionNeededLabelId,
  mergeMyIssues,
  MY_ISSUE_ACTIVE_STATUSES,
} from "../lib/myIssues";

export function useMyIssues(companyId: string | null | undefined) {
  const { data: labels = [], isLoading: labelsLoading, error: labelsError } = useQuery({
    queryKey: queryKeys.issues.labels(companyId!),
    queryFn: () => issuesApi.listLabels(companyId!),
    enabled: !!companyId,
  });

  const humanDecisionLabelId = useMemo(
    () => findHumanDecisionNeededLabelId(labels),
    [labels],
  );

  const {
    data: assignedIssues = [],
    isLoading: assignedLoading,
    error: assignedError,
  } = useQuery({
    queryKey: queryKeys.issues.listAssignedToMe(companyId!),
    queryFn: () =>
      issuesApi.list(companyId!, {
        assigneeUserId: "me",
        status: MY_ISSUE_ACTIVE_STATUSES,
      }),
    enabled: !!companyId,
  });

  const {
    data: humanDecisionIssues = [],
    isLoading: humanDecisionLoading,
    error: humanDecisionError,
  } = useQuery({
    queryKey: queryKeys.issues.listHumanDecisionNeededForMe(companyId!, humanDecisionLabelId ?? "__missing__"),
    queryFn: () =>
      issuesApi.list(companyId!, {
        touchedByUserId: "me",
        labelId: humanDecisionLabelId!,
        status: MY_ISSUE_ACTIVE_STATUSES,
      }),
    enabled: !!companyId && !!humanDecisionLabelId,
  });

  const myIssues = useMemo(
    () => mergeMyIssues(assignedIssues, humanDecisionIssues),
    [assignedIssues, humanDecisionIssues],
  );

  return {
    data: myIssues,
    isLoading:
      labelsLoading ||
      assignedLoading ||
      (Boolean(humanDecisionLabelId) && humanDecisionLoading),
    error: labelsError ?? assignedError ?? humanDecisionError ?? null,
  };
}
