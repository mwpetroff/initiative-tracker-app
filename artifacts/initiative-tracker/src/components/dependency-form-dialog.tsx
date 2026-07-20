import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  useCreateDependency,
  useUpdateDependency,
  useListDepartments,
  useListRiskCategories,
  getListInitiativeDependenciesQueryKey,
  getListDependenciesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetDependencyHeatmapQueryKey,
} from "@workspace/api-client-react";
import type { Dependency } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildDepartmentGroups } from "@/lib/department-tree";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { localizedName } from "@/lib/localized-name";

function makeDependencyFormSchema(t: TFunction) {
  return z
    .object({
      dependencyType: z.enum(["department", "external"]),
      dependsOnDepartmentId: z.string().optional(),
      dependsOnRiskCategoryId: z.string().optional(),
      riskLevel: z.enum(["low", "medium", "high", "critical"]),
      notes: z.string(),
    })
    .refine(
      (data) =>
        data.dependencyType === "department"
          ? Boolean(data.dependsOnDepartmentId)
          : Boolean(data.dependsOnRiskCategoryId),
      {
        message: t("dependencyForm.selectionRequired"),
        path: ["dependsOnDepartmentId"],
      },
    );
}

type DependencyFormValues = z.infer<ReturnType<typeof makeDependencyFormSchema>>;

interface DependencyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initiativeId: number;
  dependency?: Dependency | null;
}

export function DependencyFormDialog({
  open,
  onOpenChange,
  initiativeId,
  dependency,
}: DependencyFormDialogProps) {
  const isEditing = Boolean(dependency);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { data: departments } = useListDepartments();
  const { data: riskCategories } = useListRiskCategories();

  const schema = useMemo(() => makeDependencyFormSchema(t), [t]);

  const form = useForm<DependencyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      dependencyType: "department",
      dependsOnDepartmentId: "",
      dependsOnRiskCategoryId: "",
      riskLevel: "medium",
      notes: "",
    },
  });

  const dependencyType = form.watch("dependencyType");

  useEffect(() => {
    if (open) {
      form.reset({
        dependencyType: dependency?.dependsOnRiskCategoryId ? "external" : "department",
        dependsOnDepartmentId: dependency?.dependsOnDepartmentId
          ? String(dependency.dependsOnDepartmentId)
          : "",
        dependsOnRiskCategoryId: dependency?.dependsOnRiskCategoryId
          ? String(dependency.dependsOnRiskCategoryId)
          : "",
        riskLevel: dependency?.riskLevel ?? "medium",
        notes: dependency?.notes ?? "",
      });
    }
  }, [open, dependency, form]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListInitiativeDependenciesQueryKey(initiativeId) });
    queryClient.invalidateQueries({ queryKey: getListDependenciesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDependencyHeatmapQueryKey() });
  };

  const createMutation = useCreateDependency({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: t("dependencyForm.added") });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: t("dependencyForm.addFailed"), variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateDependency({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: t("dependencyForm.updated") });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: t("dependencyForm.updateFailed"), variant: "destructive" });
      },
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: DependencyFormValues) => {
    const basePayload = {
      dependsOnDepartmentId:
        values.dependencyType === "department" && values.dependsOnDepartmentId
          ? Number(values.dependsOnDepartmentId)
          : null,
      dependsOnRiskCategoryId:
        values.dependencyType === "external" && values.dependsOnRiskCategoryId
          ? Number(values.dependsOnRiskCategoryId)
          : null,
      riskLevel: values.riskLevel,
      notes: values.notes,
    };

    if (isEditing && dependency) {
      updateMutation.mutate({ id: dependency.id, data: basePayload });
    } else {
      createMutation.mutate({ data: { initiativeId, ...basePayload } });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("dependencyForm.editTitle") : t("dependencyForm.addTitle")}</DialogTitle>
          <DialogDescription>{t("dependencyForm.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("dependencyForm.dependsOn")}</Label>
            <Controller
              control={form.control}
              name="dependencyType"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="department" id="dep-type-dept" />
                    <Label htmlFor="dep-type-dept" className="font-normal">
                      {t("dependencyForm.anotherDepartment")}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="external" id="dep-type-ext" />
                    <Label htmlFor="dep-type-ext" className="font-normal">
                      {t("dependencyForm.externalFactor")}
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>

          {dependencyType === "department" ? (
            <div className="space-y-2">
              <Label>{t("dependencyForm.department")}</Label>
              <Controller
                control={form.control}
                name="dependsOnDepartmentId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("dependencyForm.selectDepartment")} />
                    </SelectTrigger>
                    <SelectContent>
                      {buildDepartmentGroups(departments, i18n.language).map((group) =>
                        group.children.length > 0 ? (
                          <SelectGroup key={group.department.id}>
                            <SelectLabel>{localizedName(group.department, i18n.language)}</SelectLabel>
                            <SelectItem value={String(group.department.id)}>
                              {localizedName(group.department, i18n.language)}
                            </SelectItem>
                            {group.children.map((child) => (
                              <SelectItem key={child.id} value={String(child.id)} className="pl-8">
                                {localizedName(child, i18n.language)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ) : (
                          <SelectItem key={group.department.id} value={String(group.department.id)}>
                            {localizedName(group.department, i18n.language)}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t("dependencyForm.riskCategory")}</Label>
              <Controller
                control={form.control}
                name="dependsOnRiskCategoryId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("dependencyForm.selectRiskCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      {riskCategories?.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {localizedName(category, i18n.language)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
          {form.formState.errors.dependsOnDepartmentId && (
            <p className="text-sm text-destructive">
              {form.formState.errors.dependsOnDepartmentId.message}
            </p>
          )}

          <div className="space-y-2">
            <Label>{t("dependencyForm.riskLevel")}</Label>
            <Controller
              control={form.control}
              name="riskLevel"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t("risk.low")}</SelectItem>
                    <SelectItem value="medium">{t("risk.medium")}</SelectItem>
                    <SelectItem value="high">{t("risk.high")}</SelectItem>
                    <SelectItem value="critical">{t("risk.critical")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dep-notes">{t("common.notes")}</Label>
            <Textarea id="dep-notes" rows={3} {...form.register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t("common.saving")
                : isEditing
                  ? t("dependencyForm.saveChanges")
                  : t("dependencyForm.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
