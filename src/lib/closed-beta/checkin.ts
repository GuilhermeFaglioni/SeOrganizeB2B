import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../prisma/client";
import {
  recordClosedBetaAudit,
  type ClosedBetaActor,
} from "./service";

export const CHECKIN_EDITION_STATUSES = ["draft", "scheduled", "published", "closed"] as const;
export type CheckinEditionStatus = (typeof CHECKIN_EDITION_STATUSES)[number];

export const CHECKIN_QUESTION_TYPES = [
  "rating",
  "single_choice",
  "multiple_choice",
  "short_text",
] as const;
export type CheckinQuestionType = (typeof CHECKIN_QUESTION_TYPES)[number];

export const CHECKIN_WORKSPACE_STATUSES = [
  "pending",
  "completed",
  "exempt",
  "not_applicable",
] as const;
export type CheckinWorkspaceStatus = (typeof CHECKIN_WORKSPACE_STATUSES)[number];

export type CheckinEditionPhase = "upcoming" | "open" | "overdue";

export const CHECKIN_RATING_MIN = 1;
export const CHECKIN_RATING_MAX = 5;

export class CheckinValidationError extends Error {}
export class CheckinNotFoundError extends Error {}
export class CheckinConflictError extends Error {}
export class CheckinEditionClosedError extends Error {}

type CheckinDb = Prisma.TransactionClient | typeof prisma;

export interface CheckinQuestionInput {
  text: string;
  type: CheckinQuestionType;
  options?: string[];
  required?: boolean;
  position?: number;
  theme?: string | null;
  isSuggestionQuestion?: boolean;
}

export interface CreateCheckinEditionInput {
  title: string;
  isMandatory?: boolean;
  questions: CheckinQuestionInput[];
}

export interface UpdateCheckinEditionInput {
  title?: string;
  isMandatory?: boolean;
  questions?: CheckinQuestionInput[];
}

export interface PublishCheckinEditionInput {
  opensAt?: Date | null;
  closesAt?: Date | null;
}

export interface SubmitCheckinResponseInput {
  editionId: string;
  workspaceId: string;
  profileId: string;
  answers: Record<string, unknown>;
  actor: ClosedBetaActor;
  now?: Date;
}

export interface GrantCheckinExemptionInput {
  editionId: string;
  workspaceId: string;
  reason: string;
  expiresAt: Date;
  actor: ClosedBetaActor;
}

export interface WorkspaceCheckinStatus {
  editionId: string | null;
  phase: CheckinEditionPhase | null;
  workspaceStatus: CheckinWorkspaceStatus;
  blocked: boolean;
}

function requireReason(reason: string): void {
  if (typeof reason !== "string" || reason.trim() === "") {
    throw new CheckinValidationError("A reason is required");
  }
}

function normalizeQuestions(questions: CheckinQuestionInput[]): CheckinQuestionInput[] {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new CheckinValidationError("An edition requires at least one question");
  }
  return questions.map((question, index) => {
    if (typeof question.text !== "string" || question.text.trim() === "") {
      throw new CheckinValidationError("Every question needs a text");
    }
    if (!CHECKIN_QUESTION_TYPES.includes(question.type)) {
      throw new CheckinValidationError(`Unsupported question type: ${question.type}`);
    }
    if (
      (question.type === "single_choice" || question.type === "multiple_choice") &&
      (!Array.isArray(question.options) || question.options.length === 0)
    ) {
      throw new CheckinValidationError("Choice questions require options");
    }
    return {
      text: question.text.trim(),
      type: question.type,
      options: question.options ?? undefined,
      required: question.required ?? true,
      position: question.position ?? index,
      theme: question.theme ?? null,
      isSuggestionQuestion: question.isSuggestionQuestion ?? false,
    };
  });
}

function validateAnswers(
  questions: { id: string; type: string; options: Prisma.JsonValue }[],
  answers: Record<string, unknown>,
): void {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new CheckinValidationError("Answers must be an object");
  }
  const questionIds = new Set(questions.map((question) => question.id));
  for (const key of Object.keys(answers)) {
    if (!questionIds.has(key)) {
      throw new CheckinValidationError(`Answer references an unknown question: ${key}`);
    }
  }
  for (const question of questions) {
    if (question.type === "rating") {
      const value = answers[question.id];
      if (typeof value !== "number" || value < CHECKIN_RATING_MIN || value > CHECKIN_RATING_MAX) {
        throw new CheckinValidationError(
          `Rating must be a number between ${CHECKIN_RATING_MIN} and ${CHECKIN_RATING_MAX}`
        );
      }
    } else if (question.type === "single_choice") {
      const value = answers[question.id];
      const options = (question.options as string[]) ?? [];
      if (typeof value !== "string" || !options.includes(value)) {
        throw new CheckinValidationError("Single choice must be one of the options");
      }
    } else if (question.type === "multiple_choice") {
      const value = answers[question.id];
      const options = (question.options as string[]) ?? [];
      if (
        !Array.isArray(value) ||
        value.some((item) => typeof item !== "string") ||
        value.some((item) => !options.includes(item))
      ) {
        throw new CheckinValidationError("Multiple choice must be a subset of the options");
      }
    } else if (question.type === "short_text") {
      const value = answers[question.id];
      if (typeof value !== "string") {
        throw new CheckinValidationError("Short text answers must be a string");
      }
    }
  }
}

function missingRequiredQuestions(
  questions: { id: string; required: boolean; isSuggestionQuestion: boolean }[],
  answers: Record<string, unknown>,
): string[] {
  return questions
    .filter((question) => {
      if (!question.required) return false;
      const value = answers[question.id];
      if (value === undefined || value === null) return true;
      return value === "" && !question.isSuggestionQuestion;
    })
    .map((question) => question.id);
}

export async function getActiveCheckinEdition() {
  return prisma.closedBetaCheckinEdition.findFirst({
    where: { status: "published", isMandatory: true },
    orderBy: [{ opensAt: "desc" }, { createdAt: "desc" }],
    include: { questions: { orderBy: { position: "asc" } } },
  });
}

export function getCheckinEditionPhase(
  edition: { status: string; opensAt: Date | null; closesAt: Date | null },
  now = new Date(),
): CheckinEditionPhase | null {
  if (edition.status !== "published") return null;
  if (edition.opensAt && edition.opensAt > now) return "upcoming";
  if (edition.closesAt && edition.closesAt < now) return "overdue";
  return "open";
}

async function getWorkspaceEnrollmentStatus(workspaceId: string): Promise<string | null> {
  const enrollment = await prisma.closedBetaEnrollment.findUnique({
    where: { workspaceId },
    select: { status: true },
  });
  return enrollment?.status ?? null;
}

export async function getWorkspaceCheckin(
  workspaceId: string,
  now = new Date(),
): Promise<WorkspaceCheckinStatus> {
  const edition = await getActiveCheckinEdition();
  if (!edition) {
    return { editionId: null, phase: null, workspaceStatus: "not_applicable", blocked: false };
  }

  const enrollmentStatus = await getWorkspaceEnrollmentStatus(workspaceId);
  if (enrollmentStatus !== "active") {
    return {
      editionId: edition.id,
      phase: getCheckinEditionPhase(edition, now),
      workspaceStatus: "not_applicable",
      blocked: false,
    };
  }

  const state = await prisma.closedBetaCheckinWorkspaceState.findUnique({
    where: { editionId_workspaceId: { editionId: edition.id, workspaceId } },
  });

  let workspaceStatus: CheckinWorkspaceStatus = "pending";
  if (state?.status === "completed") {
    workspaceStatus = "completed";
  } else if (state?.status === "exempt") {
    workspaceStatus =
      !state.exemptionExpiresAt || state.exemptionExpiresAt > now ? "exempt" : "pending";
  }

  const phase = getCheckinEditionPhase(edition, now);
  const blocked = phase === "overdue" && workspaceStatus === "pending";

  return { editionId: edition.id, phase, workspaceStatus, blocked };
}

export async function isWorkspaceCheckinBlocked(
  workspaceId: string,
  now = new Date(),
): Promise<boolean> {
  const status = await getWorkspaceCheckin(workspaceId, now);
  return status.blocked;
}

export async function createCheckinEdition(
  input: CreateCheckinEditionInput,
  actor: ClosedBetaActor,
) {
  if (typeof input.title !== "string" || input.title.trim() === "") {
    throw new CheckinValidationError("An edition title is required");
  }
  const questions = normalizeQuestions(input.questions);
  return prisma.$transaction(async (client) => {
    const edition = await client.closedBetaCheckinEdition.create({
      data: {
        title: input.title.trim(),
        isMandatory: input.isMandatory ?? true,
        status: "draft",
      },
    });
    await client.closedBetaCheckinQuestion.createMany({
      data: questions.map((question) => ({
        editionId: edition.id,
        text: question.text,
        type: question.type,
        options: question.options as Prisma.InputJsonValue | undefined,
        required: question.required,
        position: question.position,
        theme: question.theme,
        isSuggestionQuestion: question.isSuggestionQuestion,
      })),
    });
    await recordClosedBetaAudit(client, {
      actor,
      action: "checkin.edition.created",
      targetType: "closed_beta_checkin_edition",
      targetId: edition.id,
      afterValue: { title: edition.title, questionCount: questions.length },
    });
    return getCheckinEdition(edition.id, client);
  });
}

export async function getCheckinEdition(
  editionId: string,
  client: CheckinDb = prisma,
) {
  const edition = await client.closedBetaCheckinEdition.findUnique({
    where: { id: editionId },
    include: { questions: { orderBy: { position: "asc" } } },
  });
  if (!edition) throw new CheckinNotFoundError("Check-in edition not found");
  return edition;
}

export async function listCheckinEditions() {
  return prisma.closedBetaCheckinEdition.findMany({
    orderBy: { createdAt: "desc" },
    include: { questions: { orderBy: { position: "asc" } } },
  });
}

export async function updateCheckinEdition(
  editionId: string,
  input: UpdateCheckinEditionInput,
  actor: ClosedBetaActor,
) {
  return prisma.$transaction(async (client) => {
    const existing = await client.closedBetaCheckinEdition.findUnique({
      where: { id: editionId },
    });
    if (!existing) throw new CheckinNotFoundError("Check-in edition not found");
    if (existing.status === "published" || existing.status === "closed") {
      throw new CheckinValidationError(
        "Published or closed editions cannot be edited"
      );
    }

    if (
      input.title === undefined &&
      input.isMandatory === undefined &&
      input.questions === undefined
    ) {
      throw new CheckinValidationError("Nothing to update");
    }

    const data: Prisma.ClosedBetaCheckinEditionUpdateInput = {};
    if (input.title !== undefined) {
      if (typeof input.title !== "string" || input.title.trim() === "") {
        throw new CheckinValidationError("An edition title is required");
      }
      data.title = input.title.trim();
    }
    if (input.isMandatory !== undefined) {
      data.isMandatory = input.isMandatory;
    }
    if (input.questions !== undefined) {
      const questions = normalizeQuestions(input.questions);
      await client.closedBetaCheckinQuestion.deleteMany({
        where: { editionId },
      });
      await client.closedBetaCheckinQuestion.createMany({
        data: questions.map((question) => ({
          editionId,
          text: question.text,
          type: question.type,
          options: question.options as Prisma.InputJsonValue | undefined,
          required: question.required,
          position: question.position,
          theme: question.theme,
          isSuggestionQuestion: question.isSuggestionQuestion,
        })),
      });
    }

    const edition = await client.closedBetaCheckinEdition.update({
      where: { id: editionId },
      data,
    });
    await recordClosedBetaAudit(client, {
      actor,
      action: "checkin.edition.updated",
      targetType: "closed_beta_checkin_edition",
      targetId: edition.id,
      afterValue: { title: edition.title },
    });
    return getCheckinEdition(editionId, client);
  });
}

export async function publishCheckinEdition(
  editionId: string,
  input: PublishCheckinEditionInput = {},
  actor: ClosedBetaActor,
) {
  return prisma.$transaction(async (client) => {
    const edition = await client.closedBetaCheckinEdition.findUnique({
      where: { id: editionId },
      include: { questions: true },
    });
    if (!edition) throw new CheckinNotFoundError("Check-in edition not found");
    if (edition.status === "closed") {
      throw new CheckinValidationError("Closed editions cannot be published again");
    }

    const questions = edition.questions;
    if (questions.length === 0) {
      throw new CheckinValidationError("An edition needs questions before publication");
    }
    if (!questions.some((question) => question.isSuggestionQuestion)) {
      throw new CheckinValidationError(
        "An edition needs a functionality suggestion question before publication"
      );
    }

    if (edition.isMandatory) {
      const other = await client.closedBetaCheckinEdition.findFirst({
        where: {
          id: { not: editionId },
          status: "published",
          isMandatory: true,
        },
      });
      if (other) {
        throw new CheckinConflictError(
          "Another mandatory check-in edition is already published"
        );
      }
    }

    const now = new Date();
    if (input.closesAt && input.opensAt && input.closesAt <= input.opensAt) {
      throw new CheckinValidationError("closesAt must be after opensAt");
    }

    const published = await client.closedBetaCheckinEdition.update({
      where: { id: editionId },
      data: {
        status: "published",
        opensAt: input.opensAt ?? edition.opensAt ?? now,
        closesAt: input.closesAt ?? edition.closesAt ?? null,
      },
    });
    await recordClosedBetaAudit(client, {
      actor,
      action: "checkin.edition.published",
      targetType: "closed_beta_checkin_edition",
      targetId: edition.id,
      afterValue: {
        title: edition.title,
        opensAt: published.opensAt?.toISOString() ?? null,
        closesAt: published.closesAt?.toISOString() ?? null,
      },
    });
    return getCheckinEdition(editionId, client);
  });
}

export async function closeCheckinEdition(editionId: string, actor: ClosedBetaActor) {
  return prisma.$transaction(async (client) => {
    const edition = await client.closedBetaCheckinEdition.findUnique({
      where: { id: editionId },
    });
    if (!edition) throw new CheckinNotFoundError("Check-in edition not found");
    if (edition.status !== "published") {
      throw new CheckinValidationError("Only published editions can be closed");
    }
    const closed = await client.closedBetaCheckinEdition.update({
      where: { id: editionId },
      data: { status: "closed" },
    });
    await recordClosedBetaAudit(client, {
      actor,
      action: "checkin.edition.closed",
      targetType: "closed_beta_checkin_edition",
      targetId: edition.id,
      afterValue: { title: closed.title, status: closed.status },
    });
    return closed;
  });
}

export async function submitCheckinResponse(input: SubmitCheckinResponseInput) {
  const now = input.now ?? new Date();

  const edition = await prisma.closedBetaCheckinEdition.findUnique({
    where: { id: input.editionId },
    include: { questions: true },
  });
  if (!edition) throw new CheckinNotFoundError("Check-in edition not found");
  if (edition.status === "closed") {
    throw new CheckinEditionClosedError("This check-in edition is closed");
  }
  if (edition.status !== "published") {
    throw new CheckinValidationError("Responses can only be submitted for a published edition");
  }
  if (edition.opensAt && edition.opensAt > now) {
    throw new CheckinValidationError("This check-in edition has not opened yet");
  }

  const enrollment = await prisma.closedBetaEnrollment.findUnique({
    where: { workspaceId: input.workspaceId },
    select: { status: true },
  });
  if (!enrollment || enrollment.status !== "active") {
    throw new CheckinValidationError("This workspace is not enrolled in Closed Beta");
  }

  const profile = await prisma.profile.findUnique({
    where: { id: input.profileId },
    select: { tenantId: true, removedAt: true },
  });
  if (!profile || profile.removedAt || profile.tenantId !== input.workspaceId) {
    throw new CheckinValidationError("The respondent is not an active member of this workspace");
  }

  validateAnswers(edition.questions, input.answers);
  const missing = missingRequiredQuestions(
    edition.questions.map((question) => ({
      id: question.id,
      required: question.required,
      isSuggestionQuestion: question.isSuggestionQuestion,
    })),
    input.answers,
  );
  if (missing.length > 0) {
    throw new CheckinValidationError("Some required questions were not answered");
  }

  return prisma.$transaction(async (client) => {
    const existing = await client.closedBetaCheckinResponse.findUnique({
      where: {
        editionId_profileId: {
          editionId: input.editionId,
          profileId: input.profileId,
        },
      },
    });
    if (existing) {
      const state = await client.closedBetaCheckinWorkspaceState.findUnique({
        where: {
          editionId_workspaceId: {
            editionId: input.editionId,
            workspaceId: input.workspaceId,
          },
        },
      });
      return {
        response: existing,
        completedWorkspace: state?.status === "completed",
        workspaceStatus: (state?.status ?? "pending") as CheckinWorkspaceStatus,
        duplicate: true,
      };
    }

    await client.$executeRaw(Prisma.sql`
      INSERT INTO closed_beta_checkin_workspace_states (id, edition_id, workspace_id, status, created_at, updated_at)
      VALUES (${randomUUID()}, ${input.editionId}, ${input.workspaceId}, 'pending', ${now}, ${now})
      ON CONFLICT (edition_id, workspace_id) DO NOTHING
    `);

    const rows = await client.$queryRaw<
      Array<{ id: string; status: string; exemption_expires_at: Date | null }>
    >(Prisma.sql`
      SELECT id, status, exemption_expires_at
      FROM closed_beta_checkin_workspace_states
      WHERE edition_id = ${input.editionId} AND workspace_id = ${input.workspaceId}
      FOR UPDATE
    `);
    const state = rows[0];
    if (!state) {
      throw new CheckinConflictError("Workspace check-in state could not be resolved");
    }

    const canComplete =
      state.status !== "completed" &&
      !(state.status === "exempt" && state.exemption_expires_at && state.exemption_expires_at > now);

    const response = await client.closedBetaCheckinResponse.create({
      data: {
        editionId: input.editionId,
        workspaceId: input.workspaceId,
        profileId: input.profileId,
        answers: input.answers as Prisma.InputJsonValue,
        isPrimary: canComplete,
      },
    });

    let workspaceStatus: CheckinWorkspaceStatus =
      state.status === "completed"
        ? "completed"
        : state.status === "exempt"
          ? "exempt"
          : "pending";
    if (canComplete) {
      await client.closedBetaCheckinWorkspaceState.update({
        where: { id: state.id },
        data: {
          status: "completed",
          completedByProfileId: input.profileId,
          completedAt: now,
          exemptionReason: null,
          exemptionExpiresAt: null,
          grantedByUserId: null,
          grantedByEmail: null,
        },
      });
      workspaceStatus = "completed";
    }

    await recordClosedBetaAudit(client, {
      actor: input.actor,
      action: canComplete ? "checkin.response.completed" : "checkin.response.submitted",
      targetType: "closed_beta_checkin_response",
      targetId: response.id,
      afterValue: {
        editionId: input.editionId,
        workspaceId: input.workspaceId,
        isPrimary: canComplete,
      },
    });

    return {
      response,
      completedWorkspace: canComplete,
      workspaceStatus,
      duplicate: false,
    };
  });
}

export async function grantCheckinExemption(input: GrantCheckinExemptionInput) {
  requireReason(input.reason);
  if (!input.expiresAt || Number.isNaN(input.expiresAt.getTime())) {
    throw new CheckinValidationError("An expiration date is required");
  }
  return prisma.$transaction(async (client) => {
    const edition = await client.closedBetaCheckinEdition.findUnique({
      where: { id: input.editionId },
    });
    if (!edition) throw new CheckinNotFoundError("Check-in edition not found");

    await client.$executeRaw(Prisma.sql`
      INSERT INTO closed_beta_checkin_workspace_states (id, edition_id, workspace_id, status, created_at, updated_at)
      VALUES (${randomUUID()}, ${input.editionId}, ${input.workspaceId}, 'pending', ${new Date()}, ${new Date()})
      ON CONFLICT (edition_id, workspace_id) DO NOTHING
    `);

    const state = await client.closedBetaCheckinWorkspaceState.upsert({
      where: {
        editionId_workspaceId: {
          editionId: input.editionId,
          workspaceId: input.workspaceId,
        },
      },
      update: {
        status: "exempt",
        exemptionReason: input.reason.trim(),
        exemptionExpiresAt: input.expiresAt,
        grantedByUserId: input.actor.userId,
        grantedByEmail: input.actor.email,
        completedByProfileId: null,
        completedAt: null,
      },
      create: {
        editionId: input.editionId,
        workspaceId: input.workspaceId,
        status: "exempt",
        exemptionReason: input.reason.trim(),
        exemptionExpiresAt: input.expiresAt,
        grantedByUserId: input.actor.userId,
        grantedByEmail: input.actor.email,
      },
    });
    await recordClosedBetaAudit(client, {
      actor: input.actor,
      action: "checkin.exemption.granted",
      targetType: "closed_beta_checkin_edition",
      targetId: input.editionId,
      afterValue: {
        workspaceId: input.workspaceId,
        reason: input.reason.trim(),
        expiresAt: input.expiresAt.toISOString(),
      },
    });
    return state;
  });
}

export async function revokeCheckinExemption(
  editionId: string,
  workspaceId: string,
  actor: ClosedBetaActor,
) {
  return prisma.$transaction(async (client) => {
    const state = await client.closedBetaCheckinWorkspaceState.findUnique({
      where: { editionId_workspaceId: { editionId, workspaceId } },
    });
    if (!state || state.status !== "exempt") {
      throw new CheckinNotFoundError("No active exemption for this workspace");
    }
    const updated = await client.closedBetaCheckinWorkspaceState.update({
      where: { id: state.id },
      data: {
        status: "pending",
        exemptionReason: null,
        exemptionExpiresAt: null,
        grantedByUserId: null,
        grantedByEmail: null,
      },
    });
    await recordClosedBetaAudit(client, {
      actor,
      action: "checkin.exemption.revoked",
      targetType: "closed_beta_checkin_edition",
      targetId: editionId,
      afterValue: { workspaceId },
    });
    return updated;
  });
}

export async function expireCheckinExemptions(now = new Date()) {
  const result = await prisma.closedBetaCheckinWorkspaceState.updateMany({
    where: { status: "exempt", exemptionExpiresAt: { lte: now } },
    data: { status: "pending" },
  });
  return { count: result.count };
}
