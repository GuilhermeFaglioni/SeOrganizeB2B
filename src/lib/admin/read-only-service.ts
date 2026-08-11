import { randomBytes } from "node:crypto";
import { prisma } from "../../../prisma/client";
import { sendReadOnlyAccessEmail } from "./read-only-email";

export const READ_ONLY_TTL_DAYS = 7;
export const READ_ONLY_MAX_TTL_DAYS = 30;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ReadOnlyAccessValidationError extends Error {}
export class ReadOnlyAccessNotFoundError extends Error {}
export class ReadOnlyAccessExpiredError extends Error {}
export class ReadOnlyAccessUsedError extends Error {}

export interface CreateReadOnlyAccessInput {
  workspaceId: string;
  workspaceName: string;
  email: string;
  expiresInDays?: number;
}

export async function createReadOnlyAccess(input: CreateReadOnlyAccessInput) {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    throw new ReadOnlyAccessValidationError("A valid email is required");
  }

  const expiresInDays = input.expiresInDays ?? READ_ONLY_TTL_DAYS;
  if (
    !Number.isInteger(expiresInDays) ||
    expiresInDays < 1 ||
    expiresInDays > READ_ONLY_MAX_TTL_DAYS
  ) {
    throw new ReadOnlyAccessValidationError(
      "expiresIn must be a whole number of days between 1 and 30"
    );
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000
  );

  const access = await prisma.readOnlyAccess.create({
    data: {
      workspaceId: input.workspaceId,
      email,
      token,
      expiresAt,
    },
  });

  await sendReadOnlyAccessEmail(email, {
    token,
    expiresAt,
    workspaceName: input.workspaceName,
  });

  return {
    id: access.id,
    token,
    expiresAt,
    email,
    url: `/accept-read-only/${token}`,
  };
}

export async function acceptReadOnlyAccess(token: string) {
  const access = await prisma.readOnlyAccess.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true } },
    },
  });
  if (!access) {
    throw new ReadOnlyAccessNotFoundError(
      "Access link not found or no longer valid"
    );
  }
  if (access.usedAt) {
    throw new ReadOnlyAccessUsedError("This access link has already been used");
  }
  if (access.expiresAt.getTime() < Date.now()) {
    throw new ReadOnlyAccessExpiredError("This access link has expired");
  }

  const used = await prisma.readOnlyAccess.update({
    where: { id: access.id },
    data: { usedAt: new Date() },
  });

  return {
    workspaceId: access.workspace.id,
    workspaceName: access.workspace.name,
    email: access.email,
    usedAt: used.usedAt,
  };
}
