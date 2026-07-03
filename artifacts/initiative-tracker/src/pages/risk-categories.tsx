import { useState } from "react";
import {
  useListRiskCategories,
  useDeleteRiskCategory,
  getListRiskCategoriesQueryKey,
  getGetDependencyHeatmapQueryKey,
} from "@workspace/api-client-react";
import type { RiskCategory } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { RiskCategoryFormDialog } from "@/components/risk-category-form-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useToast } from "@/hooks/use-toast";
import { PageLoading, PageError } from "@/components/page-state";

export default function RiskCategories() {
  const { data: riskCategories, isLoading, error } = useListRiskCategories();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRiskCategory, setEditingRiskCategory] = useState<RiskCategory | null>(null);
  const [deletingRiskCategory, setDeletingRiskCategory] = useState<RiskCategory | null>(null);

  const deleteMutation = useDeleteRiskCategory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRiskCategoriesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDependencyHeatmapQueryKey() });
        toast({ title: t("riskCategories.deleted") });
        setDeletingRiskCategory(null);
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" && error !== null && "message" in error
            ? String((error as { message?: unknown }).message)
            : undefined;
        toast({
          title: t("riskCategories.deleteFailed"),
          description:
            message && message.includes("in use")
              ? message
              : t("riskCategories.deleteFailedFallback"),
          variant: "destructive",
        });
        setDeletingRiskCategory(null);
      },
    },
  });

  const openCreateForm = () => {
    setEditingRiskCategory(null);
    setFormOpen(true);
  };

  const openEditForm = (riskCategory: RiskCategory) => {
    setEditingRiskCategory(riskCategory);
    setFormOpen(true);
  };

  if (isLoading) {
    return <PageLoading label={t("riskCategories.loading")} />;
  }

  if (error) {
    return <PageError title={t("riskCategories.loadError")} description={t("common.refreshHint")} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t("riskCategories.title")}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{t("riskCategories.subtitle")}</p>
        </div>
        <Button onClick={openCreateForm} className="self-start sm:self-auto">
          <Plus className="mr-2 h-4 w-4" />
          {t("riskCategories.add")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("riskCategories.all")}</CardTitle>
          <CardDescription>{t("riskCategories.allSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {riskCategories?.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditForm(category)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingRiskCategory(category)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {t("common.delete")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!riskCategories?.length && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                    {t("riskCategories.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RiskCategoryFormDialog open={formOpen} onOpenChange={setFormOpen} riskCategory={editingRiskCategory} />

      <ConfirmDeleteDialog
        open={Boolean(deletingRiskCategory)}
        onOpenChange={(open) => !open && setDeletingRiskCategory(null)}
        title={t("riskCategories.deleteTitle")}
        description={t("riskCategories.deleteDescription", { name: deletingRiskCategory?.name })}
        onConfirm={() => deletingRiskCategory && deleteMutation.mutate({ id: deletingRiskCategory.id })}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
