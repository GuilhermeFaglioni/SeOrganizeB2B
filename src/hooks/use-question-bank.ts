import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { fetchJson } from "@/lib/financial/http";
import { toastError } from "@/lib/toast";

export type QuestionBankStatus = "active" | "archived";

export interface QuestionBankItem {
  id: string;
  text: string;
  type: string;
  options: string[] | null;
  required: boolean;
  theme: string | null;
  isSuggestionQuestion: boolean;
  status: QuestionBankStatus;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionBankItemInput {
  text: string;
  type: string;
  options?: string[];
  required?: boolean;
  theme?: string | null;
  isSuggestionQuestion?: boolean;
}

const bankKey = ["admin", "closed-beta", "questions"] as const;

export function useQuestionBank() {
  return useQuery<QuestionBankItem[]>({
    queryKey: bankKey,
    queryFn: () => fetchJson<QuestionBankItem[]>("/api/admin/closed-beta/questions"),
  });
}

export function useCreateQuestionBankItem() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.questionBank");
  return useMutation({
    mutationFn: (input: QuestionBankItemInput) =>
      fetchJson<QuestionBankItem>("/api/admin/closed-beta/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bankKey }),
    onError: () => toastError(t("createFailed")),
  });
}

export function useUpdateQuestionBankItem() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.questionBank");
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & QuestionBankItemInput) =>
      fetchJson<QuestionBankItem>(`/api/admin/closed-beta/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bankKey }),
    onError: () => toastError(t("updateFailed")),
  });
}

export function useSetQuestionBankItemStatus() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.questionBank");
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuestionBankStatus }) =>
      fetchJson<QuestionBankItem>(`/api/admin/closed-beta/questions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bankKey }),
    onError: () => toastError(t("updateFailed")),
  });
}
