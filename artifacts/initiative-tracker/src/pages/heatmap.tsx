import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useGetDependencyHeatmap, getGetDependencyHeatmapQueryKey } from "@workspace/api-client-react";
import type { HeatmapCell, Department, InitiativeStatus } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { buildDepartmentGroups } from "@/lib/department-tree";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoading, PageError } from "@/components/page-state";
import { localizedName, localizedLabel, compareLocalized } from "@/lib/localized-name";

const RISK_BADGE_VARIANT: Record<string, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

interface SelectedCell {
  cell: HeatmapCell;
  rowName: string;
  columnLabel: string;
}

const RISK_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

function aggregateCells(
  memberIds: number[],
  columnKey: string,
  cells: HeatmapCell[],
): HeatmapCell | null {
  const matched = cells.filter(
    (c) => c.columnKey === columnKey && memberIds.includes(c.rowDepartmentId),
  );
  if (!matched.length) return null;
  let maxRiskLevel: string | null = null;
  for (const c of matched) {
    if (c.maxRiskLevel && (!maxRiskLevel || RISK_ORDER[c.maxRiskLevel] > RISK_ORDER[maxRiskLevel])) {
      maxRiskLevel = c.maxRiskLevel;
    }
  }
  return {
    rowDepartmentId: memberIds[0],
    columnKey,
    dependencyCount: matched.reduce((sum, c) => sum + c.dependencyCount, 0),
    maxRiskLevel: maxRiskLevel as HeatmapCell["maxRiskLevel"],
    riskScore: matched.reduce((sum, c) => sum + c.riskScore, 0),
    dependencies: matched.flatMap((c) => c.dependencies),
  };
}

type HeatmapRow =
  | { kind: "department"; department: Department; indent: boolean }
  | { kind: "group"; department: Department; memberIds: number[]; expanded: boolean };

export default function Heatmap() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const params =
    statusFilter !== "all"
      ? { status: statusFilter as InitiativeStatus }
      : undefined;
  const {
    data: heatmap,
    isLoading,
    error,
  } = useGetDependencyHeatmap(params, {
    query: {
      queryKey: getGetDependencyHeatmapQueryKey(params),
      placeholderData: (prev) => prev,
    },
  });
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const { t, i18n } = useTranslation();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollHints();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateScrollHints);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateScrollHints, heatmap]);

  const displayRows = useMemo<HeatmapRow[]>(() => {
    const groups = buildDepartmentGroups(heatmap?.rows, i18n.language);
    const rows: HeatmapRow[] = [];
    for (const group of groups) {
      if (group.children.length > 0) {
        const expanded = expandedGroups.has(group.department.id);
        rows.push({
          kind: "group",
          department: group.department,
          memberIds: [group.department.id, ...group.children.map((c) => c.id)],
          expanded,
        });
        if (expanded) {
          for (const child of group.children) {
            rows.push({ kind: "department", department: child, indent: true });
          }
        }
      } else {
        rows.push({ kind: "department", department: group.department, indent: false });
      }
    }
    return rows;
  }, [heatmap, i18n.language, expandedGroups]);

  const toggleGroup = (id: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return <PageLoading label={t("heatmap.loading")} />;
  }

  if (error || !heatmap) {
    return <PageError title={t("heatmap.loadError")} description={t("common.refreshHint")} />;
  }

  const sortedColumns = [...heatmap.columns].sort((a, b) => {
    if (a.isExternal !== b.isExternal) {
      return a.isExternal ? 1 : -1;
    }
    return compareLocalized(
      localizedLabel(a.label, a.labelJa, i18n.language),
      localizedLabel(b.label, b.labelJa, i18n.language),
      i18n.language,
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("heatmap.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("heatmap.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="heatmap-status-filter" className="text-sm text-muted-foreground">
            {t("heatmap.statusFilter")}
          </Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="heatmap-status-filter" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("heatmap.allStatuses")}</SelectItem>
              <SelectItem value="planning">{t("status.planning")}</SelectItem>
              <SelectItem value="in_progress">{t("status.in_progress")}</SelectItem>
              <SelectItem value="blocked">{t("status.blocked")}</SelectItem>
              <SelectItem value="completed">{t("status.completed")}</SelectItem>
              <SelectItem value="on_hold">{t("status.on_hold")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("heatmap.riskMatrix")}</CardTitle>
          <CardDescription>{t("heatmap.riskMatrixDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative">
            {canScrollLeft && (
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-40 flex items-center">
                <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/10 to-transparent" />
                <div className="relative ml-1 rounded-full bg-background/90 border shadow-sm p-1">
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            )}
            {canScrollRight && (
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-40 flex items-center justify-end">
                <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/10 to-transparent" />
                <div className="relative mr-1 animate-pulse rounded-full bg-background/90 border shadow-sm p-1">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            )}
          <div
            ref={scrollRef}
            onScroll={updateScrollHints}
            className="overflow-auto max-h-[calc(100vh-16rem)] rounded-b-xl"
          >
          <table className="w-full text-sm text-left border-separate border-spacing-0">
            <thead className="text-xs text-muted-foreground uppercase">
              <tr>
                <th className="sticky left-0 top-0 z-30 bg-muted px-4 py-2 font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                  {t("heatmap.department")}
                </th>
                {sortedColumns.map((col) => (
                  <th key={col.key} className="sticky top-0 z-20 bg-muted px-2 py-2 font-medium whitespace-nowrap text-center shadow-[0_2px_4px_-2px_rgba(0,0,0,0.15)]">
                    {localizedLabel(col.label, col.labelJa, i18n.language)}{" "}
                    {col.isExternal ? t("heatmap.external") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((displayRow) => {
                const row = displayRow.department;
                const isGroup = displayRow.kind === "group";
                return (
                <tr key={`${displayRow.kind}-${row.id}`} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 bg-background px-4 py-1.5 font-medium whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                    {isGroup ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(row.id)}
                        className="flex items-center gap-2 font-semibold hover:opacity-80"
                        aria-expanded={displayRow.expanded}
                        aria-label={t("heatmap.toggleGroup", {
                          name: localizedName(row, i18n.language),
                        })}
                      >
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 transition-transform ${displayRow.expanded ? "rotate-90" : ""}`}
                        />
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: row.colorHex }} />
                        {localizedName(row, i18n.language)}
                      </button>
                    ) : (
                      <div
                        className={`flex items-center gap-2 ${displayRow.indent ? "pl-8 font-normal" : ""}`}
                      >
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: row.colorHex }} />
                        {localizedName(row, i18n.language)}
                      </div>
                    )}
                  </td>
                  {sortedColumns.map((col) => {
                    const cell = isGroup
                      ? aggregateCells(displayRow.memberIds, col.key, heatmap.cells)
                      : heatmap.cells.find(
                          (c) => c.rowDepartmentId === row.id && c.columnKey === col.key
                        );

                    let bgClass = "bg-transparent";
                    if (cell) {
                      if (cell.maxRiskLevel === "critical") bgClass = "bg-destructive/80 text-destructive-foreground font-bold";
                      else if (cell.maxRiskLevel === "high") bgClass = "bg-orange-500/80 text-white font-bold";
                      else if (cell.maxRiskLevel === "medium") bgClass = "bg-yellow-500/80 text-white";
                      else if (cell.maxRiskLevel === "low") bgClass = "bg-blue-500/80 text-white";
                    }

                    return (
                      <td key={col.key} className="p-0.5">
                        <div
                          role={cell ? "button" : undefined}
                          tabIndex={cell ? 0 : undefined}
                          onClick={
                            cell
                              ? () =>
                                  setSelected({
                                    cell,
                                    rowName: localizedName(row, i18n.language) ?? row.name,
                                    columnLabel: localizedLabel(col.label, col.labelJa, i18n.language),
                                  })
                              : undefined
                          }
                          onKeyDown={
                            cell
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setSelected({
                                      cell,
                                      rowName: localizedName(row, i18n.language) ?? row.name,
                                      columnLabel: localizedLabel(col.label, col.labelJa, i18n.language),
                                    });
                                  }
                                }
                              : undefined
                          }
                          className={`h-8 w-full min-w-12 rounded-md flex items-center justify-center ${bgClass} transition-colors ${cell ? "hover:opacity-80 cursor-pointer" : "text-muted-foreground/40"}`}
                        >
                          {cell ? cell.dependencyCount : "–"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.rowName} → {selected.columnLabel}
                </DialogTitle>
                <DialogDescription>
                  {t("heatmap.dependencyCount", { count: selected.cell.dependencyCount })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {selected.cell.dependencies.map((dep) => (
                  <div key={dep.dependencyId} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{dep.initiativeTitle}</p>
                      <Badge variant={RISK_BADGE_VARIANT[dep.riskLevel] ?? "outline"}>
                        {t(`risk.${dep.riskLevel}`, dep.riskLevel)}
                      </Badge>
                    </div>
                    {dep.notes && <p className="text-sm text-muted-foreground">{dep.notes}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
