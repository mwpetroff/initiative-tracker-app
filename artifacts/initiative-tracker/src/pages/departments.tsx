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
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DepartmentFormDialog } from "@/components/department-form-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useToast } from "@/hooks/use-toast";
import { PageLoading, PageError } from "@/components/page-state";

export default function Departments() {
  const { data: departments, isLoading, error } = useListDepartments();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [formOpen, setFormOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);

  const deleteMutation = useDeleteDepartment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDependencyHeatmapQueryKey() });
        toast({ title: t("departments.deleted") });
        setDeletingDepartment(null);
      },
      onError: (error) => {
        const description =
          error instanceof Error && error.message
            ? error.message
            : t("departments.deleteFailedFallback");
        toast({
          title: t("departments.deleteFailed"),
          description,
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
    return <PageLoading label={t("departments.loading")} />;
  }

  if (error) {
    return <PageError title={t("departments.loadError")} description={t("common.refreshHint")} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t("departments.title")}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{t("departments.subtitle")}</p>
        </div>
        <Button onClick={openCreateForm} className="self-start sm:self-auto">
          <Plus className="mr-2 h-4 w-4" />
          {t("departments.add")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("departments.all")}</CardTitle>
          <CardDescription>{t("departments.allSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("departments.color")}</TableHead>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
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
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingDepartment(dept)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {t("common.delete")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!departments?.length && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    {t("departments.empty")}
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
        title={t("departments.deleteTitle")}
        description={t("departments.deleteDescription", { name: deletingDepartment?.name })}
        onConfirm={() => deletingDepartment && deleteMutation.mutate({ id: deletingDepartment.id })}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
