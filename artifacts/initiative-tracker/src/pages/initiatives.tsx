import { useListInitiatives } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Initiatives() {
  const { data: initiatives, isLoading } = useListInitiatives();

  if (isLoading) {
    return <div className="p-8">Loading initiatives...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Initiatives</h1>
          <p className="text-muted-foreground mt-2">Manage and track all initiatives.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Initiative
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {initiatives?.map((initiative) => (
          <Card key={initiative.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <Badge variant={initiative.status === "blocked" ? "destructive" : "secondary"}>
                  {initiative.status}
                </Badge>
                <Badge variant="outline">{initiative.priority}</Badge>
              </div>
              <CardTitle className="mt-4 text-lg">{initiative.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {initiative.description || "No description provided."}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Progress</span>
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
                  <span>Due {new Date(initiative.targetDate).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {!initiatives?.length && (
        <div className="text-center py-12 text-muted-foreground">
          No initiatives found. Create one to get started.
        </div>
      )}
    </div>
  );
}
