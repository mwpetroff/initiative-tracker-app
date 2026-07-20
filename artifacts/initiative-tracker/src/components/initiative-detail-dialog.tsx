import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  useListInitiativeDependencies,
  useDeleteDependency,
  useUpdateDependency,
  useListDepartments,
  useListRiskCategories,
  useListInitiativeHistory,
  useListInitiativeUpdates,
  useCreateInitiativeUpdate,
  useDeleteInitiativeUpdate,
  getListInitiativeDependenciesQueryKey,
  getListInitiativeHistoryQueryKey,
  getListInitiativeUpdatesQueryKey,
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, CheckCircle2, Undo2 } from "lucide-react";
import { DependencyFormDialog } from "@/components/dependency-form-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useToast } from "@/hooks/use-toast";
import { InlineLoading, PageError } from "@/components/page-state";
import { useDateLocale } from "@/i18n";
import { localizedName } from "@/lib/localized-name";
import { departmentDisplayName } from "@/lib/department-tree";

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

  const {
    data: updates,
    isLoading: isUpdatesLoading,
    error: updatesError,
  } = useListInitiativeUpdates(initiative?.id ?? 0, {
    query: { enabled: Boolean(initiative), queryKey: getListInitiativeUpdatesQueryKey(initiative?.id ?? 0) },
  });

  const [depFormOpen, setDepFormOpen] = useState(false);
  const [newUpdate, setNewUpdate] = useState("");
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

  const resolveMutation = useUpdateDependency({
    mutation: {
      onSuccess: (dep) => {
        if (initiative) {
          queryClient.invalidateQueries({ queryKey: getListInitiativeDependenciesQueryKey(initiative.id) });
        }
        queryClient.invalidateQueries({ queryKey: getListDependenciesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDependencyHeatmapQueryKey() });
        toast({ title: dep.resolved ? t("detail.dependencyResolved") : t("detail.dependencyReopened") });
      },
      onError: () => {
        toast({ title: t("detail.resolveFailed"), variant: "destructive" });
      },
    },
  });

  const createUpdateMutation = useCreateInitiativeUpdate({
    mutation: {
      onSuccess: () => {
        if (initiative) {
          queryClient.invalidateQueries({ queryKey: getListInitiativeUpdatesQueryKey(initiative.id) });
        }
        setNewUpdate("");
        toast({ title: t("detail.updateAdded") });
      },
      onError: () => {
        toast({ title: t("detail.updateAddFailed"), variant: "destructive" });
      },
    },
  });

  const deleteUpdateMutation = useDeleteInitiativeUpdate({
    mutation: {
      onSuccess: () => {
        if (initiative) {
          queryClient.invalidateQueries({ queryKey: getListInitiativeUpdatesQueryKey(initiative.id) });
        }
        toast({ title: t("detail.updateRemoved") });
      },
      onError: () => {
        toast({ title: t("detail.updateRemoveFailed"), variant: "destructive" });
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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initiative.title}</DialogTitle>
          <DialogDescription>{initiative.description || t("detail.noDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {(() => {
            const dept = departments?.find((d) => d.id === initiative.departmentId);
            if (!dept) return null;
            return (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: dept.colorHex }}
                />
                {departmentDisplayName(dept, departments, i18n.language)}
              </span>
            );
          })()}
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
                    <TableRow key={dep.id} className={dep.resolved ? "opacity-60" : undefined}>
                      <TableCell>
                        {dep.dependsOnDepartmentId
                          ? departmentName(dep.dependsOnDepartmentId)
                          : riskCategoryName(dep.dependsOnRiskCategoryId)}
                      </TableCell>
                      <TableCell>
                        {dep.resolved ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                            {t("detail.resolved")}
                          </Badge>
                        ) : (
                          <Badge variant={riskVariant[dep.riskLevel] ?? "secondary"}>
                            {t(`risk.${dep.riskLevel}`, dep.riskLevel)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {dep.notes}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={dep.resolved ? t("detail.reopenDependency") : t("detail.resolveDependency")}
                          title={dep.resolved ? t("detail.reopenDependency") : t("detail.resolveDependency")}
                          disabled={resolveMutation.isPending}
                          className={dep.resolved ? undefined : "text-green-700 hover:text-green-700"}
                          onClick={() =>
                            resolveMutation.mutate({ id: dep.id, data: { resolved: !dep.resolved } })
                          }
                        >
                          {dep.resolved ? <Undo2 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
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
          <h3 className="font-semibold text-sm mb-2">{t("detail.updates")}</h3>
          <div className="flex items-start gap-2 mb-3">
            <Textarea
              value={newUpdate}
              onChange={(e) => setNewUpdate(e.target.value)}
              placeholder={t("detail.updatePlaceholder")}
              rows={2}
              className="flex-1 resize-none"
            />
            <Button
              size="sm"
              disabled={!newUpdate.trim() || createUpdateMutation.isPending}
              onClick={() =>
                createUpdateMutation.mutate({
                  id: initiative.id,
                  data: { content: newUpdate.trim() },
                })
              }
            >
              {t("detail.addUpdate")}
            </Button>
          </div>
          {isUpdatesLoading ? (
            <InlineLoading label={t("detail.loadingUpdates")} />
          ) : updatesError ? (
            <PageError title={t("detail.updatesLoadError")} description={t("common.refreshHint")} />
          ) : updates?.length ? (
            <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {updates.map((entry) => (
                <li key={entry.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm whitespace-pre-wrap flex-1">{entry.content}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("common.delete")}
                      className="text-destructive hover:text-destructive shrink-0 -mt-1 -mr-1"
                      onClick={() => deleteUpdateMutation.mutate({ id: entry.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {entry.author ? `${entry.author} · ` : ""}
                    {new Date(entry.createdAt).toLocaleString(dateLocale)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("detail.noUpdates")}</p>
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
