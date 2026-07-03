import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Target, Activity, PauseCircle, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageLoading, PageError } from "@/components/page-state";

export default function Dashboard() {
  const { data: summary, isLoading, error } = useGetDashboardSummary();

  if (isLoading) {
    return <PageLoading label="Loading dashboard..." />;
  }

  if (error || !summary) {
    return <PageError title="Couldn't load the dashboard" description="Please try refreshing the page." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
        <p className="text-muted-foreground mt-2">Overview of initiatives and risks.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Initiatives</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalInitiatives}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeInitiatives}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
            <PauseCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.blockedInitiatives}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <CalendarClock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.overdueInitiatives}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Dependencies</CardTitle>
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
            <CardTitle>Department Breakdown</CardTitle>
            <CardDescription>Initiatives by department and status.</CardDescription>
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
                    <p className="text-sm font-medium leading-none">{dept.departmentName}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{dept.inProgress} Active</span>
                      <span>•</span>
                      <span>{dept.blocked} Blocked</span>
                    </div>
                  </div>
                  <div className="font-medium text-sm">{dept.total} Total</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest status changes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{activity.title}</p>
                    <div className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                      <span>{activity.departmentName}</span>
                      <span>•</span>
                      <Badge variant="outline" className="font-normal">
                        {activity.oldStatus}
                      </Badge>
                      <span>→</span>
                      <Badge
                        variant={activity.newStatus === "blocked" ? "destructive" : "secondary"}
                        className="font-normal"
                      >
                        {activity.newStatus}
                      </Badge>
                    </div>
                  </div>
                  <div className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(activity.changedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {!summary.recentActivity.length && (
                <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
