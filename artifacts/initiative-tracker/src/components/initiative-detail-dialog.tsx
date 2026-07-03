import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListInitiativeDependencies,
  useDeleteDependency,
  useListDepartments,
  useListRiskCategories,
  getListInitiativeDependenciesQueryKey,
  getListDependenciesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetDependencyHeatmapQueryKey,
} from "@workspace/api-client-react";
import type { Initiative, Dependency } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DependencyFormDialog } from "@/components/dependency-form-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useToast } from "@/hooks/use-toast";

const riskVariant: Record<string, "secondary" | "outline" | "destructive"> = {
  low: "secondary",
  medium: "outline",
  high: "destructive",
  critical: "destructive",
};

interface InitiativeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initiative: Initiative | null;
}

export function InitiativeDetailDialog({ open, onOpenChange, initiative }: InitiativeDetailDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: departments } = useListDepartments();
  const { data: riskCategories } = useListRiskCategories();
  const { data: dependencies, isLoading } = useListInitiativeDependencies(initiative?.id ?? 0, {
    query: { enabled: Boolean(initiative), queryKey: getListInitiativeDependenciesQueryKey(initiative?.id ?? 0) },
  });

  const [depFormOpen, setDepFormOpen] = useState(false);
  const [editingDependency, setEditingDependency] = useState<Dependency | null>(null);
  const [deletingDependency, setDeletingDependency] = useState<Dependency | null>(null);

  const deleteMutation = useDeleteDependency({
    mutation: {
      onSuccess: () => {
        if (initiative) {
          queryClient.invalidateQueries({ queryKey: getListInitiativeDependenciesQueryKey(initiative.id) });
        }
        queryClient.invalidateQueries({ queryKey: getListDependenciesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDependencyHeatmapQueryKey() });
        toast({ title: "Dependency removed" });
        setDeletingDependency(null);
      },
      onError: () => {
        toast({ title: "Failed to remove dependency", variant: "destructive" });
      },
    },
  });

  const departmentName = (id: number | null) => departments?.find((d) => d.id === id)?.name ?? "Unknown";
  const riskCategoryName = (id: number | null) =>
    riskCategories?.find((c) => c.id === id)?.name ?? "Unknown";

  if (!initiative) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initiative.title}</DialogTitle>
          <DialogDescription>{initiative.description || "No description provided."}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{initiative.status}</Badge>
          <Badge variant="outline">{initiative.priority} priority</Badge>
          <span>Owner: {initiative.owner}</span>
          <span>Progress: {initiative.progress}%</span>
        </div>

        {initiative.quarterGoal && (
          <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1">
            <p className="font-semibold">Quarter Goal</p>
            <p className="text-muted-foreground">{initiative.quarterGoal}</p>
            {initiative.quarterGoalTarget !== null && initiative.quarterGoalTarget !== undefined && (
              <p className="text-muted-foreground">
                Target: {initiative.quarterGoalTarget}% (currently {initiative.progress}%)
              </p>
            )}
          </div>
        )}

        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Dependencies</h3>
            <Button
              size="sm"
              onClick={() => {
                setEditingDependency(null);
                setDepFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Dependency
            </Button>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading dependencies...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Depends on</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dependencies?.map((dep) => (
                  <TableRow key={dep.id}>
                    <TableCell>
                      {dep.dependsOnDepartmentId
                        ? departmentName(dep.dependsOnDepartmentId)
                        : riskCategoryName(dep.dependsOnRiskCategoryId)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={riskVariant[dep.riskLevel] ?? "secondary"}>{dep.riskLevel}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {dep.notes}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingDependency(dep);
                          setDepFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeletingDependency(dep)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!dependencies?.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      No dependencies recorded.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        <DependencyFormDialog
          open={depFormOpen}
          onOpenChange={setDepFormOpen}
          initiativeId={initiative.id}
          dependency={editingDependency}
        />

        <ConfirmDeleteDialog
          open={Boolean(deletingDependency)}
          onOpenChange={(open) => !open && setDeletingDependency(null)}
          title="Remove dependency?"
          description="This will permanently remove this dependency record."
          onConfirm={() => deletingDependency && deleteMutation.mutate({ id: deletingDependency.id })}
          isPending={deleteMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
