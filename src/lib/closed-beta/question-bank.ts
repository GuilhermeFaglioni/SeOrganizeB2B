import { Prisma } from "@prisma/client";
import { prisma } from "../../../prisma/client";
import { recordClosedBetaAudit, type ClosedBetaActor } from "./service";

export const QUESTION_BANK_STATUSES = ["active", "archived"] as const;
export type QuestionBankStatus = (typeof QUESTION_BANK_STATUSES)[number];

export const QUESTION_BANK_THEMES = [
  "value",
  "difficulty",
  "onboarding",
  "collaboration",
  "financial",
  "reliability",
  "missing_features",
  "features",
] as const;

export class QuestionBankValidationError extends Error {}
export class QuestionBankNotFoundError extends Error {}

type QuestionBankDb = Prisma.TransactionClient | typeof prisma;

export interface QuestionBankItemInput {
  text: string;
  type: string;
  options?: string[];
  required?: boolean;
  theme?: string | null;
  isSuggestionQuestion?: boolean;
}

export type QuestionBankItemPatch = Partial<QuestionBankItemInput>;

export interface QuestionBankItem {
  id: string;
  text: string;
  type: string;
  options: string[] | null;
  required: boolean;
  theme: string | null;
  isSuggestionQuestion: boolean;
  status: QuestionBankStatus;
  createdAt: Date;
  updatedAt: Date;
}

const SUPPORTED_QUESTION_TYPES = [
  "rating",
  "single_choice",
  "multiple_choice",
  "short_text",
];

export function normalizeBankQuestion(
  input: QuestionBankItemInput,
): Required<Omit<QuestionBankItemInput, "options">> & { options: string[] } {
  if (typeof input.text !== "string" || input.text.trim() === "") {
    throw new QuestionBankValidationError("Every question needs a text");
  }
  if (!SUPPORTED_QUESTION_TYPES.includes(input.type)) {
    throw new QuestionBankValidationError(`Unsupported question type: ${input.type}`);
  }
  if (input.isSuggestionQuestion && input.type !== "short_text") {
    throw new QuestionBankValidationError("Suggestion questions must use short text");
  }
  const options = Array.isArray(input.options)
    ? input.options.map((option) => String(option).trim()).filter(Boolean)
    : [];
  if (
    (input.type === "single_choice" || input.type === "multiple_choice") &&
    options.length === 0
  ) {
    throw new QuestionBankValidationError("Choice questions require options");
  }
  return {
    text: input.text.trim(),
    type: input.type,
    options,
    required: input.required ?? true,
    theme: input.theme ?? null,
    isSuggestionQuestion: input.isSuggestionQuestion ?? false,
  };
}

function mapBankItem(item: {
  id: string;
  text: string;
  type: string;
  options: Prisma.JsonValue;
  required: boolean;
  theme: string | null;
  isSuggestionQuestion: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): QuestionBankItem {
  return {
    id: item.id,
    text: item.text,
    type: item.type,
    options: Array.isArray(item.options)
      ? item.options.filter((option): option is string => typeof option === "string")
      : null,
    required: item.required,
    theme: item.theme,
    isSuggestionQuestion: item.isSuggestionQuestion,
    status: (QUESTION_BANK_STATUSES.includes(item.status as QuestionBankStatus)
      ? item.status
      : "active") as QuestionBankStatus,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function createQuestionBankItem(
  input: QuestionBankItemInput,
  actor: ClosedBetaActor,
): Promise<QuestionBankItem> {
  const normalized = normalizeBankQuestion(input);
  const item = await prisma.closedBetaQuestionBank.create({
    data: {
      text: normalized.text,
      type: normalized.type,
      options: normalized.options.length > 0 ? (normalized.options as Prisma.InputJsonValue) : undefined,
      required: normalized.required,
      theme: normalized.theme,
      isSuggestionQuestion: normalized.isSuggestionQuestion,
      status: "active",
    },
  });
  await recordClosedBetaAudit(prisma, {
    actor,
    action: "question_bank.created",
    targetType: "closed_beta_question_bank",
    targetId: item.id,
    afterValue: {
      text: item.text,
      type: item.type,
      theme: item.theme,
      isSuggestionQuestion: item.isSuggestionQuestion,
    },
  });
  return mapBankItem(item);
}

export async function updateQuestionBankItem(
  itemId: string,
  input: QuestionBankItemPatch,
  actor: ClosedBetaActor,
): Promise<QuestionBankItem> {
  return prisma.$transaction(async (client) => {
    const existing = await client.closedBetaQuestionBank.findUnique({
      where: { id: itemId },
    });
    if (!existing) throw new QuestionBankNotFoundError("Question bank item not found");
    if (existing.status === "archived") {
      throw new QuestionBankValidationError("Archived questions cannot be edited");
    }
    const normalized = normalizeBankQuestion({
      text: input.text ?? existing.text,
      type: input.type ?? existing.type,
      options: input.options ?? (Array.isArray(existing.options) ? (existing.options as string[]) : undefined),
      required: input.required ?? existing.required,
      theme: input.theme === undefined ? existing.theme : input.theme,
      isSuggestionQuestion: input.isSuggestionQuestion ?? existing.isSuggestionQuestion,
    });
    const updated = await client.closedBetaQuestionBank.update({
      where: { id: itemId },
      data: {
        text: normalized.text,
        type: normalized.type,
        options: normalized.options.length > 0 ? (normalized.options as Prisma.InputJsonValue) : Prisma.DbNull,
        required: normalized.required,
        theme: normalized.theme,
        isSuggestionQuestion: normalized.isSuggestionQuestion,
      },
    });
    await recordClosedBetaAudit(client, {
      actor,
      action: "question_bank.updated",
      targetType: "closed_beta_question_bank",
      targetId: existing.id,
      beforeValue: { text: existing.text, type: existing.type },
      afterValue: { text: updated.text, type: updated.type },
    });
    return mapBankItem(updated);
  });
}

export async function setQuestionBankItemStatus(
  itemId: string,
  status: QuestionBankStatus,
  actor: ClosedBetaActor,
): Promise<QuestionBankItem> {
  return prisma.$transaction(async (client) => {
    const existing = await client.closedBetaQuestionBank.findUnique({
      where: { id: itemId },
    });
    if (!existing) throw new QuestionBankNotFoundError("Question bank item not found");
    if (existing.status === status) return mapBankItem(existing);
    const updated = await client.closedBetaQuestionBank.update({
      where: { id: itemId },
      data: { status },
    });
    await recordClosedBetaAudit(client, {
      actor,
      action: status === "archived" ? "question_bank.archived" : "question_bank.restored",
      targetType: "closed_beta_question_bank",
      targetId: existing.id,
      beforeValue: { status: existing.status },
      afterValue: { status: updated.status },
    });
    return mapBankItem(updated);
  });
}

export async function listQuestionBankItems(
  options: { status?: QuestionBankStatus; theme?: string } = {},
): Promise<QuestionBankItem[]> {
  const items = await prisma.closedBetaQuestionBank.findMany({
    where: {
      ...(options.status ? { status: options.status } : {}),
      ...(options.theme ? { theme: options.theme } : {}),
    },
    orderBy: [{ theme: "asc" }, { createdAt: "desc" }],
  });
  return items.map(mapBankItem);
}

export async function getQuestionBankItem(
  itemId: string,
  client: QuestionBankDb = prisma,
): Promise<QuestionBankItem> {
  const item = await client.closedBetaQuestionBank.findUnique({
    where: { id: itemId },
  });
  if (!item) throw new QuestionBankNotFoundError("Question bank item not found");
  return mapBankItem(item);
}

export async function getActiveQuestionBankItems(
  ids: string[],
): Promise<QuestionBankItem[]> {
  if (ids.length === 0) return [];
  const items = await prisma.closedBetaQuestionBank.findMany({
    where: { id: { in: ids }, status: "active" },
  });
  return items.map(mapBankItem);
}
