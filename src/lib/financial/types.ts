export const CONTRACT_STATUSES = ["draft", "active", "closed", "cancelled", "suspended"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const DURATION_TYPES = ["fixed", "openEnded", "oneTime"] as const;
export type DurationType = (typeof DURATION_TYPES)[number];

export const BILLING_FREQUENCIES = ["monthly", "quarterly", "semiannual", "annual"] as const;
export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];

export const PAYMENT_METHODS = ["pix", "boleto", "bank_transfer", "credit_card", "debit_card", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const INSTALLMENT_STATUSES = ["pending", "paid", "cancelled"] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const DISPLAY_STATUSES = ["pending", "paid", "cancelled", "overdue"] as const;
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

export type DisplayableInstallment<T extends { status: string }> = T & {
  displayStatus: DisplayStatus;
};

export const CHANGE_TYPES = ["upsell", "downsell"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export type LifecycleAction = "activate" | "suspend" | "resume" | "close" | "cancel" | "renew";

export interface InstallmentPlanItem {
  expectedAmount: string;
  dueDate: string;
  paymentMethod: PaymentMethod;
}

export interface ContractSummary {
  id: string;
  code: string;
  title: string;
  status: ContractStatus;
  durationType: DurationType;
  officialValue: string;
  startDate: string;
  endDate: string | null;
  billingFrequency: BillingFrequency | null;
  clientId: string;
  ownerId: string | null;
  notes: string | null;
  paymentMethod: string;
  client: { id: string; name: string };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
