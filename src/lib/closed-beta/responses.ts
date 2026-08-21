import { Prisma } from "@prisma/client";
import { prisma } from "../../../prisma/client";
import { CheckinNotFoundError, expireCheckinExemptions } from "./checkin";

export interface CheckinResponsesFilter {
  editionId: string;
  workspaceId?: string;
  from?: Date;
  to?: Date;
  theme?: string;
}

export interface CheckinResponseRow {
  id: string;
  editionId: string;
  workspaceId: string;
  workspaceName: string;
  responderId: string;
  responderEmail: string;
  responderName: string | null;
  isPrimary: boolean;
  createdAt: Date | null;
  answers: Prisma.JsonValue;
  workspaceStatus: string;
}

export interface CheckinGroupedQuestion {
  questionId: string;
  text: string;
  type: string;
  theme: string | null;
  options: string[] | null;
  responses: Array<{ workspaceId: string; workspaceName: string; value: unknown }>;
}

export interface CheckinEditionMetrics {
  editionId: string;
  totalWorkspaces: number;
  completed: number;
  pending: number;
  exempt: number;
  completionRate: number | null;
  averageResponseSeconds: number | null;
}

async function getEditionQuestions(editionId: string) {
  const edition = await prisma.closedBetaCheckinEdition.findUnique({
    where: { id: editionId },
    include: { questions: { orderBy: { position: "asc" } } },
  });
  if (!edition) throw new CheckinNotFoundError("Check-in edition not found");
  return edition;
}

function hasAnswerForQuestionTheme(
  answers: Prisma.JsonValue,
  questionIds: ReadonlySet<string>,
): boolean {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return false;
  let found = false;
  questionIds.forEach((questionId) => {
    if (Object.prototype.hasOwnProperty.call(answers, questionId)) found = true;
  });
  return found;
}

export async function listCheckinResponses(
  filter: CheckinResponsesFilter,
): Promise<CheckinResponseRow[]> {
  const edition = await getEditionQuestions(filter.editionId);
  const [responses, states, enrollments] = await Promise.all([
    prisma.closedBetaCheckinResponse.findMany({
      where: {
        editionId: filter.editionId,
        isCurrent: true,
        ...(filter.workspaceId ? { workspaceId: filter.workspaceId } : {}),
        ...(filter.from || filter.to
          ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
          : {}),
      },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        profile: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.closedBetaCheckinWorkspaceState.findMany({
      where: { editionId: filter.editionId },
      select: { workspaceId: true, status: true },
    }),
    prisma.closedBetaEnrollment.findMany({
      where: {
        status: "active",
        ...(filter.workspaceId ? { workspaceId: filter.workspaceId } : {}),
      },
      include: {
        workspace: { select: { id: true, name: true } },
        owner: { select: { id: true, email: true, name: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ]);
  const statusByWorkspace = new Map(states.map((state) => [state.workspaceId, state.status]));
  const themeQuestionIds = filter.theme
    ? new Set(
        edition.questions
          .filter((question) => question.theme === filter.theme)
          .map((question) => question.id),
      )
    : null;
  const filteredResponses = themeQuestionIds
    ? responses.filter((response) =>
        hasAnswerForQuestionTheme(response.answers, themeQuestionIds),
      )
    : responses;
  const responseRows = filteredResponses.map((response) => ({
    id: response.id,
    editionId: response.editionId,
    workspaceId: response.workspaceId,
    workspaceName: response.workspace.name,
    responderId: response.profileId,
    responderEmail: response.profile.email,
    responderName: response.profile.name,
    isPrimary: response.isPrimary,
    createdAt: response.createdAt,
    answers: response.answers,
    workspaceStatus: statusByWorkspace.get(response.workspaceId) ?? "pending",
  }));
  if (filter.from || filter.to || filter.theme) return responseRows;

  const responseWorkspaceIds = new Set(filteredResponses.map((response) => response.workspaceId));
  const pendingRows = enrollments
    .filter((enrollment) => !responseWorkspaceIds.has(enrollment.workspaceId))
    .map((enrollment) => ({
      id: `pending:${filter.editionId}:${enrollment.workspaceId}`,
      editionId: filter.editionId,
      workspaceId: enrollment.workspaceId,
      workspaceName: enrollment.workspace.name,
      responderId: enrollment.owner.id,
      responderEmail: enrollment.owner.email,
      responderName: enrollment.owner.name,
      isPrimary: false,
      createdAt: null,
      answers: {},
      workspaceStatus: statusByWorkspace.get(enrollment.workspaceId) ?? "pending",
    }));

  return [...responseRows, ...pendingRows];
}

export async function getCheckinResponseDetail(
  editionId: string,
  workspaceId: string,
): Promise<CheckinResponseRow | null> {
  await getEditionQuestions(editionId);
  const response = await prisma.closedBetaCheckinResponse.findFirst({
    where: { editionId, workspaceId, isCurrent: true },
    include: {
      workspace: { select: { id: true, name: true, slug: true } },
      profile: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!response) return null;
  const state = await prisma.closedBetaCheckinWorkspaceState.findUnique({
    where: { editionId_workspaceId: { editionId, workspaceId } },
    select: { status: true },
  });
  return {
    id: response.id,
    editionId: response.editionId,
    workspaceId: response.workspaceId,
    workspaceName: response.workspace.name,
    responderId: response.profileId,
    responderEmail: response.profile.email,
    responderName: response.profile.name,
    isPrimary: response.isPrimary,
    createdAt: response.createdAt,
    answers: response.answers,
    workspaceStatus: state?.status ?? "pending",
  };
}

export async function getCheckinResponseGrouping(
  editionId: string,
): Promise<CheckinGroupedQuestion[]> {
  const edition = await getEditionQuestions(editionId);
  const responses = await prisma.closedBetaCheckinResponse.findMany({
    where: { editionId, isCurrent: true },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return edition.questions.map((question) => {
    const entries: Array<{ workspaceId: string; workspaceName: string; value: unknown }> = [];
    for (const response of responses) {
      const answers = response.answers as Record<string, unknown> | null;
      const value = answers?.[question.id];
      if (value === undefined) continue;
      entries.push({
        workspaceId: response.workspaceId,
        workspaceName: response.workspace.name,
        value,
      });
    }
    return {
      questionId: question.id,
      text: question.text,
      type: question.type,
      theme: question.theme,
      options: Array.isArray(question.options)
        ? question.options.filter((option): option is string => typeof option === "string")
        : null,
      responses: entries,
    };
  });
}

export async function getCheckinEditionMetrics(
  editionId: string,
): Promise<CheckinEditionMetrics> {
  await expireCheckinExemptions();
  const edition = await getEditionQuestions(editionId);
  const [states, enrollments, primaryResponses] = await Promise.all([
    prisma.closedBetaCheckinWorkspaceState.findMany({
      where: { editionId },
      select: { status: true },
    }),
    prisma.closedBetaEnrollment.count({ where: { status: "active" } }),
    prisma.closedBetaCheckinResponse.findMany({
      where: { editionId, isPrimary: true, isCurrent: true },
      select: { createdAt: true },
    }),
  ]);

  let totalWorkspaces = enrollments;
  const stateCounts = states.reduce<Record<string, number>>((acc, state) => {
    acc[state.status] = (acc[state.status] ?? 0) + 1;
    return acc;
  }, {});
  const completed = stateCounts["completed"] ?? 0;
  const exempt = stateCounts["exempt"] ?? 0;
  if (totalWorkspaces === 0) totalWorkspaces = states.length;
  const pending = Math.max(totalWorkspaces - completed - exempt, 0);

  const completionRate = totalWorkspaces > 0 ? Math.round((completed / totalWorkspaces) * 1000) / 10 : null;

  let averageResponseSeconds: number | null = null;
  if (primaryResponses.length > 0) {
    const totalSeconds = primaryResponses.reduce(
      (sum, response) =>
        sum + Math.max(0, response.createdAt.getTime() - edition.createdAt.getTime()) / 1000,
      0,
    );
    averageResponseSeconds = Math.round((totalSeconds / primaryResponses.length) * 10) / 10;
  }

  return {
    editionId,
    totalWorkspaces,
    completed,
    pending,
    exempt,
    completionRate,
    averageResponseSeconds,
  };
}

export interface CheckinExportRow {
  workspaceName: string;
  responderEmail: string;
  submittedAt: string;
  questionText: string;
  questionType: string;
  theme: string | null;
  answer: string;
}

export async function exportCheckinResponses(editionId: string): Promise<CheckinExportRow[]> {
  const edition = await getEditionQuestions(editionId);
  const responses = await prisma.closedBetaCheckinResponse.findMany({
    where: { editionId },
    include: {
      workspace: { select: { name: true } },
      profile: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const rows: CheckinExportRow[] = [];
  for (const response of responses) {
    const answers = response.answers as Record<string, unknown> | null;
    for (const question of edition.questions) {
      const value = answers?.[question.id];
      const answer = Array.isArray(value) ? value.join(", ") : value === null || value === undefined ? "" : String(value);
      rows.push({
        workspaceName: response.workspace.name,
        responderEmail: response.profile.email,
        submittedAt: response.createdAt.toISOString(),
        questionText: question.text,
        questionType: question.type,
        theme: question.theme,
        answer,
      });
    }
  }
  return rows;
}
