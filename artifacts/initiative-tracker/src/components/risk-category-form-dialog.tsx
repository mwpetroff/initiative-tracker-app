import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateRiskCategory,
  useUpdateRiskCategory,
  getListRiskCategoriesQueryKey,
  getGetDependencyHeatmapQueryKey,
} from "@workspace/api-client-react";
import type { RiskCategory } from "@workspace/api-client-react";
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

const riskCategoryFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

type RiskCategoryFormValues = z.infer<typeof riskCategoryFormSchema>;

interface RiskCategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riskCategory?: RiskCategory | null;
}

export function RiskCategoryFormDialog({ open, onOpenChange, riskCategory }: RiskCategoryFormDialogProps) {
  const isEditing = Boolean(riskCategory);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<RiskCategoryFormValues>({
    resolver: zodResolver(riskCategoryFormSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: riskCategory?.name ?? "" });
    }
  }, [open, riskCategory, form]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListRiskCategoriesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDependencyHeatmapQueryKey() });
  };

  const createMutation = useCreateRiskCategory({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Risk category created" });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" && error !== null && "message" in error
            ? String((error as { message?: unknown }).message)
            : undefined;
        toast({
          title: "Failed to create risk category",
          description: message?.includes("already exists") ? message : undefined,
          variant: "destructive",
        });
      },
    },
  });

  const updateMutation = useUpdateRiskCategory({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Risk category updated" });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" && error !== null && "message" in error
            ? String((error as { message?: unknown }).message)
            : undefined;
        toast({
          title: "Failed to update risk category",
          description: message?.includes("already exists") ? message : undefined,
          variant: "destructive",
        });
      },
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: RiskCategoryFormValues) => {
    if (isEditing && riskCategory) {
      updateMutation.mutate({ id: riskCategory.id, data: values });
    } else {
      createMutation.mutate({ data: values });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Risk Category" : "Add Risk Category"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this risk matrix category."
              : "Create a new category dependencies can be tracked against, beyond departments."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="risk-cat-name">Name</Label>
            <Input id="risk-cat-name" placeholder="e.g. Regulatory" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
