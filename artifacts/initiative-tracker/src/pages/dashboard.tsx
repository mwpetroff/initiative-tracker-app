import { useGetDashboardSummary } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Target, Activity, PauseCircle, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageLoading, PageError } from "@/components/page-state";
import { useDateLocale } from "@/i18n";
import { localizedLabel } from "@/lib/localized-name";

export default function Dashboard() {
  const { data: summary, isLoading, error } = useGetDashboardSummary();
  const { t, i18n } = useTranslation();
  const dateLocale = useDateLocale();

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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.totalInitiatives")}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalInitiatives}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.active")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeInitiatives}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.blocked")}</CardTitle>
            <PauseCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.blockedInitiatives}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.overdue")}</CardTitle>
            <CalendarClock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.overdueInitiatives}</div>
          </CardContent>
        </Card>
        <Card>
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
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>{t("dashboard.departmentBreakdown")}</CardTitle>
            <CardDescription>{t("dashboard.departmentBreakdownSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.departmentBreakdown.map((dept) => (
                <div key={dept.departmentId} className="flex items-center">
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
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
            <CardDescription>{t("dashboard.recentActivitySubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{activity.title}</p>
                    <div className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                      <span>{localizedLabel(activity.departmentName, activity.departmentNameJa, i18n.language)}</span>
                      <span>•</span>
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
                    </div>
                  </div>
                  <div className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(activity.changedAt).toLocaleDateString(dateLocale)}
                  </div>
                </div>
              ))}
              {!summary.recentActivity.length && (
                <p className="text-sm text-muted-foreground">{t("dashboard.noActivity")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
