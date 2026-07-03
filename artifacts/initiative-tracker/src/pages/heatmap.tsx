import { useState } from "react";
import { useGetDependencyHeatmap } from "@workspace/api-client-react";
import type { HeatmapCell } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoading, PageError } from "@/components/page-state";

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

export default function Heatmap() {
  const { data: heatmap, isLoading, error } = useGetDependencyHeatmap();
  const [selected, setSelected] = useState<SelectedCell | null>(null);

  if (isLoading) {
    return <PageLoading label="Loading heatmap..." />;
  }

  if (error || !heatmap) {
    return <PageError title="Couldn't load the heatmap" description="Please try refreshing the page." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dependency Heatmap</h1>
        <p className="text-muted-foreground mt-2">Visualize cross-department dependencies and risk.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk Matrix</CardTitle>
          <CardDescription>
            Rows are departments with initiatives; columns are what they depend on. Click a cell for details.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm text-left border-separate border-spacing-0">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="sticky left-0 z-10 bg-muted/50 px-4 py-3 font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                  Department
                </th>
                {heatmap.columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 font-medium whitespace-nowrap">
                    {col.label} {col.isExternal ? "(Ext)" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 bg-background px-4 py-3 font-medium whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: row.colorHex }} />
                      {row.name}
                    </div>
                  </td>
                  {heatmap.columns.map((col) => {
                    const cell = heatmap.cells.find(
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
                      <td key={col.key} className="p-1">
                        <div
                          role={cell ? "button" : undefined}
                          tabIndex={cell ? 0 : undefined}
                          onClick={
                            cell
                              ? () => setSelected({ cell, rowName: row.name, columnLabel: col.label })
                              : undefined
                          }
                          onKeyDown={
                            cell
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setSelected({ cell, rowName: row.name, columnLabel: col.label });
                                  }
                                }
                              : undefined
                          }
                          className={`h-12 w-full rounded-md flex items-center justify-center ${bgClass} transition-colors ${cell ? "hover:opacity-80 cursor-pointer" : ""}`}
                        >
                          {cell ? cell.dependencyCount : "-"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
                  {selected.cell.dependencyCount}{" "}
                  {selected.cell.dependencyCount === 1 ? "dependency" : "dependencies"} in this cell.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {selected.cell.dependencies.map((dep) => (
                  <div key={dep.dependencyId} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{dep.initiativeTitle}</p>
                      <Badge variant={RISK_BADGE_VARIANT[dep.riskLevel] ?? "outline"}>
                        {dep.riskLevel}
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
