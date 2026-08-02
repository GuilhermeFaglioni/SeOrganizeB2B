"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCreateContract,
  useUpdateContract,
  useContract,
  useContractLifecycle,
} from "@/hooks/use-contracts";
import { useClients } from "@/hooks/use-clients";
import { useProjects } from "@/hooks/use-projects";
import { useProfiles } from "@/hooks/use-profiles";
import { suggestPlan, sumPlan, validateFinitePlan } from "@/lib/financial/installments";
import { toDecimal, eq, formatBRL } from "@/lib/financial/money";
import { toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

const DURATION_TYPES = [
  { value: "fixed", label: "Fixed term" },
  { value: "openEnded", label: "Open-ended recurring" },
  { value: "oneTime", label: "One-time" },
];

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semiannual", label: "Semiannual" },
  { value: "annual", label: "Annual" },
];

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "credit_card", label: "Credit card" },
  { value: "debit_card", label: "Debit card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

interface ItemRow {
  name: string;
  description?: string;
  quantity?: string;
  unit?: string;
  price?: string;
  position: number;
}

export function ContractForm({ contractId }: { contractId?: string }) {
  const router = useRouter();
  const { data: existing } = useContract(contractId ?? "");
  const { data: clientsData } = useClients({ pageSize: 100 });
  const { data: projects } = useProjects();
  const { data: profiles } = useProfiles();

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [durationType, setDurationType] = useState<string>("fixed");
  const [officialValue, setOfficialValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [billingFrequency, setBillingFrequency] = useState<string>("monthly");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    contract: true,
    scope: true,
    projects: true,
    billing: true,
  });

  const hydratedId = useRef<string | null>(null);

  useEffect(() => {
    if (!existing || hydratedId.current === existing.id) return;
    hydratedId.current = existing.id;
    setTitle(existing.title ?? "");
    setClientId(existing.clientId ?? "");
    setOwnerId(existing.ownerId ?? "");
    setDurationType(existing.durationType ?? "fixed");
    setOfficialValue(existing.officialValue ?? "");
    setStartDate(existing.startDate ?? "");
    setEndDate(existing.endDate ?? "");
    setBillingFrequency(existing.billingFrequency ?? "monthly");
    setPaymentMethod(existing.paymentMethod ?? "pix");
    setNotes(existing.notes ?? "");
    setItems(
      (existing.items ?? []).map((item) => ({
        name: item.name,
        description: item.description ?? undefined,
        quantity: item.quantity ?? undefined,
        unit: item.unit ?? undefined,
        price: item.price ?? undefined,
        position: item.position,
      }))
    );
    setProjectIds((existing.projects ?? []).map((link) => link.project.id));
  }, [existing]);

  const createContract = useCreateContract();
  const updateContract = useUpdateContract();
  const lifecycle = useContractLifecycle();

  const itemSum = useMemo(
    () =>
      items.reduce(
        (acc, item) =>
          acc.plus(
            toDecimal(item.price ?? "0").times(toDecimal(item.quantity ?? "1"))
          ),
        toDecimal(0)
      ),
    [items]
  );

  const suggestedPlan = useMemo(() => {
    if (!officialValue || !startDate) return [];
    try {
      return suggestPlan(
        toDecimal(officialValue),
        durationType as "fixed" | "openEnded" | "oneTime",
        startDate,
        endDate || null,
        (billingFrequency as "monthly" | "quarterly" | "semiannual" | "annual") || null,
        paymentMethod as never
      );
    } catch {
      return [];
    }
  }, [officialValue, startDate, endDate, durationType, billingFrequency, paymentMethod]);

  const planTotal = useMemo(() => sumPlan(suggestedPlan), [suggestedPlan]);
  const planErrors =
    durationType === "openEnded"
      ? !eq(planTotal, toDecimal(officialValue))
        ? ["Installment total must equal the official contract value"]
        : []
      : validateFinitePlan(suggestedPlan, toDecimal(officialValue || "0"));
  const itemMismatch = items.length > 0 && !eq(itemSum, toDecimal(officialValue || "0"));

  function payload(extra: Record<string, unknown> = {}) {
    return {
      title,
      clientId,
      ownerId: ownerId || undefined,
      durationType,
      officialValue,
      startDate,
      endDate: endDate || null,
      billingFrequency,
      paymentMethod,
      notes: notes || null,
      items: items
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name,
          description: item.description || null,
          quantity: item.quantity || null,
          unit: item.unit || null,
          price: item.price || null,
          position: item.position,
        })),
      projectIds,
      ...extra,
    };
  }

  function saveDraft() {
    if (contractId) {
      updateContract.mutate({ id: contractId, ...payload() });
    } else {
      createContract.mutate(payload(), {
        onSuccess: (contract) => {
          toastSuccess("Draft saved");
          router.push(`/financial/contracts/${(contract as { id: string }).id}`);
        },
      });
    }
  }

  function activate() {
    const navigate = (id: string) => {
      lifecycle.mutate(
        { id, action: "activate", plan: suggestedPlan },
        {
          onSuccess: () => {
            toastSuccess("Contract activated");
            router.push(`/financial/contracts/${id}`);
          },
        }
      );
    };
    if (contractId) {
      navigate(contractId);
    } else {
      createContract.mutate(payload(), {
        onSuccess: (contract) => {
          toastSuccess("Draft saved");
          navigate((contract as { id: string }).id);
        },
      });
    }
  }

  function toggleSection(key: string) {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-16">
      <section className="rounded-xl border border-border bg-page-alt p-4">
        <button type="button" onClick={() => toggleSection("contract")} className="flex w-full items-center justify-between text-left">
          <h2 className="text-base font-semibold text-text-primary">Contract data</h2>
          {sectionsOpen.contract ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {sectionsOpen.contract && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="contract-title">Title</Label>
              <Input id="contract-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="contract-client">Client</Label>
              <select
                id="contract-client"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                <option value="">Select client</option>
                {clientsData?.items.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contract-owner">Internal owner</Label>
              <select
                id="contract-owner"
                value={ownerId ?? ""}
                onChange={(event) => setOwnerId(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {profiles?.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name || profile.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contract-duration">Duration type</Label>
              <select
                id="contract-duration"
                value={durationType}
                onChange={(event) => setDurationType(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                {DURATION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contract-value">Official value (BRL)</Label>
              <Input
                id="contract-value"
                type="number"
                step="0.01"
                min="0"
                value={officialValue}
                onChange={(event) => setOfficialValue(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="contract-start">Start date</Label>
              <Input id="contract-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="contract-end">End date</Label>
              <Input
                id="contract-end"
                type="date"
                value={endDate}
                disabled={durationType === "openEnded" || durationType === "oneTime"}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="contract-frequency">Billing frequency</Label>
              <select
                id="contract-frequency"
                value={billingFrequency ?? "monthly"}
                disabled={durationType === "oneTime"}
                onChange={(event) => setBillingFrequency(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                {FREQUENCIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contract-payment">Payment method</Label>
              <select
                id="contract-payment"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                {PAYMENT_METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="contract-notes">Notes</Label>
              <textarea
                id="contract-notes"
                value={notes ?? ""}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <button type="button" onClick={() => toggleSection("scope")} className="flex w-full items-center justify-between text-left">
          <h2 className="text-base font-semibold text-text-primary">Scope and items</h2>
          {sectionsOpen.scope ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {sectionsOpen.scope && (
          <div className="mt-4 space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <input
                  aria-label={`Item name ${index + 1}`}
                  value={item.name}
                  onChange={(event) =>
                    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))
                  }
                  placeholder="Item name"
                  className="col-span-2 rounded-md border border-border bg-page px-3 py-2 text-sm sm:col-span-2"
                />
                <input
                  aria-label={`Item price ${index + 1}`}
                  type="number"
                  step="0.01"
                  value={item.price ?? ""}
                  onChange={(event) =>
                    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, price: event.target.value } : row)))
                  }
                  placeholder="Price"
                  className="rounded-md border border-border bg-page px-3 py-2 text-sm"
                />
                <input
                  aria-label={`Item quantity ${index + 1}`}
                  type="number"
                  step="0.01"
                  value={item.quantity ?? ""}
                  onChange={(event) =>
                    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: event.target.value } : row)))
                  }
                  placeholder="Qty"
                  className="rounded-md border border-border bg-page px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  className="flex min-h-[44px] items-center justify-center rounded-md text-text-secondary hover:text-danger"
                  aria-label={`Remove item ${index + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  { name: "", position: prev.length },
                ])
              }
              className="flex min-h-[44px] items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:bg-bg-secondary"
            >
              <Plus size={16} /> Add item
            </button>
            {itemMismatch && (
              <p className="rounded-md bg-warning-bg p-3 text-sm text-warning">
                The item-price sum ({formatBRL(itemSum)}) does not match the
                official contract value ({formatBRL(toDecimal(officialValue || "0"))}).
                This warning does not block saving.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <button type="button" onClick={() => toggleSection("projects")} className="flex w-full items-center justify-between text-left">
          <h2 className="text-base font-semibold text-text-primary">Linked projects</h2>
          {sectionsOpen.projects ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {sectionsOpen.projects && (
          <div className="mt-4 space-y-2">
            {projects?.map((project) => (
              <label key={project.id} className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={projectIds.includes(project.id)}
                  onChange={(event) =>
                    setProjectIds((prev) =>
                      event.target.checked
                        ? [...prev, project.id]
                        : prev.filter((id) => id !== project.id)
                    )
                  }
                  className="h-4 w-4"
                />
                {project.name}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <button type="button" onClick={() => toggleSection("billing")} className="flex w-full items-center justify-between text-left">
          <h2 className="text-base font-semibold text-text-primary">Billing and installments</h2>
          {sectionsOpen.billing ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {sectionsOpen.billing && (
          <div className="mt-4 space-y-3">
            {suggestedPlan.length === 0 ? (
              <p className="text-sm text-text-muted">
                Fill in the value and dates to preview the suggested installment schedule.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="text-xs uppercase text-text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-1 font-medium">Due date</th>
                      <th scope="col" className="px-3 py-1 font-medium">Amount</th>
                      <th scope="col" className="px-3 py-1 font-medium">Payment method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {suggestedPlan.map((item, index) => (
                      <tr key={index}>
                        <td className="px-3 py-1">{item.dueDate}</td>
                        <td className="px-3 py-1 font-medium">{formatBRL(toDecimal(item.expectedAmount))}</td>
                        <td className="px-3 py-1">{item.paymentMethod}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-sm text-text-secondary">
              Installment total: {formatBRL(planTotal)} · Official value:{" "}
              {formatBRL(toDecimal(officialValue || "0"))}
            </p>
            {planErrors.map((error) => (
              <p key={error} role="alert" className="rounded-md bg-danger-bg p-3 text-sm text-danger">
                {error}
              </p>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={saveDraft}>
          Save draft
        </Button>
        {(!existing || existing.status === "draft") && (
          <Button
            onClick={activate}
            disabled={suggestedPlan.length === 0 || planErrors.length > 0}
          >
            Activate
          </Button>
        )}
      </div>
    </div>
  );
}
