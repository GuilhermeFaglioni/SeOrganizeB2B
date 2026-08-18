"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import {
  useCheckinStatus,
  useSubmitCheckin,
} from "@/hooks/use-checkin";
import type { CheckinQuestion } from "@/hooks/use-checkin";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { toastError } from "@/lib/toast";

function QuestionControl({
  question,
  value,
  onChange,
}: {
  question: CheckinQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const t = useTranslations("checkin");
  if (question.type === "rating") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <Button
            key={rating}
            type="button"
            size="sm"
            variant={value === rating ? "default" : "outline"}
            onClick={() => onChange(rating)}
          >
            {rating}
          </Button>
        ))}
      </div>
    );
  }
  if (question.type === "single_choice") {
    return (
      <div className="space-y-2">
        {(question.options ?? []).map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <input
              type="radio"
              name={question.id}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {option}
          </label>
        ))}
      </div>
    );
  }
  if (question.type === "multiple_choice") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-2">
        {(question.options ?? []).map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <Checkbox
              checked={selected.includes(option)}
              onCheckedChange={(checked) => {
                const next = checked
                  ? [...selected, option]
                  : selected.filter((item) => item !== option);
                onChange(next);
              }}
            />
            {option}
          </label>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <textarea
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        maxLength={300}
        className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm text-text-primary"
      />
      {question.isSuggestionQuestion && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={value === ""}
            onCheckedChange={(checked) => onChange(checked ? "" : undefined)}
          />
          {t("noSuggestion")}
        </label>
      )}
    </div>
  );
}

export default function BetaCheckinPage() {
  const t = useTranslations("checkin");
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useCheckinStatus();
  const submit = useSubmitCheckin();

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [didNotUse, setDidNotUse] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-6">
        <LoadingState />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-6">
        <EmptyState
          icon={ShieldCheck}
          title={t("title")}
          description={t("loadFailed")}
        />
        <Button variant="outline" onClick={() => refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const edition = data.edition;

  if (submitted || data.memberSubmitted) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-6">
        <div
          className="w-full max-w-md space-y-4 rounded-xl border border-border bg-page-alt p-6 text-center shadow-card"
          data-testid="checkin-done"
        >
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <h1 className="text-heading-2 font-semibold text-text-primary">
            {t("successTitle")}
          </h1>
          <p className="text-sm text-text-secondary">{t("successBody")}</p>
          <p className="text-sm text-text-secondary">{t("unlocked")}</p>
          <Button onClick={() => router.push("/app")}>{t("backToApp")}</Button>
        </div>
      </div>
    );
  }

  if (data.workspaceStatus === "not_applicable") {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-6">
        <div
          className="w-full max-w-md space-y-4 rounded-xl border border-border bg-page-alt p-6 text-center shadow-card"
          data-testid="checkin-not-applicable"
        >
          <ShieldCheck className="mx-auto h-10 w-10 text-accent" />
          <h1 className="text-heading-2 font-semibold text-text-primary">
            {t("noEdition")}
          </h1>
          <Button onClick={() => router.push("/app")}>{t("backToApp")}</Button>
        </div>
      </div>
    );
  }

  if (data.workspaceStatus === "exempt") {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-6">
        <div
          className="w-full max-w-md space-y-4 rounded-xl border border-border bg-page-alt p-6 text-center shadow-card"
          data-testid="checkin-exempt"
        >
          <ShieldCheck className="mx-auto h-10 w-10 text-accent" />
          <h1 className="text-heading-2 font-semibold text-text-primary">
            {t("exemptTitle")}
          </h1>
          <p className="text-sm text-text-secondary">{t("exemptBody")}</p>
          <Button onClick={() => router.push("/app")}>{t("backToApp")}</Button>
        </div>
      </div>
    );
  }

  if (!edition) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-6">
        <div
          className="w-full max-w-md space-y-4 rounded-xl border border-border bg-page-alt p-6 text-center shadow-card"
          data-testid="checkin-no-edition"
        >
          <h1 className="text-heading-2 font-semibold text-text-primary">
            {t("noEdition")}
          </h1>
          <Button onClick={() => router.push("/app")}>{t("backToApp")}</Button>
        </div>
      </div>
    );
  }

  const total = edition.questions.length;
  const answered = edition.questions.filter((question) => {
    const value = answers[question.id];
    return value !== undefined && value !== null && value !== "";
  }).length;

  const handleSubmit = () => {
    submit.mutate(
      { editionId: edition.id, answers, didNotUse },
      {
        onSuccess: () => {
          setSubmitted(true);
        },
        onError: () => toastError(t("submitFailed")),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6" data-testid="checkin-page">
      <div>
        <h1 className="text-heading-1 font-semibold text-text-primary">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {t("description")} {t("minutesHint")}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-page-alt p-3">
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>{edition.title}</span>
          <span>
            {t("progress", { answered, total })}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${total ? (answered / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-4 text-sm">
        <Checkbox
          checked={didNotUse}
          onCheckedChange={(checked) => setDidNotUse(Boolean(checked))}
        />
        <span>
          <span className="font-medium text-text-primary">{t("didNotUse")}</span>
          <span className="block text-xs text-text-muted">{t("didNotUseHint")}</span>
        </span>
      </label>

      {!didNotUse && (
        <div className="space-y-6">
          {edition.questions.map((question, index) => (
            <div key={question.id} className="space-y-2">
              <p className="font-medium text-text-primary">
                {index + 1}. {question.text}
                {!question.required && (
                  <span className="ml-1 text-xs text-text-muted">
                    ({t("optional")})
                  </span>
                )}
              </p>
              <QuestionControl
                question={question}
                value={answers[question.id]}
                onChange={(value) =>
                  setAnswers((current) => ({ ...current, [question.id]: value }))
                }
              />
            </div>
          ))}
        </div>
      )}

      <Button
        className="w-full"
        disabled={submit.isPending || (didNotUse ? false : answered < total)}
        onClick={handleSubmit}
      >
        {submit.isPending ? t("submitting") : t("submit")}
      </Button>
    </div>
  );
}
