import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getFiscalQuarter, formatDateRange } from "@/lib/quarter";

const settingsFormSchema = z.object({
  quarterStartDate: z.string().min(1, "Quarter start date is required"),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: { quarterStartDate: "" },
  });

  useEffect(() => {
    if (settings) {
      form.reset({ quarterStartDate: settings.quarterStartDate.slice(0, 10) });
    }
  }, [settings, form]);

  const updateMutation = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Settings updated" });
      },
      onError: () => {
        toast({ title: "Failed to update settings", variant: "destructive" });
      },
    },
  });

  const onSubmit = (values: SettingsFormValues) => {
    updateMutation.mutate({ data: { quarterStartDate: values.quarterStartDate } });
  };

  const watchedDate = form.watch("quarterStartDate");
  const previewAnchor = watchedDate ? new Date(`${watchedDate}T00:00:00Z`) : null;
  const previewQuarter =
    previewAnchor && !Number.isNaN(previewAnchor.getTime()) ? getFiscalQuarter(previewAnchor) : null;

  if (isLoading) {
    return <div className="p-8">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Configure company-wide settings.</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Fiscal Quarters</CardTitle>
          <CardDescription>
            Set the date your company's fiscal quarters begin. Quarterly goals and progress views are
            calculated from this date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quarter-start-date">Quarter Start Date</Label>
              <Input id="quarter-start-date" type="date" {...form.register("quarterStartDate")} />
              {form.formState.errors.quarterStartDate && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.quarterStartDate.message}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Fiscal quarters recur every 3 months starting from this date (month and day).
              </p>
            </div>

            {previewQuarter && (
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                <span className="font-medium">Current quarter: </span>
                {previewQuarter.label} ({formatDateRange(previewQuarter.startDate, previewQuarter.endDate)})
              </div>
            )}

            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
