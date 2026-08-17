import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const placeholders = [
  "TODO_LEGAL_ENTITY_NAME",
  "TODO_COMPANY_DOCUMENT",
  "TODO_COMPANY_ADDRESS",
  "TODO_SUPPORT_EMAIL",
  "TODO_PRIVACY_EMAIL",
  "TODO_POLICY_EFFECTIVE_DATE",
  "TODO_RETENTION_POLICY",
  "TODO_TERMS_ACCEPTANCE_POLICY",
];

if (process.env.ALLOW_LEGAL_PLACEHOLDERS === "true") {
  console.log("Legal placeholders are explicitly allowed for this environment.");
  process.exit(0);
}

const root = resolve(__dirname, "..");
const sources = [
  readFileSync(resolve(root, "messages/pt-BR.json"), "utf8"),
  readFileSync(resolve(root, "messages/en.json"), "utf8"),
];
const found = placeholders.filter((placeholder) =>
  sources.some((source) => source.includes(placeholder)),
);

if (found.length > 0) {
  console.error(
    `Production legal configuration is incomplete. Replace: ${found.join(", ")}`,
  );
  process.exit(1);
}

console.log("Production legal configuration contains no controlled placeholders.");
