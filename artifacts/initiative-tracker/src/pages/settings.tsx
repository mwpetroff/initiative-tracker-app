import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getFiscalQuarter, formatDateRange } from "@/lib/quarter";
import { PageLoading, PageError } from "@/components/page-state";
import { useQuarterLocale } from "@/i18n";
import Departments from "@/pages/departments";
import RiskCategories from "@/pages/risk-categories";

function makeSettingsFormSchema(t: TFunction) {
  return z.object({
    quarterStartDate: z.string().min(1, t("settings.quarterStartDateRequired")),
  });
}

type SettingsFormValues = z.infer<ReturnType<typeof makeSettingsFormSchema>>;

function GeneralSettings() {
  const { data: settings, isLoading, error } = useGetSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const quarterLocale = useQuarterLocale();

  const schema = useMemo(() => makeSettingsFormSchema(t), [t]);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(schema),
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
        toast({ title: t("settings.updated") });
      },
      onError: () => {
        toast({ title: t("settings.updateFailed"), variant: "destructive" });
      },
    },
  });

  const onSubmit = (values: SettingsFormValues) => {
    updateMutation.mutate({ data: { quarterStartDate: values.quarterStartDate } });
  };

  const watchedDate = form.watch("quarterStartDate");
  const previewAnchor = watchedDate ? new Date(`${watchedDate}T00:00:00Z`) : null;
  const previewQuarter =
    previewAnchor && !Number.isNaN(previewAnchor.getTime())
      ? getFiscalQuarter(previewAnchor, new Date(), quarterLocale)
      : null;

  if (isLoading) {
    return <PageLoading label={t("settings.loading")} />;
  }

  if (error) {
    return <PageError title={t("settings.loadError")} description={t("common.refreshHint")} />;
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{t("settings.fiscalQuarters")}</CardTitle>
        <CardDescription>{t("settings.fiscalQuartersDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quarter-start-date">{t("settings.quarterStartDate")}</Label>
            <Input id="quarter-start-date" type="date" {...form.register("quarterStartDate")} />
            {form.formState.errors.quarterStartDate && (
              <p className="text-sm text-destructive">
                {form.formState.errors.quarterStartDate.message}
              </p>
            )}
            <p className="text-sm text-muted-foreground">{t("settings.quarterStartDateHelp")}</p>
          </div>

          {previewQuarter && (
            <div className="rounded-md border bg-muted/50 p-3 text-sm">
              <span className="font-medium">{t("settings.currentQuarter")}</span>
              {previewQuarter.label} (
              {formatDateRange(previewQuarter.startDate, previewQuarter.endDate, quarterLocale)})
            </div>
          )}

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t("common.saving") : t("settings.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const VALID_TABS = ["general", "departments", "risk-categories"] as const;
type SettingsTab = (typeof VALID_TABS)[number];

export default function Settings() {
  const search = useSearch();
  const requestedTab = new URLSearchParams(search).get("tab");
  const initialTab: SettingsTab =
    requestedTab && (VALID_TABS as readonly string[]).includes(requestedTab)
      ? (requestedTab as SettingsTab)
      : "general";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const { t } = useTranslation();

  useEffect(() => {
    if (requestedTab && (VALID_TABS as readonly string[]).includes(requestedTab)) {
      setActiveTab(requestedTab as SettingsTab);
    }
  }, [requestedTab]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("settings.subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">{t("settings.tabGeneral")}</TabsTrigger>
          <TabsTrigger value="departments">{t("settings.tabDepartments")}</TabsTrigger>
          <TabsTrigger value="risk-categories">{t("settings.tabRiskCategories")}</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-6">
          <GeneralSettings />
        </TabsContent>
        <TabsContent value="departments" className="mt-6">
          <Departments />
        </TabsContent>
        <TabsContent value="risk-categories" className="mt-6">
          <RiskCategories />
        </TabsContent>
      </Tabs>
    </div>
  );
}
