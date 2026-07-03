import { useMemo, useState } from "react";
import {
  useListInitiatives,
  useDeleteInitiative,
  useGetSettings,
  getListInitiativesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetDependencyHeatmapQueryKey,
} from "@workspace/api-client-react";
import type { Initiative } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { InitiativeFormDialog } from "@/components/initiative-form-dialog";
import { InitiativeDetailDialog } from "@/components/initiative-detail-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useToast } from "@/hooks/use-toast";
import { getFiscalQuarter } from "@/lib/quarter";

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
  on_hold: "On Hold",
};

export default function Initiatives() {
  const { data: initiatives, isLoading } = useListInitiatives();
  const { data: settings } = useGetSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null);
  const [deletingInitiative, setDeletingInitiative] = useState<Initiative | null>(null);
  const [detailInitiative, setDetailInitiative] = useState<Initiative | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [quarterFilter, setQuarterFilter] = useState<string>("all");

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
      const q = getFiscalQuarter(anchorDate, new Date(`${initiative.targetDate.slice(0, 10)}T00:00:00Z`));
      const key = `${q.year}-Q${q.quarterNumber}`;
      map.set(key, q.label);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [initiatives, anchorDate]);

  const filteredInitiatives = useMemo(() => {
    return (initiatives ?? []).filter((initiative) => {
      if (statusFilter !== "all" && initiative.status !== statusFilter) return false;
      if (quarterFilter !== "all" && initiativeQuarterKey(initiative) !== quarterFilter) return false;
      return true;
    });
  }, [initiatives, statusFilter, quarterFilter, anchorDate]);

  const deleteMutation = useDeleteInitiative({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInitiativesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDependencyHeatmapQueryKey() });
        toast({ title: "Initiative deleted" });
        setDeletingInitiative(null);
      },
      onError: () => {
        toast({ title: "Failed to delete initiative", variant: "destructive" });
      },
    },
  });

  const openCreateForm = () => {
    setEditingInitiative(null);
    setFormOpen(true);
  };

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
        <Button onClick={openCreateForm}>
          <Plus className="mr-2 h-4 w-4" />
          New Initiative
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={quarterFilter} onValueChange={setQuarterFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by quarter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Quarters</SelectItem>
            {quarterOptions.map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(statusFilter !== "all" || quarterFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setQuarterFilter("all");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredInitiatives.map((initiative) => (
          <Card
            key={initiative.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setDetailInitiative(initiative)}
          >
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
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletingInitiative(initiative)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!filteredInitiatives.length && (
        <div className="text-center py-12 text-muted-foreground">
          {initiatives?.length
            ? "No initiatives match the selected filters."
            : "No initiatives found. Create one to get started."}
        </div>
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
        title="Delete initiative?"
        description={`This will permanently delete "${deletingInitiative?.title}" and its dependencies.`}
        onConfirm={() => deletingInitiative && deleteMutation.mutate({ id: deletingInitiative.id })}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
