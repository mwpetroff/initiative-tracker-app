import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  useListInitiativeDependencies,
  useDeleteDependency,
  useListDepartments,
  useListRiskCategories,
  useListInitiativeHistory,
  getListInitiativeDependenciesQueryKey,
  getListInitiativeHistoryQueryKey,
  getListDependenciesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetDependencyHeatmapQueryKey,
} from "@workspace/api-client-react";
import type { Initiative, Dependency } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DependencyFormDialog } from "@/components/dependency-form-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useToast } from "@/hooks/use-toast";
import { InlineLoading, PageError } from "@/components/page-state";
import { useDateLocale } from "@/i18n";
import { localizedName } from "@/lib/localized-name";

const riskVariant: Record<string, "secondary" | "outline" | "destructive"> = {
  low: "secondary",
  medium: "outline",
  high: "destructive",
  critical: "destructive",
};

interface InitiativeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initiative: Initiative | null;
}

export function InitiativeDetailDialog({ open, onOpenChange, initiative }: InitiativeDetailDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const dateLocale = useDateLocale();
  const { data: departments } = useListDepartments();
  const { data: riskCategories } = useListRiskCategories();
  const {
    data: dependencies,
    isLoading,
    error: dependenciesError,
  } = useListInitiativeDependencies(initiative?.id ?? 0, {
    query: { enabled: Boolean(initiative), queryKey: getListInitiativeDependenciesQueryKey(initiative?.id ?? 0) },
  });
  const {
    data: history,
    isLoading: isHistoryLoading,
    error: historyError,
  } = useListInitiativeHistory(initiative?.id ?? 0, {
    query: { enabled: Boolean(initiative), queryKey: getListInitiativeHistoryQueryKey(initiative?.id ?? 0) },
  });

  const [depFormOpen, setDepFormOpen] = useState(false);
  const [editingDependency, setEditingDependency] = useState<Dependency | null>(null);
  const [deletingDependency, setDeletingDependency] = useState<Dependency | null>(null);

  const deleteMutation = useDeleteDependency({
    mutation: {
      onSuccess: () => {
        if (initiative) {
          queryClient.invalidateQueries({ queryKey: getListInitiativeDependenciesQueryKey(initiative.id) });
        }
        queryClient.invalidateQueries({ queryKey: getListDependenciesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDependencyHeatmapQueryKey() });
        toast({ title: t("detail.dependencyRemoved") });
        setDeletingDependency(null);
      },
      onError: () => {
        toast({ title: t("detail.removeFailed"), variant: "destructive" });
      },
    },
  });

  const departmentName = (id: number | null) =>
    localizedName(departments?.find((d) => d.id === id), i18n.language) ?? t("common.unknown");
  const riskCategoryName = (id: number | null) =>
    localizedName(riskCategories?.find((c) => c.id === id), i18n.language) ?? t("common.unknown");

  if (!initiative) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initiative.title}</DialogTitle>
          <DialogDescription>{initiative.description || t("detail.noDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{t(`status.${initiative.status}`, initiative.status)}</Badge>
          <Badge variant="outline">
            {t("detail.priorityBadge", {
              label: t(`priority.${initiative.priority}`, initiative.priority),
            })}
          </Badge>
          <span>{t("detail.owner", { owner: initiative.owner })}</span>
          <span>{t("detail.progress", { progress: initiative.progress })}</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>
            {t("detail.start", { date: new Date(initiative.startDate).toLocaleDateString(dateLocale) })}
          </span>
          <span>
            {t("detail.target", { date: new Date(initiative.targetDate).toLocaleDateString(dateLocale) })}
          </span>
        </div>

        {initiative.quarterGoal && (
          <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1">
            <p className="font-semibold">{t("detail.quarterGoal")}</p>
            <p className="text-muted-foreground">{initiative.quarterGoal}</p>
            {initiative.quarterGoalTarget !== null && initiative.quarterGoalTarget !== undefined && (
              <p className="text-muted-foreground">
                {t("detail.quarterGoalTarget", {
                  target: initiative.quarterGoalTarget,
                  progress: initiative.progress,
                })}
              </p>
            )}
          </div>
        )}

        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{t("detail.dependencies")}</h3>
            <Button
              size="sm"
              onClick={() => {
                setEditingDependency(null);
                setDepFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("detail.addDependency")}
            </Button>
          </div>

          {isLoading ? (
            <InlineLoading label={t("detail.loadingDependencies")} />
          ) : dependenciesError ? (
            <PageError title={t("detail.dependenciesLoadError")} description={t("common.refreshHint")} />
          ) : (
            <div className="overflow-x-auto -mx-1 px-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("detail.dependsOn")}</TableHead>
                    <TableHead>{t("detail.risk")}</TableHead>
                    <TableHead>{t("common.notes")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dependencies?.map((dep) => (
                    <TableRow key={dep.id}>
                      <TableCell>
                        {dep.dependsOnDepartmentId
                          ? departmentName(dep.dependsOnDepartmentId)
                          : riskCategoryName(dep.dependsOnRiskCategoryId)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={riskVariant[dep.riskLevel] ?? "secondary"}>
                          {t(`risk.${dep.riskLevel}`, dep.riskLevel)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {dep.notes}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("common.edit")}
                          onClick={() => {
                            setEditingDependency(dep);
                            setDepFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("common.delete")}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletingDependency(dep)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!dependencies?.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        {t("detail.noDependencies")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="mt-2">
          <h3 className="font-semibold text-sm mb-2">{t("detail.statusHistory")}</h3>
          {isHistoryLoading ? (
            <InlineLoading label={t("detail.loadingHistory")} />
          ) : historyError ? (
            <PageError title={t("detail.historyLoadError")} description={t("common.refreshHint")} />
          ) : history?.length ? (
            <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between text-sm">
                  <span>
                    <Badge variant="outline" className="mr-1">
                      {t(`status.${entry.oldStatus}`, entry.oldStatus)}
                    </Badge>
                    →
                    <Badge variant="secondary" className="ml-1">
                      {t(`status.${entry.newStatus}`, entry.newStatus)}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.changedAt).toLocaleString(dateLocale)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("detail.noHistory")}</p>
          )}
        </div>

        <DependencyFormDialog
          open={depFormOpen}
          onOpenChange={setDepFormOpen}
          initiativeId={initiative.id}
          dependency={editingDependency}
        />

        <ConfirmDeleteDialog
          open={Boolean(deletingDependency)}
          onOpenChange={(open) => !open && setDeletingDependency(null)}
          title={t("detail.removeDependencyTitle")}
          description={t("detail.removeDependencyDescription")}
          onConfirm={() => deletingDependency && deleteMutation.mutate({ id: deletingDependency.id })}
          isPending={deleteMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
