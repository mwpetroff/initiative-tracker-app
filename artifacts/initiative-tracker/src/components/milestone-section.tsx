import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  useListMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  getListMilestonesQueryKey,
} from "@workspace/api-client-react";
import type { Milestone, MilestoneStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InlineLoading, PageError } from "@/components/page-state";
import { useDateLocale } from "@/i18n";

const STATUS_CLASS: Record<MilestoneStatus, string> = {
  planned: "",
  in_progress: "",
  blocked: "border-transparent bg-red-600 text-white hover:bg-red-600/90",
  completed: "border-transparent bg-green-600 text-white hover:bg-green-600/90",
};

const STATUS_VARIANT: Record<MilestoneStatus, "outline" | "secondary"> = {
  planned: "outline",
  in_progress: "secondary",
  blocked: "outline",
  completed: "outline",
};

interface MilestoneDraft {
  title: string;
  startDate: string;
  endDate: string;
  owner: string;
  status: MilestoneStatus;
  note: string;
}

const EMPTY_DRAFT: MilestoneDraft = {
  title: "",
  startDate: "",
  endDate: "",
  owner: "",
  status: "planned",
  note: "",
};

interface MilestoneSectionProps {
  initiativeId: number;
}

export function MilestoneSection({ initiativeId }: MilestoneSectionProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  const {
    data: milestones,
    isLoading,
    error,
  } = useListMilestones(initiativeId, {
    query: { queryKey: getListMilestonesQueryKey(initiativeId) },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<MilestoneDraft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    setFormOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
    setDeletingId(null);
  }, [initiativeId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListMilestonesQueryKey(initiativeId) });
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
  };

  const createMutation = useCreateMilestone({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("milestones.added") });
        closeForm();
      },
      onError: () => {
        toast({ title: t("milestones.addFailed"), variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateMilestone({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("milestones.updated") });
        closeForm();
      },
      onError: () => {
        toast({ title: t("milestones.updateFailed"), variant: "destructive" });
      },
    },
  });

  const deleteMutation = useDeleteMilestone({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeletingId(null);
        toast({ title: t("milestones.removed") });
      },
      onError: () => {
        setDeletingId(null);
        toast({ title: t("milestones.removeFailed"), variant: "destructive" });
      },
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const startEdit = (m: Milestone) => {
    setEditingId(m.id);
    setDraft({
      title: m.title,
      startDate: String(m.startDate).slice(0, 10),
      endDate: String(m.endDate).slice(0, 10),
      owner: m.owner,
      status: m.status,
      note: m.note ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  };

  const submit = () => {
    if (!draft.title.trim()) {
      setFormError(t("milestones.titleRequired"));
      return;
    }
    if (!draft.owner.trim()) {
      setFormError(t("milestones.ownerRequired"));
      return;
    }
    if (!draft.startDate || !draft.endDate) {
      setFormError(t("milestones.datesRequired"));
      return;
    }
    if (draft.endDate < draft.startDate) {
      setFormError(t("milestones.dateOrderError"));
      return;
    }
    setFormError(null);

    const payload = {
      title: draft.title.trim(),
      startDate: draft.startDate,
      endDate: draft.endDate,
      owner: draft.owner.trim(),
      status: draft.status,
      note: draft.note.trim() ? draft.note.trim() : null,
    };

    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate({ id: initiativeId, data: payload });
    }
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">{t("milestones.title")}</h3>
        {!formOpen && (
          <Button
            size="sm"
            onClick={() => {
              setEditingId(null);
              setDraft(EMPTY_DRAFT);
              setFormError(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("milestones.add")}
          </Button>
        )}
      </div>

      {formOpen && (
        <div className="rounded-md border p-3 mb-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {editingId !== null ? t("milestones.editTitle") : t("milestones.newTitle")}
            </p>
            <Button variant="ghost" size="sm" aria-label={t("common.cancel")} onClick={closeForm}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ms-title">{t("milestones.titleLabel")}</Label>
              <Input
                id="ms-title"
                value={draft.title}
                placeholder={t("milestones.titlePlaceholder")}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms-owner">{t("milestones.owner")}</Label>
              <Input
                id="ms-owner"
                value={draft.owner}
                placeholder={t("milestones.ownerPlaceholder")}
                onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms-start">{t("milestones.startDate")}</Label>
              <Input
                id="ms-start"
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms-end">{t("milestones.endDate")}</Label>
              <Input
                id="ms-end"
                type="date"
                value={draft.endDate}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("milestones.status")}</Label>
              <Select
                value={draft.status}
                onValueChange={(value) => setDraft({ ...draft, status: value as MilestoneStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">{t("milestones.statusPlanned")}</SelectItem>
                  <SelectItem value="in_progress">{t("status.in_progress")}</SelectItem>
                  <SelectItem value="blocked">{t("status.blocked")}</SelectItem>
                  <SelectItem value="completed">{t("status.completed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms-note">{t("milestones.note")}</Label>
              <Input
                id="ms-note"
                value={draft.note}
                placeholder={t("milestones.notePlaceholder")}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={closeForm}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" disabled={isPending} onClick={submit}>
              {isPending
                ? t("common.saving")
                : editingId !== null
                  ? t("milestones.save")
                  : t("milestones.create")}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <InlineLoading label={t("milestones.loading")} />
      ) : error ? (
        <PageError title={t("milestones.loadError")} description={t("common.refreshHint")} />
      ) : milestones?.length ? (
        <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {milestones.map((m) => (
            <li key={m.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{m.title}</p>
                    <Badge
                      variant={STATUS_VARIANT[m.status] ?? "outline"}
                      className={STATUS_CLASS[m.status] ?? ""}
                    >
                      {m.status === "planned"
                        ? t("milestones.statusPlanned")
                        : t(`status.${m.status}`, m.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(m.startDate).toLocaleDateString(dateLocale)} –{" "}
                    {new Date(m.endDate).toLocaleDateString(dateLocale)} · {m.owner}
                  </p>
                  {m.note && <p className="text-sm text-muted-foreground">{m.note}</p>}
                </div>
                <div className="flex shrink-0 -mt-1 -mr-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t("common.edit")}
                    onClick={() => startEdit(m)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t("common.delete")}
                    className="text-destructive hover:text-destructive"
                    disabled={deleteMutation.isPending && deletingId === m.id}
                    onClick={() => {
                      setDeletingId(m.id);
                      deleteMutation.mutate({ id: m.id });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("milestones.empty")}</p>
      )}
    </div>
  );
}
