import type { Profile } from "@prisma/client";
import { prisma } from "../../../prisma/client";

const SUPER_ADMIN_EMAIL_ENV = "SUPER_ADMIN_EMAIL";
const SUPER_ADMIN_EMAILS_ENV = "SUPER_ADMIN_EMAILS";

export function parseSuperAdminEmails(
  raw: string | null | undefined
): string[] {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getConfiguredSuperAdminEmails(): string[] {
  return parseSuperAdminEmails(
    process.env[SUPER_ADMIN_EMAIL_ENV] ?? process.env[SUPER_ADMIN_EMAILS_ENV]
  );
}

export function isSuperAdmin(
  profile: Pick<Profile, "email"> | null | undefined
): boolean {
  if (!profile?.email) return false;
  const emails = getConfiguredSuperAdminEmails();
  if (emails.length === 0) return false;
  return emails.includes(profile.email.trim().toLowerCase());
}

export async function getSuperAdminStatus(userId: string): Promise<boolean> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return isSuperAdmin(profile);
}
