import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateDepartment,
  useUpdateDepartment,
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
import { useToast } from "@/hooks/use-toast";

const departmentFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  colorHex: z
    .string()
    .min(1, "Color is required")
    .regex(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/, "Must be a valid hex color"),
});

type DepartmentFormValues = z.infer<typeof departmentFormSchema>;

interface DepartmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: Department | null;
}

export function DepartmentFormDialog({ open, onOpenChange, department }: DepartmentFormDialogProps) {
  const isEditing = Boolean(department);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: { name: "", colorHex: "#3B82F6" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: department?.name ?? "",
        colorHex: department?.colorHex ?? "#3B82F6",
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
        toast({ title: "Department created" });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Failed to create department", variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateDepartment({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Department updated" });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Failed to update department", variant: "destructive" });
      },
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: DepartmentFormValues) => {
    if (isEditing && department) {
      updateMutation.mutate({ id: department.id, data: values });
    } else {
      createMutation.mutate({ data: values });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Department" : "Add Department"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the department's name and color."
              : "Create a new department to organize initiatives."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dept-name">Name</Label>
            <Input id="dept-name" placeholder="e.g. Engineering" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-color">Color</Label>
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
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
