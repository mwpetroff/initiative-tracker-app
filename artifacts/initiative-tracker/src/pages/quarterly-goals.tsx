import { useMemo } from "react";
import { useGetSettings, useListInitiatives, useListDepartments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getFiscalQuarter, formatDateRange } from "@/lib/quarter";

export default function QuarterlyGoals() {
  const { data: settings, isLoading: settingsLoading } = useGetSettings();
  const { data: initiatives, isLoading: initiativesLoading } = useListInitiatives();
  const { data: departments } = useListDepartments();

  const currentQuarter = useMemo(() => {
    if (!settings) return null;
    return getFiscalQuarter(new Date(`${settings.quarterStartDate.slice(0, 10)}T00:00:00Z`));
  }, [settings]);

  const departmentName = (id: number | null) => departments?.find((d) => d.id === id)?.name ?? "Unknown";

  const goalInitiatives = (initiatives ?? []).filter((i) => i.quarterGoal);

  const isLoading = settingsLoading || initiativesLoading;

  const onTrackCount = goalInitiatives.filter(
    (i) => i.quarterGoalTarget !== null && i.quarterGoalTarget !== undefined && i.progress >= i.quarterGoalTarget,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quarterly Goals</h1>
          <p className="text-muted-foreground mt-2">Progress against goals for the current fiscal quarter.</p>
        </div>
        {currentQuarter && (
          <Badge variant="outline" className="text-sm py-1.5 px-3">
            {currentQuarter.label} · {formatDateRange(currentQuarter.startDate, currentQuarter.endDate)}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : goalInitiatives.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No initiatives have a quarter goal set yet. Edit an initiative to add one.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Goals Tracked</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{goalInitiatives.length}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">On Track / Met</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{onTrackCount}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Behind Target</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{goalInitiatives.length - onTrackCount}</CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {goalInitiatives.map((initiative) => {
              const target = initiative.quarterGoalTarget;
              const hasTarget = target !== null && target !== undefined;
              const met = hasTarget && initiative.progress >= target;
              return (
                <Card key={initiative.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{initiative.title}</CardTitle>
                      {hasTarget && (
                        <Badge variant={met ? "secondary" : "outline"}>{met ? "On Track" : "Behind"}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{departmentName(initiative.departmentId)}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">{initiative.quarterGoal}</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Progress: {initiative.progress}%</span>
                        {hasTarget && <span>Target: {target}%</span>}
                      </div>
                      <Progress value={initiative.progress} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
