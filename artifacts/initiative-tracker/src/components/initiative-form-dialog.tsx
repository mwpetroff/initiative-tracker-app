import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
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

const initiativeFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string(),
  departmentId: z.string().min(1, "Department is required"),
  status: z.enum(["planning", "in_progress", "blocked", "completed", "on_hold"]),
  priority: z.enum(["low", "medium", "high"]),
  owner: z.string().min(1, "Owner is required"),
  progress: z.coerce.number().min(0).max(100),
  startDate: z.string().min(1, "Start date is required"),
  targetDate: z.string().min(1, "Target date is required"),
});

type InitiativeFormValues = z.infer<typeof initiativeFormSchema>;

interface InitiativeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initiative?: Initiative | null;
}

export function InitiativeFormDialog({ open, onOpenChange, initiative }: InitiativeFormDialogProps) {
  const isEditing = Boolean(initiative);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: departments } = useListDepartments();

  const form = useForm<InitiativeFormValues>({
    resolver: zodResolver(initiativeFormSchema),
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
        toast({ title: "Initiative created" });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Failed to create initiative", variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateInitiative({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Initiative updated" });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Failed to update initiative", variant: "destructive" });
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
    };

    if (isEditing && initiative) {
      updateMutation.mutate({ id: initiative.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Initiative" : "New Initiative"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this initiative's details." : "Track a new initiative for your team."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="init-title">Title</Label>
            <Input id="init-title" placeholder="e.g. Migrate core API" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="init-description">Description</Label>
            <Textarea id="init-description" rows={3} {...form.register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Controller
                control={form.control}
                name="departmentId"
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
              {form.formState.errors.departmentId && (
                <p className="text-sm text-destructive">{form.formState.errors.departmentId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="init-owner">Owner</Label>
              <Input id="init-owner" placeholder="e.g. Jane Doe" {...form.register("owner")} />
              {form.formState.errors.owner && (
                <p className="text-sm text-destructive">{form.formState.errors.owner.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="init-progress">Progress %</Label>
              <Input
                id="init-progress"
                type="number"
                min={0}
                max={100}
                {...form.register("progress")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="init-start">Start Date</Label>
              <Input id="init-start" type="date" {...form.register("startDate")} />
              {form.formState.errors.startDate && (
                <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="init-target">Target Date</Label>
              <Input id="init-target" type="date" {...form.register("targetDate")} />
              {form.formState.errors.targetDate && (
                <p className="text-sm text-destructive">{form.formState.errors.targetDate.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Initiative"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
