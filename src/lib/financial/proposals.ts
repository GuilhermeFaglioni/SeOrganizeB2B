import sanitizeHtml from "sanitize-html";
import { toDecimal } from "./money";
import { escapeHtml, SYSTEM_VARIABLES } from "./proposal-variables";

export { detectVariables, escapeHtml } from "./proposal-variables";
export type { TemplateVariable, SystemVariable } from "./proposal-variables";

export interface ProposalItemData {
  name: string;
  description?: string | null;
  quantity?: string | null;
  price?: string | null;
  position: number;
}

export interface ProposalRenderContext {
  values: Record<string, string>;
  items: ProposalItemData[];
  companyName: string | null;
  companyLogoUrl: string | null;
  locale: string;
}

export function sanitizeProposalHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "span",
      "div",
      "section",
      "header",
      "footer",
      "main",
      "article",
      "figure",
      "figcaption",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "s",
      "small",
      "br",
      "hr",
      "blockquote",
      "code",
      "pre",
      "sup",
      "sub",
      "style",
    ],
    allowedAttributes: {
      "*": ["class", "style", "id"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
    disallowedTagsMode: "discard",
  });
}

function formatCivilDate(date: string | null, locale: string): string {
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatMoney(value: string | null, locale: string): string {
  if (!value) return "";
  try {
    return new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(toDecimal(value).toNumber());
  } catch {
    return value;
  }
}

export const proposalDateFormatter = formatCivilDate;
export const proposalMoneyFormatter = formatMoney;

function itemsLabels(locale: string) {
  return locale === "en"
    ? { description: "Description", qty: "Qty", price: "Price", total: "Total" }
    : { description: "Descrição", qty: "Qtd", price: "Preço", total: "Total" };
}

function renderItemsTable(items: ProposalItemData[], locale: string): string {
  if (items.length === 0) return "";
  const labels = itemsLabels(locale);
  const header = `
    <tr>
      <th style="text-align:left;padding:8px 12px;border-bottom:1px solid #e2e8f0;">${labels.description}</th>
      <th style="text-align:center;padding:8px 12px;border-bottom:1px solid #e2e8f0;">${labels.qty}</th>
      <th style="text-align:right;padding:8px 12px;border-bottom:1px solid #e2e8f0;">${labels.price}</th>
      <th style="text-align:right;padding:8px 12px;border-bottom:1px solid #e2e8f0;">${labels.total}</th>
    </tr>`;
  const rows = items
    .map((item) => {
      const quantity = item.quantity ? toDecimal(item.quantity) : null;
      const price = item.price ? toDecimal(item.price) : null;
      const lineTotal = quantity && price ? quantity.times(price) : null;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.name)}</td>
        <td style="text-align:center;padding:8px 12px;border-bottom:1px solid #e2e8f0;">${quantity ? quantity.toFixed(2) : "—"}</td>
        <td style="text-align:right;padding:8px 12px;border-bottom:1px solid #e2e8f0;">${price ? formatMoney(price.toFixed(2), locale) : "—"}</td>
        <td style="text-align:right;padding:8px 12px;border-bottom:1px solid #e2e8f0;">${lineTotal ? formatMoney(lineTotal.toFixed(2), locale) : "—"}</td>
      </tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">${header}${rows}</table>`;
}

export function renderProposalHtml(
  templateHtml: string,
  context: ProposalRenderContext
): string {
  const { values, items, companyName, companyLogoUrl, locale } = context;

  let html = templateHtml;

  const systemValues: Record<string, string> = {
    "cliente.nome": values["cliente.nome"] ?? "",
    "cliente.razao_social": values["cliente.razao_social"] ?? "",
    "cliente.email": values["cliente.email"] ?? "",
    "cliente.telefone": values["cliente.telefone"] ?? "",
    "cliente.cpf_cnpj": values["cliente.cpf_cnpj"] ?? "",
    "proposta.numero": values["proposta.numero"] ?? "",
    "proposta.titulo": values["proposta.titulo"] ?? "",
    "proposta.data": values["proposta.data"] ?? "",
    "proposta.validade": values["proposta.validade"] ?? "",
    "proposta.valor_total": values["proposta.valor_total"] ?? "",
  };

  for (const [key, rawValue] of Object.entries(systemValues)) {
    html = html.split(`{{${key}}}`).join(escapeHtml(rawValue));
  }

  const itemsHtml = renderItemsTable(items, locale);
  html = html.split("{{itens}}").join(itemsHtml);

  const logoHtml = companyLogoUrl
    ? `<img src="${escapeHtml(companyLogoUrl)}" alt="${escapeHtml(companyName ?? "")}" style="max-width:200px;max-height:80px;" />`
    : "";
  html = html.split("{{empresa.logo}}").join(logoHtml);
  html = html.split("{{empresa.nome}}").join(escapeHtml(companyName ?? ""));

  for (const [key, rawValue] of Object.entries(values)) {
    if ((SYSTEM_VARIABLES as readonly string[]).includes(key)) continue;
    html = html.split(`{{${key}}}`).join(escapeHtml(rawValue ?? ""));
  }

  html = html.replace(/{{[\w.\s]+}}/g, "");

  return html;
}

export function isProposalStatus(value: string): boolean {
  return ["draft", "sent", "viewed", "accepted", "rejected"].includes(value);
}
