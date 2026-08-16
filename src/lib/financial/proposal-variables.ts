export const SYSTEM_VARIABLES = [
  "cliente.nome",
  "cliente.razao_social",
  "cliente.email",
  "cliente.telefone",
  "cliente.cpf_cnpj",
  "proposta.numero",
  "proposta.titulo",
  "proposta.data",
  "proposta.validade",
  "proposta.valor_total",
  "itens",
  "empresa.nome",
  "empresa.logo",
] as const;

export type SystemVariable = (typeof SYSTEM_VARIABLES)[number];

export const SYSTEM_VARIABLE_DESCRIPTION_KEYS: Record<SystemVariable, string> = {
  "cliente.nome": "clientName",
  "cliente.razao_social": "clientLegalName",
  "cliente.email": "clientEmail",
  "cliente.telefone": "clientPhone",
  "cliente.cpf_cnpj": "clientDocument",
  "proposta.numero": "proposalNumber",
  "proposta.titulo": "proposalTitle",
  "proposta.data": "proposalIssueDate",
  "proposta.validade": "proposalValidUntil",
  "proposta.valor_total": "proposalTotal",
  itens: "items",
  "empresa.nome": "companyName",
  "empresa.logo": "companyLogo",
};

export interface TemplateVariable {
  name: string;
  isSystem: boolean;
}

const VARIABLE_RE = /{{\s*([\w.]+)\s*}}/g;

export function detectVariables(html: string): TemplateVariable[] {
  const seen = new Map<string, TemplateVariable>();
  const regex = new RegExp(VARIABLE_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const name = match[1].trim();
    if (!seen.has(name)) {
      seen.set(name, {
        name,
        isSystem: (SYSTEM_VARIABLES as readonly string[]).includes(name),
      });
    }
  }
  return Array.from(seen.values());
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
