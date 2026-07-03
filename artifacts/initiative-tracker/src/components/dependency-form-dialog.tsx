import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

const dependencyFormSchema = z
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
      message: "Select a department or a risk category",
      path: ["dependsOnDepartmentId"],
    },
  );

type DependencyFormValues = z.infer<typeof dependencyFormSchema>;

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
  const { data: departments } = useListDepartments();
  const { data: riskCategories } = useListRiskCategories();

  const form = useForm<DependencyFormValues>({
    resolver: zodResolver(dependencyFormSchema),
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
        toast({ title: "Dependency added" });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Failed to add dependency", variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateDependency({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Dependency updated" });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Failed to update dependency", variant: "destructive" });
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
          <DialogTitle>{isEditing ? "Edit Dependency" : "Add Dependency"}</DialogTitle>
          <DialogDescription>
            Track what this initiative depends on and its associated risk.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Depends on</Label>
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
                      Another department
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="external" id="dep-type-ext" />
                    <Label htmlFor="dep-type-ext" className="font-normal">
                      External factor
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>

          {dependencyType === "department" ? (
            <div className="space-y-2">
              <Label>Department</Label>
              <Controller
                control={form.control}
                name="dependsOnDepartmentId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
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
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Risk category</Label>
              <Controller
                control={form.control}
                name="dependsOnRiskCategoryId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select risk category" />
                    </SelectTrigger>
                    <SelectContent>
                      {riskCategories?.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.name}
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
            <Label>Risk Level</Label>
            <Controller
              control={form.control}
              name="riskLevel"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dep-notes">Notes</Label>
            <Textarea id="dep-notes" rows={3} {...form.register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Dependency"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
