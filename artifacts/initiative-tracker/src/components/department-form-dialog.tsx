import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  useCreateDepartment,
  useUpdateDepartment,
  useListDepartments,
  getListDepartmentsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetDependencyHeatmapQueryKey,
  getListInitiativesQueryKey,
} from "@workspace/api-client-react";
import type { Department } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { localizedName } from "@/lib/localized-name";

function makeDepartmentFormSchema(t: TFunction) {
  return z.object({
    name: z.string().min(1, t("departments.nameRequired")),
    nameJa: z.string(),
    colorHex: z
      .string()
      .min(1, t("departments.colorRequired"))
      .regex(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/, t("departments.colorInvalid")),
    parentId: z.string(),
  });
}

type DepartmentFormValues = z.infer<ReturnType<typeof makeDepartmentFormSchema>>;

interface DepartmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: Department | null;
}

export function DepartmentFormDialog({ open, onOpenChange, department }: DepartmentFormDialogProps) {
  const isEditing = Boolean(department);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { data: departments } = useListDepartments();

  const schema = useMemo(() => makeDepartmentFormSchema(t), [t]);

  const hasChildren = useMemo(
    () => Boolean(department && departments?.some((d) => d.parentId === department.id)),
    [department, departments],
  );

  const parentOptions = useMemo(
    () =>
      (departments ?? []).filter((d) => d.parentId == null && d.id !== department?.id),
    [departments, department],
  );

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", nameJa: "", colorHex: "#3B82F6", parentId: "none" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: department?.name ?? "",
        nameJa: department?.nameJa ?? "",
        colorHex: department?.colorHex ?? "#3B82F6",
        parentId: department?.parentId != null ? String(department.parentId) : "none",
      });
    }
  }, [open, department, form]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDependencyHeatmapQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListInitiativesQueryKey() });
  };

  const createMutation = useCreateDepartment({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: t("departments.created") });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: t("departments.createFailed"), variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateDepartment({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: t("departments.updated") });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: t("departments.updateFailed"), variant: "destructive" });
      },
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: DepartmentFormValues) => {
    const data = {
      name: values.name,
      nameJa: values.nameJa.trim() ? values.nameJa.trim() : null,
      colorHex: values.colorHex,
      parentId: values.parentId === "none" ? null : Number(values.parentId),
    };
    if (isEditing && department) {
      updateMutation.mutate({ id: department.id, data });
    } else {
      createMutation.mutate({ data });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("departments.formEditTitle") : t("departments.formAddTitle")}</DialogTitle>
          <DialogDescription>
            {isEditing ? t("departments.formEditDescription") : t("departments.formAddDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dept-name">{t("common.name")}</Label>
            <Input id="dept-name" placeholder={t("departments.namePlaceholder")} {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-name-ja">{t("common.nameJa")}</Label>
            <Input
              id="dept-name-ja"
              placeholder={t("departments.nameJaPlaceholder")}
              {...form.register("nameJa")}
            />
            <p className="text-xs text-muted-foreground">{t("common.nameJaHint")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("departments.parent")}</Label>
            <Controller
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={hasChildren}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("departments.parentNone")}</SelectItem>
                    {parentOptions.map((dept) => (
                      <SelectItem key={dept.id} value={String(dept.id)}>
                        {localizedName(dept, i18n.language)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              {hasChildren ? t("departments.parentDisabledHint") : t("departments.parentHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-color">{t("departments.color")}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="dept-color"
                type="color"
                className="h-10 w-14 p-1"
                {...form.register("colorHex")}
              />
              <Input placeholder="#3B82F6" {...form.register("colorHex")} />
            </div>
            {form.formState.errors.colorHex && (
              <p className="text-sm text-destructive">{form.formState.errors.colorHex.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t("common.saving")
                : isEditing
                  ? t("departments.saveChanges")
                  : t("departments.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
