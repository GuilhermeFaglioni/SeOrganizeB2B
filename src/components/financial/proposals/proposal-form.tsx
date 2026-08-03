"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import {
  useCreateProposal,
  useProposal,
  useProposalTemplates,
  useSendProposal,
  useUpdateProposal,
} from "@/hooks/use-proposals";
import { useClients } from "@/hooks/use-clients";
import { detectVariables } from "@/lib/financial/proposal-variables";
import { toDecimal } from "@/lib/financial/money";
import { toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/loading-state";

interface ItemRow {
  name: string;
  quantity: string;
  price: string;
  position: number;
}

export function ProposalForm({
  proposalId,
  initialTemplateId,
}: {
  proposalId?: string;
  initialTemplateId?: string;
}) {
  const router = useRouter();
  const t = useTranslations("proposals.form");
  const { data: existing } = useProposal(proposalId ?? "");
  const { data: clientsData } = useClients({ pageSize: 100 });
  const { data: templates } = useProposalTemplates();

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [templateId, setTemplateId] = useState(initialTemplateId ?? "");
  const [totalValue, setTotalValue] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState("");
  const [previewError, setPreviewError] = useState("");
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hydratedId = useRef<string | null>(null);

  const selectedTemplate = templates?.find((tpl) => tpl.id === templateId);
  const variables = useMemo(
    () => detectVariables(selectedTemplate?.html ?? ""),
    [selectedTemplate]
  );
  const customVariables = variables.filter((v) => !v.isSystem);

  useEffect(() => {
    if (!existing || hydratedId.current === existing.id) return;
    hydratedId.current = existing.id;
    setTitle(existing.title ?? "");
    setClientId(existing.client?.id ?? "");
    setTemplateId(existing.template?.id ?? "");
    setTotalValue(existing.totalValue ?? "");
    setIssueDate(existing.issueDate ?? "");
    setValidUntil(existing.validUntil ?? "");
    setItems(
      (existing.items ?? []).map((item) => ({
        name: item.name,
        quantity: item.quantity ?? "",
        price: item.price ?? "",
        position: item.position,
      }))
    );
    setCustomValues(existing.variables ?? {});
  }, [existing]);

  const createProposal = useCreateProposal();
  const updateProposal = useUpdateProposal();
  const sendProposal = useSendProposal();

  const selectedClient = clientsData?.items.find((client) => client.id === clientId);

  const itemSum = useMemo(
    () =>
      items.reduce((acc, item) => {
        const price = item.price && item.price !== "" ? item.price : "0";
        const qty = item.quantity && item.quantity !== "" ? item.quantity : "1";
        return acc.plus(toDecimal(price).times(toDecimal(qty)));
      }, toDecimal(0)),
    [items]
  );

  useEffect(() => {
    if (!totalValue) setTotalValue(itemSum.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemSum]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const known = new Set(customVariables.map((v) => v.name));
    setCustomValues((prev) => {
      const next: Record<string, string> = {};
      known.forEach((name) => {
        next[name] = prev[name] ?? "";
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  function buildValues(): Record<string, string> {
    const values: Record<string, string> = { ...customValues };
    values["cliente.nome"] = selectedClient?.name ?? "";
    values["cliente.razao_social"] = selectedClient?.legalName ?? "";
    values["cliente.email"] = selectedClient?.email ?? "";
    values["cliente.telefone"] = selectedClient?.phone ?? "";
    values["cliente.cpf_cnpj"] = selectedClient?.cpfCnpj ?? "";
    values["proposta.titulo"] = title;
    values["proposta.data"] = issueDate;
    values["proposta.validade"] = validUntil;
    values["proposta.valor_total"] = totalValue;
    return values;
  }

  useEffect(() => {
    if (!selectedTemplate) {
      setPreview("");
      return;
    }
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/proposal-templates/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html: selectedTemplate.html,
            values: buildValues(),
            items: items
              .filter((item) => item.name.trim())
              .map((item) => ({ ...item })),
          }),
        });
        const json = await response.json();
        if (json.error) throw new Error(json.error.message);
        setPreview(json.data.html);
        setPreviewError("");
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : t("previewFailed"));
      }
    }, 350);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate, title, clientId, totalValue, issueDate, validUntil, items, customValues]);

  if (proposalId && !existing) return <LoadingState />;

  function payload() {
    return {
      title,
      clientId,
      templateId: templateId || null,
      variables: customValues,
      totalValue: totalValue || null,
      issueDate: issueDate || null,
      validUntil: validUntil || null,
      items: items
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name,
          quantity: item.quantity || null,
          price: item.price || null,
          position: item.position,
        })),
    };
  }

  function saveDraft() {
    const onSuccess = (proposal: { id: string }) => {
      toastSuccess(t("draftSaved"));
      router.push(`/financial/proposals/${proposal.id}`);
    };
    if (proposalId) {
      updateProposal.mutate({ id: proposalId, ...payload() }, { onSuccess: () => onSuccess({ id: proposalId }) });
    } else {
      createProposal.mutate(payload(), { onSuccess: (data) => onSuccess(data as { id: string }) });
    }
  }

  function saveAndSend() {
    const proceed = (id: string) => {
      sendProposal.mutate(id, {
        onSuccess: () => {
          toastSuccess(t("proposalSent"));
          router.push(`/financial/proposals/${id}`);
        },
      });
    };
    if (proposalId) {
      updateProposal.mutate(
        { id: proposalId, ...payload() },
        { onSuccess: () => proceed(proposalId) }
      );
    } else {
      createProposal.mutate(payload(), {
        onSuccess: (proposal) => proceed((proposal as { id: string }).id),
      });
    }
  }

  return (
    <div className="space-y-4 pb-16">
      <section className="rounded-xl border border-border bg-page-alt p-4">
        <h2 className="mb-3 text-base font-semibold text-text-primary">{t("dataTitle")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="proposal-title">{t("titleLabel")}</Label>
            <Input
              id="proposal-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("titlePlaceholder")}
            />
          </div>
          <div>
            <Label htmlFor="proposal-client">{t("clientLabel")}</Label>
            <select
              id="proposal-client"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <option value="">{t("selectClient")}</option>
              {clientsData?.items.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="proposal-template">{t("templateLabel")}</Label>
            <select
              id="proposal-template"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <option value="">{t("selectTemplate")}</option>
              {templates?.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="proposal-value">{t("totalValueLabel")}</Label>
            <Input
              id="proposal-value"
              type="number"
              step="0.01"
              min="0"
              value={totalValue}
              onChange={(event) => setTotalValue(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="proposal-issue">{t("issueDateLabel")}</Label>
              <Input
                id="proposal-issue"
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="proposal-valid">{t("validUntilLabel")}</Label>
              <Input
                id="proposal-valid"
                type="date"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <h2 className="mb-3 text-base font-semibold text-text-primary">{t("itemsTitle")}</h2>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <input
                aria-label={`${t("itemName")} ${index + 1}`}
                value={item.name}
                onChange={(event) =>
                  setItems((prev) => prev.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))
                }
                placeholder={t("itemName")}
                className="col-span-2 rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:col-span-2"
              />
              <input
                aria-label={`${t("itemQuantity")} ${index + 1}`}
                type="number"
                step="0.01"
                value={item.quantity}
                onChange={(event) =>
                  setItems((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: event.target.value } : row)))
                }
                placeholder={t("itemQuantity")}
                className="rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              />
              <input
                aria-label={`${t("itemPrice")} ${index + 1}`}
                type="number"
                step="0.01"
                value={item.price}
                onChange={(event) =>
                  setItems((prev) => prev.map((row, i) => (i === index ? { ...row, price: event.target.value } : row)))
                }
                placeholder={t("itemPrice")}
                className="rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                aria-label={`${t("removeItem")} ${index + 1}`}
                className="flex min-h-[44px] items-center justify-center rounded-md text-text-secondary hover:text-danger focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setItems((prev) => [...prev, { name: "", quantity: "", price: "", position: prev.length }])
            }
            className="flex min-h-[44px] items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:bg-bg-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <Plus size={16} /> {t("addItem")}
          </button>
        </div>
      </section>

      {selectedTemplate && customVariables.length > 0 && (
        <section className="rounded-xl border border-border bg-page-alt p-4">
          <h2 className="mb-3 text-base font-semibold text-text-primary">{t("variablesTitle")}</h2>
          <p className="mb-3 text-sm text-text-muted">{t("variablesHint")}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {customVariables.map((variable) => (
              <div key={variable.name}>
                <Label htmlFor={`var-${variable.name}`}>
                  <code className="rounded bg-bg-secondary px-1.5 py-0.5 text-xs">{`{{${variable.name}}}`}</code>
                </Label>
                <Input
                  id={`var-${variable.name}`}
                  value={customValues[variable.name] ?? ""}
                  onChange={(event) =>
                    setCustomValues((prev) => ({ ...prev, [variable.name]: event.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <h2 className="mb-3 text-base font-semibold text-text-primary">{t("previewTitle")}</h2>
        {!selectedTemplate ? (
          <p className="text-sm text-text-muted">{t("previewNoTemplate")}</p>
        ) : previewError ? (
          <p role="alert" className="text-sm text-danger">{previewError}</p>
        ) : (
          <div className="min-h-[200px] overflow-auto rounded-md border border-border bg-white p-4">
            <div dangerouslySetInnerHTML={{ __html: preview }} />
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={saveDraft}>
          {t("saveDraft")}
        </Button>
        <Button
          onClick={saveAndSend}
          disabled={!title.trim() || !clientId || !templateId}
        >
          {t("send")}
        </Button>
      </div>
    </div>
  );
}
