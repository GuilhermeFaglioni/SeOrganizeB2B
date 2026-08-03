import { randomBytes } from "crypto";

export function slugifyProposalTitle(title: string): string {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");

  return normalized || "proposta";
}

export function makeProposalPublicSlug(
  title: string,
  suffix = randomBytes(8).toString("hex")
): string {
  return `${slugifyProposalTitle(title)}-${suffix}`;
}
