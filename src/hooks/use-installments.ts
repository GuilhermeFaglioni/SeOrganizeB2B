import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toastError } from "@/lib/toast";
import { fetchJson } from "@/lib/financial/http";

export function useMarkInstallmentPaid() {
  const t = useTranslations("hooks.installments");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paidAt }: { id: string; paidAt: string }) =>
      fetchJson(`/api/installments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", paidAt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: () => toastError(t("recordPaymentFailed")),
  });
}

export function useCancelInstallment() {
  const t = useTranslations("hooks.installments");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/installments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: () => toastError(t("cancelFailed")),
  });
}

export function useRefundInstallment() {
  const t = useTranslations("hooks.installments");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      refundAmount,
      refundDate,
    }: {
      id: string;
      refundAmount: string;
      refundDate: string;
    }) =>
      fetchJson(`/api/installments/${id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundAmount, refundDate }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: () => toastError(t("recordRefundFailed")),
  });
}
