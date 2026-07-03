import { useEffect, useMemo, useState } from "react";
import {
  useListInitiatives,
  useDeleteInitiative,
  useGetSettings,
  useListDepartments,
  getListInitiativesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetDependencyHeatmapQueryKey,
} from "@workspace/api-client-react";
import type { Initiative } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Pencil, Trash2, FileSpreadsheet, Search } from "lucide-react";
import { InitiativeFormDialog } from "@/components/initiative-form-dialog";
import { InitiativeDetailDialog } from "@/components/initiative-detail-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { PageError, CardSkeletonGrid } from "@/components/page-state";
import { useToast } from "@/hooks/use-toast";
import { getFiscalQuarter } from "@/lib/quarter";
import { exportInitiativesToExcel, type ExportLabels } from "@/lib/export-excel";
import { filterInitiatives, paginate, isInitiativeOverdue } from "@/lib/initiative-filters";
import { useDateLocale, useQuarterLocale } from "@/i18n";

const STATUS_VALUES = ["planning", "in_progress", "blocked", "completed", "on_hold"] as const;
const PRIORITY_VALUES = ["low", "medium", "high"] as const;

const PAGE_SIZE = 9;

export default function Initiatives() {
  const { data: initiatives, isLoading, error } = useListInitiatives();
  const { data: settings } = useGetSettings();
  const { data: departments } = useListDepartments();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const quarterLocale = useQuarterLocale();
  const [isExporting, setIsExporting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null);
  const [deletingInitiative, setDeletingInitiative] = useState<Initiative | null>(null);
  const [detailInitiative, setDetailInitiative] = useState<Initiative | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [quarterFilter, setQuarterFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState(1);

  const anchorDate = useMemo(() => {
    if (!settings) return null;
    return new Date(`${settings.quarterStartDate.slice(0, 10)}T00:00:00Z`);
  }, [settings]);

  const initiativeQuarterKey = (initiative: Initiative): string | null => {
    if (!anchorDate) return null;
    const q = getFiscalQuarter(anchorDate, new Date(`${initiative.targetDate.slice(0, 10)}T00:00:00Z`));
    return `${q.year}-Q${q.quarterNumber}`;
  };

  const quarterOptions = useMemo(() => {
    if (!initiatives || !anchorDate) return [];
    const map = new Map<string, string>();
    for (const initiative of initiatives) {
      const q = getFiscalQuarter(
        anchorDate,
        new Date(`${initiative.targetDate.slice(0, 10)}T00:00:00Z`),
        quarterLocale,
      );
      const key = `${q.year}-Q${q.quarterNumber}`;
      map.set(key, q.label);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [initiatives, anchorDate, quarterLocale]);

  const filteredInitiatives = useMemo(() => {
    return filterInitiatives(initiatives ?? [], {
      statusFilter,
      quarterFilter,
      searchQuery,
      getQuarterKey: initiativeQuarterKey,
    });
  }, [initiatives, statusFilter, quarterFilter, searchQuery, anchorDate]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, quarterFilter, searchQuery]);

  const {
    items: pagedInitiatives,
    totalPages,
    currentPage,
  } = useMemo(() => paginate(filteredInitiatives, page, PAGE_SIZE), [filteredInitiatives, page]);

  const deleteMutation = useDeleteInitiative({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInitiativesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDependencyHeatmapQueryKey() });
        toast({ title: t("initiatives.deleted") });
        setDeletingInitiative(null);
      },
      onError: () => {
        toast({ title: t("initiatives.deleteFailed"), variant: "destructive" });
      },
    },
  });

  const openCreateForm = () => {
    setEditingInitiative(null);
    setFormOpen(true);
  };

  const buildExportLabels = (): ExportLabels => ({
    sheetName: t("export.sheetName"),
    headers: {
      title: t("export.title"),
      department: t("export.department"),
      status: t("export.status"),
      priority: t("export.priority"),
      owner: t("export.owner"),
      progress: t("export.progress"),
      startDate: t("export.startDate"),
      targetDate: t("export.targetDate"),
      quarterGoal: t("export.quarterGoal"),
      quarterGoalTarget: t("export.quarterGoalTarget"),
      description: t("export.description"),
    },
    status: Object.fromEntries(STATUS_VALUES.map((s) => [s, t(`status.${s}`)])),
    priority: Object.fromEntries(PRIORITY_VALUES.map((p) => [p, t(`priority.${p}`)])),
    unknown: t("common.unknown"),
  });

  if (error) {
    return <PageError title={t("initiatives.loadError")} description={t("common.refreshHint")} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("initiatives.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("initiatives.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={isExporting || filteredInitiatives.length === 0}
            onClick={async () => {
              setIsExporting(true);
              try {
                await exportInitiativesToExcel(
                  filteredInitiatives,
                  departments,
                  undefined,
                  buildExportLabels(),
                );
                toast({
                  title: t("initiatives.exportComplete"),
                  description: t("initiatives.exportCompleteDescription"),
                });
              } catch (error) {
                toast({ title: t("initiatives.exportFailed"), variant: "destructive" });
              } finally {
                setIsExporting(false);
              }
            }}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {isExporting ? t("initiatives.exporting") : t("initiatives.exportToExcel")}
          </Button>
          <Button onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" />
            {t("initiatives.newInitiative")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("initiatives.searchPlaceholder")}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("initiatives.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("initiatives.allStatuses")}</SelectItem>
            {STATUS_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`status.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={quarterFilter} onValueChange={setQuarterFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("initiatives.filterByQuarter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("initiatives.allQuarters")}</SelectItem>
            {quarterOptions.map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(statusFilter !== "all" || quarterFilter !== "all" || searchQuery) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setQuarterFilter("all");
              setSearchQuery("");
            }}
          >
            {t("initiatives.clearFilters")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <CardSkeletonGrid />
      ) : (
      <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pagedInitiatives.map((initiative) => (
          <Card
            key={initiative.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setDetailInitiative(initiative)}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex flex-wrap gap-1">
                  <Badge variant={initiative.status === "blocked" ? "destructive" : "secondary"}>
                    {t(`status.${initiative.status}`, initiative.status)}
                  </Badge>
                  {isInitiativeOverdue(initiative) && (
                    <Badge variant="destructive">{t("initiatives.overdue")}</Badge>
                  )}
                </div>
                <Badge variant="outline">{t(`priority.${initiative.priority}`, initiative.priority)}</Badge>
              </div>
              <CardTitle className="mt-4 text-lg">{initiative.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {initiative.description || t("initiatives.noDescription")}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{t("initiatives.progress")}</span>
                    <span>{initiative.progress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2"
                      style={{ width: `${initiative.progress}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                  <span>{initiative.owner}</span>
                  <span className={isInitiativeOverdue(initiative) ? "text-destructive font-medium" : undefined}>
                    {t("initiatives.due", {
                      date: new Date(initiative.targetDate).toLocaleDateString(dateLocale),
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingInitiative(initiative);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletingInitiative(initiative)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!filteredInitiatives.length && (
        <div className="text-center py-12 text-muted-foreground">
          {initiatives?.length ? t("initiatives.emptyFiltered") : t("initiatives.emptyNone")}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) setPage(currentPage - 1);
                }}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
              <PaginationItem key={pageNumber}>
                <PaginationLink
                  href="#"
                  isActive={pageNumber === currentPage}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(pageNumber);
                  }}
                >
                  {pageNumber}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) setPage(currentPage + 1);
                }}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
      </>
      )}

      <InitiativeFormDialog open={formOpen} onOpenChange={setFormOpen} initiative={editingInitiative} />

      <InitiativeDetailDialog
        open={Boolean(detailInitiative)}
        onOpenChange={(open) => !open && setDetailInitiative(null)}
        initiative={detailInitiative}
      />

      <ConfirmDeleteDialog
        open={Boolean(deletingInitiative)}
        onOpenChange={(open) => !open && setDeletingInitiative(null)}
        title={t("initiatives.deleteTitle")}
        description={t("initiatives.deleteDescription", { title: deletingInitiative?.title })}
        onConfirm={() => deletingInitiative && deleteMutation.mutate({ id: deletingInitiative.id })}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
