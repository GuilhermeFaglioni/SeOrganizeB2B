import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { fetchJson } from "@/lib/financial/http";
import { toastError } from "@/lib/toast";

export type CheckinQuestionType =
  | "rating"
  | "single_choice"
  | "multiple_choice"
  | "short_text";

export type CheckinEditionStatus = "draft" | "scheduled" | "published" | "closed";

export interface AdminCheckinQuestion {
  id: string;
  text: string;
  type: CheckinQuestionType;
  options: string[] | null;
  required: boolean;
  position: number;
  theme: string | null;
  isSuggestionQuestion: boolean;
}

export interface AdminCheckinEdition {
  id: string;
  title: string;
  status: CheckinEditionStatus;
  isMandatory: boolean;
  opensAt: string | null;
  closesAt: string | null;
  createdAt: string;
  updatedAt: string;
  questions: AdminCheckinQuestion[];
}

export interface CheckinQuestionInput {
  text: string;
  type: CheckinQuestionType;
  options?: string[];
  required?: boolean;
  position?: number;
  theme?: string | null;
  isSuggestionQuestion?: boolean;
}

const checkinsKey = ["admin", "closed-beta", "checkins"] as const;

export function useAdminCheckinEditions() {
  return useQuery<AdminCheckinEdition[]>({
    queryKey: checkinsKey,
    queryFn: () =>
      fetchJson<AdminCheckinEdition[]>("/api/admin/closed-beta/checkins"),
  });
}

export function useCreateCheckinEdition() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.checkins");
  return useMutation({
    mutationFn: (input: {
      title: string;
      isMandatory?: boolean;
      questions: CheckinQuestionInput[];
    }) =>
      fetchJson<AdminCheckinEdition>("/api/admin/closed-beta/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkinsKey });
    },
    onError: () => toastError(t("createFailed")),
  });
}

export function useUpdateCheckinEdition() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.checkins");
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      isMandatory?: boolean;
      questions?: CheckinQuestionInput[];
    }) =>
      fetchJson<AdminCheckinEdition>(`/api/admin/closed-beta/checkins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkinsKey });
    },
    onError: () => toastError(t("updateFailed")),
  });
}

export function usePublishCheckinEdition() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.checkins");
  return useMutation({
    mutationFn: ({
      id,
      opensAt,
      closesAt,
    }: {
      id: string;
      opensAt?: string | null;
      closesAt?: string | null;
    }) =>
      fetchJson<AdminCheckinEdition>(
        `/api/admin/closed-beta/checkins/${id}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opensAt, closesAt }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkinsKey });
    },
    onError: () => toastError(t("publishFailed")),
  });
}

export function useCloseCheckinEdition() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.checkins");
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<AdminCheckinEdition>(
        `/api/admin/closed-beta/checkins/${id}/close`,
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkinsKey });
    },
    onError: () => toastError(t("closeFailed")),
  });
}

export function useDuplicateCheckinEdition() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.checkins");
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<AdminCheckinEdition>(
        `/api/admin/closed-beta/checkins/${id}/duplicate`,
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkinsKey });
    },
    onError: () => toastError(t("duplicateFailed")),
  });
}
