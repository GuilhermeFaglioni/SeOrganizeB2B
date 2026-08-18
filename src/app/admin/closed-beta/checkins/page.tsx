"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, Eye, Plus, ShieldCheck } from "lucide-react";
import {
  useAdminCheckinEditions,
  useCloseCheckinEdition,
  useCreateCheckinEdition,
  usePublishCheckinEdition,
  useUpdateCheckinEdition,
} from "@/hooks/use-checkin-admin";
import type {
  AdminCheckinEdition,
  CheckinQuestionInput,
  CheckinQuestionType,
} from "@/hooks/use-checkin-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { toastSuccess } from "@/lib/toast";

const QUESTION_TYPES: CheckinQuestionType[] = [
  "rating",
  "single_choice",
  "multiple_choice",
  "short_text",
];

function blankQuestion(position: number): CheckinQuestionInput {
  return {
    text: "",
    type: "rating",
    required: true,
    position,
    isSuggestionQuestion: false,
  };
}

function statusVariant(status: AdminCheckinEdition["status"]) {
  if (status === "published") return "success" as const;
  if (status === "scheduled") return "warning" as const;
  if (status === "closed") return "secondary" as const;
  return "outline" as const;
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AdminCheckinsPage() {
  const t = useTranslations("admin.pages.checkins");
  const editions = useAdminCheckinEditions();
  const createEdition = useCreateCheckinEdition();
  const updateEdition = useUpdateCheckinEdition();
  const publishEdition = usePublishCheckinEdition();
  const closeEdition = useCloseCheckinEdition();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [isMandatory, setIsMandatory] = useState(true);
  const [questions, setQuestions] = useState<CheckinQuestionInput[]>([]);

  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  function startCreate() {
    setEditingId(null);
    setTitle("");
    setIsMandatory(true);
    setQuestions([blankQuestion(0)]);
    setShowForm(true);
  }

  function startEdit(edition: AdminCheckinEdition) {
    setEditingId(edition.id);
    setTitle(edition.title);
    setIsMandatory(edition.isMandatory);
    setQuestions(
      edition.questions.map((question) => ({
        text: question.text,
        type: question.type,
        options: question.options ?? undefined,
        required: question.required,
        position: question.position,
        theme: question.theme ?? undefined,
        isSuggestionQuestion: question.isSuggestionQuestion,
      })),
    );
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  function updateQuestion(index: number, patch: Partial<CheckinQuestionInput>) {
    setQuestions((current) =>
      current.map((question, itemIndex) =>
        itemIndex === index ? { ...question, ...patch } : question,
      ),
    );
  }

  function addQuestion() {
    setQuestions((current) => [
      ...current,
      blankQuestion(current.length),
    ]);
  }

  function removeQuestion(index: number) {
    setQuestions((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setQuestions((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((question, itemIndex) => ({ ...question, position: itemIndex }));
    });
  }

  function submitForm(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      isMandatory,
      questions: questions.map((question, index) => ({
        ...question,
        position: index,
      })),
    };
    if (editingId) {
      updateEdition.mutate(
        { id: editingId, ...payload },
        {
          onSuccess: () => {
            toastSuccess(t("updateSuccess"));
            closeForm();
          },
        },
      );
    } else {
      createEdition.mutate(payload, {
        onSuccess: () => {
          toastSuccess(t("createSuccess"));
          closeForm();
        },
      });
    }
  }

  function startPublish(edition: AdminCheckinEdition) {
    setPublishingId(edition.id);
    setOpensAt(toLocalInputValue(edition.opensAt));
    setClosesAt(toLocalInputValue(edition.closesAt));
  }

  function confirmPublish() {
    if (!publishingId) return;
    publishEdition.mutate(
      {
        id: publishingId,
        opensAt: opensAt ? new Date(opensAt).toISOString() : null,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
      },
      {
        onSuccess: () => {
          toastSuccess(t("publishSuccess"));
          setPublishingId(null);
        },
      },
    );
  }

  function handleClose(edition: AdminCheckinEdition) {
    if (!window.confirm(t("closeConfirm", { title: edition.title }))) return;
    closeEdition.mutate(edition.id, {
      onSuccess: () => toastSuccess(t("closeSuccess")),
    });
  }

  if (editions.isLoading) {
    return (
      <div className="p-6" data-testid="admin-checkins-page">
        <LoadingState />
      </div>
    );
  }

  if (editions.isError || !editions.data) {
    return (
      <div className="p-6" data-testid="admin-checkins-page">
        <EmptyState
          icon={ShieldCheck}
          title={t("title")}
          description={t("loadFailed")}
        />
      </div>
    );
  }

  const previewEdition = editions.data.find(
    (edition) => edition.id === previewId,
  );

  return (
    <div className="p-6" data-testid="admin-checkins-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-heading-1 font-semibold text-text-primary">
            {t("title")}
          </h1>
          <p className="mt-1 text-body-small text-text-secondary">
            {t("description")}
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createEdition")}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={submitForm}
          className="mt-6 space-y-4 rounded-lg border border-border p-4"
          data-testid="checkin-edition-form"
        >
          <h2 className="text-heading-2 font-semibold text-text-primary">
            {editingId ? t("editTitle") : t("createTitle")}
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="checkin-title">{t("titleLabel")}</Label>
            <Input
              id="checkin-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={isMandatory}
              onCheckedChange={(checked) => setIsMandatory(Boolean(checked))}
            />
            {t("mandatoryLabel")}
          </label>

          <div className="space-y-3">
            <Label>{t("questionsLabel")}</Label>
            {questions.map((question, index) => (
              <div
                key={index}
                className="space-y-2 rounded-lg border border-border p-3"
                data-testid={`checkin-question-${index}`}
              >
                <div className="flex items-start gap-2">
                  <Input
                    value={question.text}
                    onChange={(event) =>
                      updateQuestion(index, { text: event.target.value })
                    }
                    placeholder={t("questionText")}
                    required
                  />
                  <select
                    value={question.type}
                    onChange={(event) =>
                      updateQuestion(index, {
                        type: event.target.value as CheckinQuestionType,
                      })
                    }
                    className="h-10 w-40 rounded-md border border-border bg-page px-2 text-sm text-text-primary"
                  >
                    {QUESTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`types.${type}`)}
                      </option>
                    ))}
                  </select>
                </div>
                {(question.type === "single_choice" ||
                  question.type === "multiple_choice") && (
                  <div className="space-y-1.5">
                    <Label>{t("optionsLabel")}</Label>
                    <Input
                      value={(question.options ?? []).join(", ")}
                      onChange={(event) =>
                        updateQuestion(index, {
                          options: event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder={t("optionsHint")}
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <Checkbox
                      checked={question.required ?? true}
                      onCheckedChange={(checked) =>
                        updateQuestion(index, { required: Boolean(checked) })
                      }
                    />
                    {t("required")}
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <Checkbox
                      checked={Boolean(question.isSuggestionQuestion)}
                      onCheckedChange={(checked) =>
                        updateQuestion(index, {
                          isSuggestionQuestion: Boolean(checked),
                        })
                      }
                    />
                    {t("suggestion")}
                  </label>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={index === 0}
                      onClick={() => moveQuestion(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={index === questions.length - 1}
                      onClick={() => moveQuestion(index, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => removeQuestion(index)}
                    >
                      {t("removeQuestion")}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addQuestion}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addQuestion")}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={createEdition.isPending || updateEdition.isPending}
            >
              {editingId ? t("save") : t("create")}
            </Button>
            <Button type="button" variant="outline" onClick={closeForm}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}

      {editions.data.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={CalendarClock}
            title={t("empty")}
            description={t("emptyHint")}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {editions.data.map((edition) => (
            <div
              key={edition.id}
              className="rounded-lg border border-border p-4"
              data-testid={`checkin-edition-${edition.id}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-text-primary">
                  {edition.title}
                </span>
                <Badge variant={statusVariant(edition.status)}>
                  {t(`status.${edition.status}`)}
                </Badge>
                {edition.isMandatory && (
                  <Badge variant="outline">{t("mandatory")}</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {t("questionCount", { count: edition.questions.length })}
                {edition.opensAt &&
                  ` · ${t("opensAtLabel")}: ${new Date(edition.opensAt).toLocaleString()}`}
                {edition.closesAt &&
                  ` · ${t("closesAtLabel")}: ${new Date(edition.closesAt).toLocaleString()}`}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewId(edition.id)}
                >
                  <Eye className="mr-1.5 h-4 w-4" />
                  {t("preview")}
                </Button>
                {(edition.status === "draft" || edition.status === "scheduled") && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => startEdit(edition)}>
                      {t("edit")}
                    </Button>
                    <Button size="sm" variant="default" onClick={() => startPublish(edition)}>
                      {t("publish")}
                    </Button>
                  </>
                )}
                {edition.status === "published" && (
                  <Button size="sm" variant="outline" onClick={() => handleClose(edition)}>
                    {t("close")}
                  </Button>
                )}
              </div>

              {publishingId === edition.id && (
                <div className="mt-3 grid gap-3 rounded-lg border border-dashed border-border p-3 md:grid-cols-3 md:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor={`opens-${edition.id}`}>{t("opensAtLabel")}</Label>
                    <Input
                      id={`opens-${edition.id}`}
                      type="datetime-local"
                      value={opensAt}
                      onChange={(event) => setOpensAt(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`closes-${edition.id}`}>{t("closesAtLabel")}</Label>
                    <Input
                      id={`closes-${edition.id}`}
                      type="datetime-local"
                      value={closesAt}
                      onChange={(event) => setClosesAt(event.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={publishEdition.isPending}
                      onClick={confirmPublish}
                    >
                      {t("publishConfirm")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPublishingId(null)}>
                      {t("cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {previewEdition && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-page p-6 shadow-card"
            onClick={(event) => event.stopPropagation()}
            data-testid="checkin-preview"
          >
            <h2 className="text-heading-2 font-semibold text-text-primary">
              {previewEdition.title}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{t("previewTitle")}</p>
            <div className="mt-4 space-y-4">
              {previewEdition.questions.map((question) => (
                <div key={question.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium text-text-primary">
                    {question.text}
                    {!question.required && (
                      <span className="ml-1 text-xs text-text-muted">
                        ({t("optional")})
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {t(`types.${question.type}`)}
                    {question.isSuggestionQuestion && ` · ${t("suggestion")}`}
                  </p>
                  {question.options && question.options.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-sm text-text-secondary">
                      {question.options.map((option) => (
                        <li key={option}>{option}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setPreviewId(null)}>
                {t("close")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
