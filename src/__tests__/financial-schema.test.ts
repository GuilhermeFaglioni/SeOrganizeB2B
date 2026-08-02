import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(
  resolve(__dirname, "../../prisma/schema.prisma"),
  "utf-8"
);
const migration = readFileSync(
  resolve(
    __dirname,
    "../../prisma/migrations/20260802120000_financial_module/migration.sql"
  ),
  "utf-8"
);

const MODELS = [
  "Client",
  "Contract",
  "ContractItem",
  "ContractProject",
  "Installment",
  "ContractChange",
  "ContractAudit",
];

const TABLES = [
  "clients",
  "contracts",
  "contract_items",
  "contract_projects",
  "installments",
  "contract_changes",
  "contract_audits",
];

function modelBody(model: string): string {
  const match = schema.match(
    new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`)
  );
  if (!match) throw new Error(`model ${model} not found`);
  return match[1];
}

function fieldOf(body: string, name: string): string {
  const match = body.match(
    new RegExp(`^\\s*${name}\\s+([^\\s]+)\\s*([^\\n]*)`, "m")
  );
  if (!match) throw new Error(`field ${name} not found`);
  return `${name} ${match[1]} ${match[2]}`.trim();
}

function tableBody(table: string): string {
  const match = migration.match(
    new RegExp(`CREATE TABLE "${table}" \\(([\\s\\S]*?)\\n\\);`)
  );
  if (!match) throw new Error(`table ${table} not found`);
  return match[1];
}

function columnOf(body: string, column: string): string {
  const match = body.match(new RegExp(`^\\s*"${column}"([^\\n]*)`, "m"));
  if (!match) throw new Error(`column ${column} not found`);
  return `"${column}"${match[1]}`.trim();
}

describe("financial module schema", () => {
  it.each(MODELS)("defines %s", (model) => {
    expect(modelBody(model)).toBeTruthy();
  });

  it("stores money as decimal and dates as civil strings", () => {
    expect(schema).toContain("@db.Decimal(14, 2)");
    expect(fieldOf(modelBody("Contract"), "startDate")).toContain(
      '@map("start_date")'
    );
    expect(fieldOf(modelBody("Installment"), "dueDate")).toContain(
      '@map("due_date")'
    );
  });

  it("keeps the contract code unique and the client cpf/cnpj unique", () => {
    const code = fieldOf(modelBody("Contract"), "code");
    expect(code).toMatch(/^code\s+String/);
    expect(code).toContain("@unique");
    expect(modelBody("Client")).toContain("@@unique([cpfCnpj])");
  });

  it("allows incomplete contract drafts without breaking the required code", () => {
    const contract = modelBody("Contract");
    expect(fieldOf(contract, "code")).toContain("@unique");
    expect(fieldOf(contract, "code")).not.toContain("?");
    for (const nullable of [
      "title",
      "clientId",
      "durationType",
      "startDate",
    ]) {
      expect(fieldOf(contract, nullable)).toContain("String?");
    }
    expect(fieldOf(contract, "officialValue")).toContain("Decimal?");
    expect(fieldOf(contract, "client")).toContain("Client?");

    const contracts = tableBody("contracts");
    expect(columnOf(contracts, "code")).toContain("NOT NULL");
    for (const nullable of [
      "title",
      "client_id",
      "duration_type",
      "official_value",
      "start_date",
    ]) {
      expect(columnOf(contracts, nullable)).not.toContain("NOT NULL");
    }
  });

  it("guards against duplicate recurring installments per cycle", () => {
    expect(modelBody("Installment")).toContain("@@unique([contractId, cycleKey])");
  });

  it("keeps refunds linked to the original installment", () => {
    const installment = modelBody("Installment");
    expect(fieldOf(installment, "refundOfId")).toContain("String?");
    expect(fieldOf(installment, "refunds")).toContain(
      '@relation("InstallmentRefund")'
    );
  });

  it("creates all tables in a single additive migration", () => {
    for (const table of TABLES) {
      expect(tableBody(table)).toBeTruthy();
    }
  });

  it("retains the client via onDelete Restrict on the contract relation", () => {
    const contract = modelBody("Contract");
    expect(fieldOf(contract, "client")).toContain("onDelete: Restrict");

    const fkeyBlock = migration.match(
      /contracts_client_id_fkey[\s\S]*?ON DELETE (\w+)/
    );
    expect(fkeyBlock).toBeTruthy();
    expect(fkeyBlock![1]).toBe("RESTRICT");
  });
});
