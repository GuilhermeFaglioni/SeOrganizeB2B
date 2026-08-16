"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  detectVariables,
  SYSTEM_VARIABLES,
  SYSTEM_VARIABLE_DESCRIPTION_KEYS,
} from "@/lib/financial/proposal-variables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProposalHtmlPreview } from "@/components/financial/proposals/proposal-html-preview";

interface TemplateEditorProps {
  initialName?: string;
  initialHtml?: string;
  saving?: boolean;
  submitLabel: string;
  onSubmit: (name: string, html: string) => void;
}

const SAMPLE_VALUES: Record<string, string> = {
  "cliente.nome": "Cliente Exemplo",
  "cliente.razao_social": "Cliente Exemplo LTDA",
  "cliente.email": "cliente@exemplo.com",
  "cliente.telefone": "(11) 99999-9999",
  "cliente.cpf_cnpj": "12.345.678/0001-90",
  "proposta.numero": "PRP-2026-0001",
  "proposta.titulo": "Proposta de exemplo",
  "proposta.data": "01/01/2026",
  "proposta.validade": "31/01/2026",
  "proposta.valor_total": "R$ 1.000,00",
  "empresa.nome": "Sua Empresa",
};

export function TemplateEditor({
  initialName = "",
  initialHtml = "",
  saving = false,
  submitLabel,
  onSubmit,
}: TemplateEditorProps) {
  const t = useTranslations("proposals.templateEditor");
  const [name, setName] = useState(initialName);
  const [html, setHtml] = useState(initialHtml);
  const [preview, setPreview] = useState("");
  const [previewError, setPreviewError] = useState("");
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const variables = useMemo(() => detectVariables(html), [html]);
  const customVariables = variables.filter((v) => !v.isSystem);
  const systemVariables = variables.filter((v) => v.isSystem);

  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      runPreview(html);
    }, 350);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  async function runPreview(templateHtml: string) {
    if (!templateHtml.trim()) {
      setPreview("");
      return;
    }
    const values: Record<string, string> = {};
    for (const variable of detectVariables(templateHtml)) {
      values[variable.name] = variable.isSystem
        ? SAMPLE_VALUES[variable.name] ?? ""
        : `[${variable.name}]`;
    }
    try {
      const response = await fetch("/api/proposal-templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: templateHtml,
          values,
          items: [
            {
              name: "Serviço de exemplo",
              quantity: "1",
              price: "1000.00",
              position: 0,
            },
          ],
          locale: "pt-BR",
        }),
      });
      const json = await response.json();
      if (json.error) throw new Error(json.error.message);
      setPreview(json.data.html);
      setPreviewError("");
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : t("previewFailed"));
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(name, html);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="template-name">{t("nameLabel")}</Label>
        <Input
          id="template-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("namePlaceholder")}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="template-html">{t("htmlLabel")}</Label>
            <span className="text-xs text-text-muted">{t("htmlHint")}</span>
          </div>
          <textarea
            id="template-html"
            value={html}
            onChange={(event) => setHtml(event.target.value)}
            rows={22}
            spellCheck={false}
            placeholder={`<h1>{{cliente.nome}}</h1>\n<p>...</p>`}
            className="w-full resize-y rounded-md border border-border bg-page p-3 font-mono text-sm leading-relaxed focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          />
        </div>

        <div className="space-y-2">
          <Label>{t("previewLabel")}</Label>
          {previewError ? (
            <p role="alert" className="text-sm text-danger">
              {previewError}
            </p>
          ) : preview ? (
            <ProposalHtmlPreview html={preview} className="h-[420px]" />
          ) : (
            <div className="min-h-[420px] rounded-md border border-border bg-page p-4">
              <p className="text-sm text-text-muted">{t("previewEmpty")}</p>
            </div>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-page-alt p-4" aria-labelledby="system-variables-title">
        <div className="mb-3">
          <h3 id="system-variables-title" className="text-sm font-semibold text-text-primary">
            {t("systemVariablesTitle")}
          </h3>
          <p className="mt-1 text-sm text-text-muted">{t("systemVariablesHint")}</p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-bg-secondary text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("variableKey")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("variableMeaning")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SYSTEM_VARIABLES.map((variable) => (
                <tr key={variable}>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top">
                    <code className="rounded bg-bg-secondary px-1.5 py-0.5 text-xs text-text-primary">
                      {`{{${variable}}}`}
                    </code>
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary">
                    {t(
                      `systemVariableDescriptions.${SYSTEM_VARIABLE_DESCRIPTION_KEYS[variable]}`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <h3 className="mb-2 text-sm font-semibold text-text-primary">
          {t("variablesTitle")}
        </h3>
        {variables.length === 0 ? (
          <p className="text-sm text-text-muted">{t("noVariables")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {customVariables.map((variable) => (
              <li key={variable.name} className="flex items-center gap-2">
                <code className="rounded bg-bg-secondary px-1.5 py-0.5 text-xs">
                  {`{{${variable.name}}}`}
                </code>
                <span className="rounded bg-bg-secondary px-1.5 text-xs text-text-secondary">
                  {t("customVar")}
                </span>
              </li>
            ))}
            {systemVariables.map((variable) => (
              <li key={variable.name} className="flex items-center gap-2">
                <code className="rounded bg-bg-secondary px-1.5 py-0.5 text-xs">
                  {`{{${variable.name}}}`}
                </code>
                <span className="rounded bg-accent/15 px-1.5 text-xs text-accent">
                  {t("systemVar")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button type="submit" disabled={saving || !name.trim()}>
        {saving ? t("saving") : submitLabel}
      </Button>
    </form>
  );
}
