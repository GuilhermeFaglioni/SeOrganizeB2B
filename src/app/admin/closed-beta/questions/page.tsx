"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import {
  useCreateQuestionBankItem,
  useQuestionBank,
  useSetQuestionBankItemStatus,
  useUpdateQuestionBankItem,
  type QuestionBankItem,
  type QuestionBankItemInput,
} from "@/hooks/use-question-bank";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { toastSuccess } from "@/lib/toast";

const QUESTION_TYPES = ["rating", "single_choice", "multiple_choice", "short_text"];

function blankQuestion(): QuestionBankItemInput {
  return {
    text: "",
    type: "rating",
    required: true,
    theme: null,
    isSuggestionQuestion: false,
  };
}

export default function AdminQuestionBankPage() {
  const t = useTranslations("admin.pages.questionBank");
  const items = useQuestionBank();
  const create = useCreateQuestionBankItem();
  const update = useUpdateQuestionBankItem();
  const setStatus = useSetQuestionBankItemStatus();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionBankItemInput>(blankQuestion());

  function startCreate() {
    setEditingId(null);
    setForm(blankQuestion());
    setShowForm(true);
  }

  function startEdit(item: QuestionBankItem) {
    setEditingId(item.id);
    setForm({
      text: item.text,
      type: item.type,
      options: item.options ?? undefined,
      required: item.required,
      theme: item.theme,
      isSuggestionQuestion: item.type === "short_text" && item.isSuggestionQuestion,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  function submitForm(event: React.FormEvent) {
    event.preventDefault();
    if (!form.text.trim()) return;
    if (editingId) {
      update.mutate(
        { id: editingId, ...form },
        {
          onSuccess: () => {
            toastSuccess(t("updateSuccess"));
            closeForm();
          },
        },
      );
    } else {
      create.mutate(form, {
        onSuccess: () => {
          toastSuccess(t("createSuccess"));
          closeForm();
        },
      });
    }
  }

  function handleStatus(item: QuestionBankItem) {
    setStatus.mutate({
      id: item.id,
      status: item.status === "active" ? "archived" : "active",
    });
  }

  if (items.isLoading) {
    return (
      <div className="p-6" data-testid="admin-question-bank-page">
        <LoadingState />
      </div>
    );
  }

  if (items.isError || !items.data) {
    return (
      <div className="p-6" data-testid="admin-question-bank-page">
        <EmptyState icon={ShieldCheck} title={t("title")} description={t("loadFailed")} />
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="admin-question-bank-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-heading-1 font-semibold text-text-primary">{t("title")}</h1>
          <p className="mt-1 text-body-small text-text-secondary">{t("description")}</p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("create")}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={submitForm}
          className="mt-6 space-y-4 rounded-lg border border-border p-4"
          data-testid="question-bank-form"
        >
          <h2 className="text-heading-2 font-semibold text-text-primary">
            {editingId ? t("editTitle") : t("createTitle")}
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="bank-question-text">{t("textLabel")}</Label>
            <Input
              id="bank-question-text"
              value={form.text}
              onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
              required
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bank-question-type">{t("typeLabel")}</Label>
              <select
                id="bank-question-type"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value,
                    ...(event.target.value === "short_text"
                      ? {}
                      : { isSuggestionQuestion: false }),
                  }))
                }
                className="h-10 w-full rounded-md border border-border bg-page px-3 text-sm text-text-primary"
              >
                {QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`types.${type}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank-question-theme">{t("themeLabel")}</Label>
              <Input
                id="bank-question-theme"
                value={form.theme ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, theme: event.target.value || null }))
                }
                placeholder={t("themePlaceholder")}
              />
            </div>
          </div>
          {(form.type === "single_choice" || form.type === "multiple_choice") && (
            <div className="space-y-1.5">
              <Label htmlFor="bank-question-options">{t("optionsLabel")}</Label>
              <Input
                id="bank-question-options"
                value={(form.options ?? []).join(", ")}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                  }))
                }
                placeholder={t("optionsHint")}
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-1.5">
              <Checkbox
                checked={form.required ?? true}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, required: Boolean(checked) }))}
              />
              {t("required")}
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <Checkbox
                checked={Boolean(form.isSuggestionQuestion)}
                disabled={form.type !== "short_text"}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isSuggestionQuestion: Boolean(checked) }))
                }
              />
              {t("suggestion")}
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {t("save")}
            </Button>
            <Button type="button" variant="outline" onClick={closeForm}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}

      {items.data.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={ShieldCheck} title={t("empty")} description={t("emptyHint")} />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {items.data.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border p-4"
              data-testid={`question-bank-item-${item.id}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-text-primary">{item.text}</span>
                <Badge variant={item.status === "active" ? "outline" : "secondary"}>
                  {item.status === "active" ? t("active") : t("archived")}
                </Badge>
                {item.isSuggestionQuestion && <Badge variant="outline">{t("suggestion")}</Badge>}
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {t(`types.${item.type}`)}
                {item.theme ? ` · ${item.theme}` : ""}
                {item.options && item.options.length > 0 ? ` · ${item.options.join(", ")}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {item.status === "active" && (
                  <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                    {t("edit")}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => handleStatus(item)}>
                  {item.status === "active" ? (
                    <>
                      <Archive className="mr-1.5 h-3.5 w-3.5" />
                      {t("archive")}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      {t("restore")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
