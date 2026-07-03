import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  useCreateInitiative,
  useUpdateInitiative,
  useListDepartments,
  getListInitiativesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetDependencyHeatmapQueryKey,
} from "@workspace/api-client-react";
import type { Initiative } from "@workspace/api-client-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

function toDateInputValue(value?: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

function makeInitiativeFormSchema(t: TFunction) {
  return z.object({
    title: z.string().min(1, t("initiativeForm.titleRequired")),
    description: z.string(),
    departmentId: z.string().min(1, t("initiativeForm.departmentRequired")),
    status: z.enum(["planning", "in_progress", "blocked", "completed", "on_hold"]),
    priority: z.enum(["low", "medium", "high"]),
    owner: z.string().min(1, t("initiativeForm.ownerRequired")),
    progress: z.coerce.number().min(0).max(100),
    startDate: z.string().min(1, t("initiativeForm.startDateRequired")),
    targetDate: z.string().min(1, t("initiativeForm.targetDateRequired")),
    quarterGoal: z.string(),
    quarterGoalTarget: z.string(),
  });
}

type InitiativeFormValues = z.infer<ReturnType<typeof makeInitiativeFormSchema>>;

interface InitiativeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initiative?: Initiative | null;
}

export function InitiativeFormDialog({ open, onOpenChange, initiative }: InitiativeFormDialogProps) {
  const isEditing = Boolean(initiative);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { data: departments } = useListDepartments();

  const schema = useMemo(() => makeInitiativeFormSchema(t), [t]);

  const form = useForm<InitiativeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      departmentId: "",
      status: "planning",
      priority: "medium",
      owner: "",
      progress: 0,
      startDate: "",
      targetDate: "",
      quarterGoal: "",
      quarterGoalTarget: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: initiative?.title ?? "",
        description: initiative?.description ?? "",
        departmentId: initiative ? String(initiative.departmentId) : "",
        status: initiative?.status ?? "planning",
        priority: initiative?.priority ?? "medium",
        owner: initiative?.owner ?? "",
        progress: initiative?.progress ?? 0,
        startDate: toDateInputValue(initiative?.startDate),
        targetDate: toDateInputValue(initiative?.targetDate),
        quarterGoal: initiative?.quarterGoal ?? "",
        quarterGoalTarget:
          initiative?.quarterGoalTarget !== undefined && initiative?.quarterGoalTarget !== null
            ? String(initiative.quarterGoalTarget)
            : "",
      });
    }
  }, [open, initiative, form]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListInitiativesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDependencyHeatmapQueryKey() });
  };

  const createMutation = useCreateInitiative({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: t("initiativeForm.created") });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: t("initiativeForm.createFailed"), variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateInitiative({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: t("initiativeForm.updated") });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: t("initiativeForm.updateFailed"), variant: "destructive" });
      },
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: InitiativeFormValues) => {
    const payload = {
      title: values.title,
      description: values.description,
      departmentId: Number(values.departmentId),
      status: values.status,
      priority: values.priority,
      owner: values.owner,
      progress: values.progress,
      startDate: values.startDate,
      targetDate: values.targetDate,
      quarterGoal: values.quarterGoal.trim() ? values.quarterGoal.trim() : null,
      quarterGoalTarget: values.quarterGoalTarget.trim() ? Number(values.quarterGoalTarget) : null,
    };

    if (isEditing && initiative) {
      updateMutation.mutate({ id: initiative.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("initiativeForm.editTitle") : t("initiativeForm.newTitle")}</DialogTitle>
          <DialogDescription>
            {isEditing ? t("initiativeForm.editDescription") : t("initiativeForm.newDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="init-title">{t("initiativeForm.titleLabel")}</Label>
            <Input
              id="init-title"
              placeholder={t("initiativeForm.titlePlaceholder")}
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="init-description">{t("initiativeForm.descriptionLabel")}</Label>
            <Textarea id="init-description" rows={3} {...form.register("description")} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("initiativeForm.department")}</Label>
              <Controller
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("initiativeForm.selectDepartment")} />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map((dept) => (
                        <SelectItem key={dept.id} value={String(dept.id)}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.departmentId && (
                <p className="text-sm text-destructive">{form.formState.errors.departmentId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="init-owner">{t("initiativeForm.owner")}</Label>
              <Input
                id="init-owner"
                placeholder={t("initiativeForm.ownerPlaceholder")}
                {...form.register("owner")}
              />
              {form.formState.errors.owner && (
                <p className="text-sm text-destructive">{form.formState.errors.owner.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t("initiativeForm.status")}</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">{t("status.planning")}</SelectItem>
                      <SelectItem value="in_progress">{t("status.in_progress")}</SelectItem>
                      <SelectItem value="blocked">{t("status.blocked")}</SelectItem>
                      <SelectItem value="completed">{t("status.completed")}</SelectItem>
                      <SelectItem value="on_hold">{t("status.on_hold")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("initiativeForm.priority")}</Label>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t("priority.low")}</SelectItem>
                      <SelectItem value="medium">{t("priority.medium")}</SelectItem>
                      <SelectItem value="high">{t("priority.high")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="init-progress">{t("initiativeForm.progressLabel")}</Label>
              <Input
                id="init-progress"
                type="number"
                min={0}
                max={100}
                {...form.register("progress")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="init-start">{t("initiativeForm.startDate")}</Label>
              <Input id="init-start" type="date" {...form.register("startDate")} />
              {form.formState.errors.startDate && (
                <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="init-target">{t("initiativeForm.targetDate")}</Label>
              <Input id="init-target" type="date" {...form.register("targetDate")} />
              {form.formState.errors.targetDate && (
                <p className="text-sm text-destructive">{form.formState.errors.targetDate.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-md border p-3">
            <p className="text-sm font-medium">{t("initiativeForm.quarterGoalSection")}</p>
            <div className="space-y-2">
              <Label htmlFor="init-quarter-goal">{t("initiativeForm.goalDescription")}</Label>
              <Textarea
                id="init-quarter-goal"
                rows={2}
                placeholder={t("initiativeForm.goalPlaceholder")}
                {...form.register("quarterGoal")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="init-quarter-goal-target">{t("initiativeForm.goalTargetLabel")}</Label>
              <Input
                id="init-quarter-goal-target"
                type="number"
                min={0}
                max={100}
                placeholder={t("initiativeForm.goalTargetPlaceholder")}
                {...form.register("quarterGoalTarget")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t("common.saving")
                : isEditing
                  ? t("initiativeForm.saveChanges")
                  : t("initiativeForm.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
