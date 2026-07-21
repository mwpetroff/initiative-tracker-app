import { useGetDashboardSummary, useListDepartments } from "@workspace/api-client-react";
import type { DepartmentStatusBreakdown } from "@workspace/api-client-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { buildDepartmentGroups, departmentMemberIds } from "@/lib/department-tree";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Target, Activity, PauseCircle, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DepartmentFilterSelect } from "@/components/department-filter-select";
import { PageLoading, PageError } from "@/components/page-state";
import { useDateLocale } from "@/i18n";
import { localizedLabel } from "@/lib/localized-name";

interface BreakdownGroup {
  header: DepartmentStatusBreakdown | null;
  rollup: { total: number; inProgress: number; blocked: number } | null;
  items: DepartmentStatusBreakdown[];
}

export default function Dashboard() {
  const { data: summary, isLoading, error } = useGetDashboardSummary();
  const { data: departments } = useListDepartments();
  const { t, i18n } = useTranslation();
  const dateLocale = useDateLocale();
  const [, navigate] = useLocation();
  const [activityDept, setActivityDept] = useState<string>("all");

  const filteredActivity = useMemo(() => {
    const items = summary?.recentActivity ?? [];
    if (activityDept === "all") return items;
    const memberIds = new Set(departmentMemberIds(Number(activityDept), departments));
    return items.filter((a) => memberIds.has(a.departmentId));
  }, [summary, activityDept, departments]);

  const statCardProps = (href: string) => ({
    role: "link" as const,
    tabIndex: 0,
    className: "cursor-pointer transition-shadow hover:shadow-md",
    onClick: () => navigate(href),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigate(href);
      }
    },
  });

  const breakdownGroups = useMemo<BreakdownGroup[]>(() => {
    const breakdown = summary?.departmentBreakdown ?? [];
    const byId = new Map(breakdown.map((b) => [b.departmentId, b]));
    const groups = buildDepartmentGroups(departments, i18n.language);
    if (!groups.length) {
      return breakdown.length ? [{ header: null, rollup: null, items: breakdown }] : [];
    }
    const result: BreakdownGroup[] = [];
    const seen = new Set<number>();
    for (const group of groups) {
      const parentEntry = byId.get(group.department.id);
      const childEntries = group.children
        .map((c) => byId.get(c.id))
        .filter((e): e is DepartmentStatusBreakdown => Boolean(e));
      if (parentEntry) seen.add(parentEntry.departmentId);
      for (const e of childEntries) seen.add(e.departmentId);

      if (group.children.length > 0) {
        const all = [...(parentEntry ? [parentEntry] : []), ...childEntries];
        if (!all.length) continue;
        const rollup = all.reduce(
          (acc, e) => ({
            total: acc.total + e.total,
            inProgress: acc.inProgress + e.inProgress,
            blocked: acc.blocked + e.blocked,
          }),
          { total: 0, inProgress: 0, blocked: 0 },
        );
        result.push({
          header:
            parentEntry ??
            ({
              departmentId: group.department.id,
              departmentName: group.department.name,
              departmentNameJa: group.department.nameJa,
              colorHex: group.department.colorHex,
              total: 0,
              planning: 0,
              inProgress: 0,
              blocked: 0,
              completed: 0,
              onHold: 0,
            } satisfies DepartmentStatusBreakdown),
          rollup,
          items: childEntries,
        });
      } else if (parentEntry) {
        result.push({ header: null, rollup: null, items: [parentEntry] });
      }
    }
    const leftovers = breakdown.filter((b) => !seen.has(b.departmentId) && !result.some((g) => g.items.includes(b)));
    if (leftovers.length) result.push({ header: null, rollup: null, items: leftovers });
    return result;
  }, [summary, departments, i18n.language]);

  if (isLoading) {
    return <PageLoading label={t("dashboard.loading")} />;
  }

  if (error || !summary) {
    return <PageError title={t("dashboard.loadError")} description={t("common.refreshHint")} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card {...statCardProps("/initiatives")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.totalInitiatives")}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalInitiatives}</div>
          </CardContent>
        </Card>
        <Card {...statCardProps("/initiatives?status=in_progress")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.active")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeInitiatives}</div>
          </CardContent>
        </Card>
        <Card {...statCardProps("/initiatives?status=blocked")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.blocked")}</CardTitle>
            <PauseCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.blockedInitiatives}</div>
          </CardContent>
        </Card>
        <Card {...statCardProps("/initiatives?overdue=1")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.overdue")}</CardTitle>
            <CalendarClock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.overdueInitiatives}</div>
          </CardContent>
        </Card>
        <Card {...statCardProps("/heatmap")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.highRiskDependencies")}</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.highRiskDependencies}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>{t("dashboard.departmentBreakdown")}</CardTitle>
            <CardDescription>{t("dashboard.departmentBreakdownSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {breakdownGroups.map((group, groupIndex) => (
                <div key={group.header?.departmentId ?? `standalone-${groupIndex}`} className="space-y-3">
                  {group.header && group.rollup && (
                    <div
                      className="flex items-center rounded-md bg-muted/50 px-2 py-2 cursor-pointer hover:bg-muted transition-colors"
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(`/initiatives?department=${group.header!.departmentId}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/initiatives?department=${group.header!.departmentId}`);
                        }
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-full mr-4"
                        style={{ backgroundColor: group.header.colorHex }}
                      />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold leading-none">
                          {localizedLabel(group.header.departmentName, group.header.departmentNameJa, i18n.language)}
                        </p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>{t("dashboard.activeCount", { count: group.rollup.inProgress })}</span>
                          <span>•</span>
                          <span>{t("dashboard.blockedCount", { count: group.rollup.blocked })}</span>
                        </div>
                      </div>
                      <div className="font-semibold text-sm">
                        {t("dashboard.totalCount", { count: group.rollup.total })}
                      </div>
                    </div>
                  )}
                  {group.items.map((dept) => (
                    <div
                      key={dept.departmentId}
                      className={`flex items-center rounded-md px-2 py-1 -mx-2 cursor-pointer hover:bg-muted/50 transition-colors ${group.header ? "pl-6" : ""}`}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(`/initiatives?department=${dept.departmentId}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/initiatives?department=${dept.departmentId}`);
                        }
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-full mr-4"
                        style={{ backgroundColor: dept.colorHex }}
                      />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {localizedLabel(dept.departmentName, dept.departmentNameJa, i18n.language)}
                        </p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>{t("dashboard.activeCount", { count: dept.inProgress })}</span>
                          <span>•</span>
                          <span>{t("dashboard.blockedCount", { count: dept.blocked })}</span>
                        </div>
                      </div>
                      <div className="font-medium text-sm">{t("dashboard.totalCount", { count: dept.total })}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-4">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
              <CardDescription>{t("dashboard.recentActivitySubtitle")}</CardDescription>
            </div>
            <DepartmentFilterSelect
              departments={departments}
              value={activityDept}
              onValueChange={setActivityDept}
              className="w-52"
            />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 rounded-md px-2 py-1 -mx-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/initiatives?search=${encodeURIComponent(activity.title)}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/initiatives?search=${encodeURIComponent(activity.title)}`);
                    }
                  }}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{activity.title}</p>
                    <div className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                      <span>{localizedLabel(activity.departmentName, activity.departmentNameJa, i18n.language)}</span>
                      <span>•</span>
                      {activity.activityType === "status_change" && activity.oldStatus && activity.newStatus ? (
                        <>
                          <Badge variant="outline" className="font-normal">
                            {t(`status.${activity.oldStatus}`, activity.oldStatus)}
                          </Badge>
                          <span>→</span>
                          <Badge
                            variant={activity.newStatus === "blocked" ? "destructive" : "secondary"}
                            className="font-normal"
                          >
                            {t(`status.${activity.newStatus}`, activity.newStatus)}
                          </Badge>
                        </>
                      ) : activity.activityType === "created" ? (
                        <Badge variant="secondary" className="font-normal">
                          {t("dashboard.activityCreated")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-normal">
                          {t("dashboard.activityUpdatePosted")}
                        </Badge>
                      )}
                    </div>
                    {activity.activityType === "update_posted" && activity.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{activity.summary}</p>
                    )}
                  </div>
                  <div className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(activity.changedAt).toLocaleDateString(dateLocale)}
                  </div>
                </div>
              ))}
              {!filteredActivity.length && (
                <p className="text-sm text-muted-foreground">{t("dashboard.noActivity")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
