export function paymentIntentStatusToCheckoutStatus(
  status: string | null
): string | null {
  if (status === "succeeded" || status === "processing") return "complete";
  return status;
}
