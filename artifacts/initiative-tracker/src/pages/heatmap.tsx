import { useGetDependencyHeatmap } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Heatmap() {
  const { data: heatmap, isLoading } = useGetDependencyHeatmap();

  if (isLoading) {
    return <div className="p-8">Loading heatmap...</div>;
  }

  if (!heatmap) {
    return <div className="p-8">Error loading heatmap.</div>;
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
          <CardDescription>Rows are departments with initiatives; columns are what they depend on.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-4 py-3 font-medium">Department</th>
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
                  <td className="px-4 py-3 font-medium flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: row.colorHex }} />
                    {row.name}
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
                        <div className={`h-12 w-full rounded-md flex items-center justify-center ${bgClass} transition-colors hover:opacity-80 cursor-pointer`}>
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
    </div>
  );
}
