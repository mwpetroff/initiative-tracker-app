import { useState } from "react";
import {
  useListDepartments,
  useDeleteDepartment,
  getListDepartmentsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetDependencyHeatmapQueryKey,
} from "@workspace/api-client-react";
import type { Department } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DepartmentFormDialog } from "@/components/department-form-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useToast } from "@/hooks/use-toast";

export default function Departments() {
  const { data: departments, isLoading } = useListDepartments();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);

  const deleteMutation = useDeleteDepartment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDependencyHeatmapQueryKey() });
        toast({ title: "Department deleted" });
        setDeletingDepartment(null);
      },
      onError: () => {
        toast({
          title: "Failed to delete department",
          description: "It may still be referenced by initiatives or dependencies.",
          variant: "destructive",
        });
      },
    },
  });

  const openCreateForm = () => {
    setEditingDepartment(null);
    setFormOpen(true);
  };

  const openEditForm = (department: Department) => {
    setEditingDepartment(department);
    setFormOpen(true);
  };

  if (isLoading) {
    return <div className="p-8">Loading departments...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
          <p className="text-muted-foreground mt-2">Manage organizational departments.</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="mr-2 h-4 w-4" />
          Add Department
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Departments</CardTitle>
          <CardDescription>A list of all departments in the organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Color</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments?.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell>
                    <div
                      className="w-4 h-4 rounded-full border border-border"
                      style={{ backgroundColor: dept.colorHex }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditForm(dept)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingDepartment(dept)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!departments?.length && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No departments found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DepartmentFormDialog open={formOpen} onOpenChange={setFormOpen} department={editingDepartment} />

      <ConfirmDeleteDialog
        open={Boolean(deletingDepartment)}
        onOpenChange={(open) => !open && setDeletingDepartment(null)}
        title="Delete department?"
        description={`This will permanently delete "${deletingDepartment?.name}". Initiatives or dependencies referencing this department may be affected.`}
        onConfirm={() => deletingDepartment && deleteMutation.mutate({ id: deletingDepartment.id })}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
