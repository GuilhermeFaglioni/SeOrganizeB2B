import { Prisma } from "@prisma/client";
import { prisma } from "../../../prisma/client";
import { CheckinNotFoundError } from "./checkin";

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
  createdAt: Date;
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

export async function listCheckinResponses(
  filter: CheckinResponsesFilter,
): Promise<CheckinResponseRow[]> {
  await getEditionQuestions(filter.editionId);
  const responses = await prisma.closedBetaCheckinResponse.findMany({
    where: {
      editionId: filter.editionId,
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
  });
  const states = await prisma.closedBetaCheckinWorkspaceState.findMany({
    where: { editionId: filter.editionId },
    select: { workspaceId: true, status: true },
  });
  const statusByWorkspace = new Map(states.map((state) => [state.workspaceId, state.status]));
  return responses.map((response) => ({
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
}

export async function getCheckinResponseDetail(
  editionId: string,
  workspaceId: string,
): Promise<CheckinResponseRow | null> {
  await getEditionQuestions(editionId);
  const response = await prisma.closedBetaCheckinResponse.findFirst({
    where: { editionId, workspaceId },
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
    where: { editionId },
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
  await getEditionQuestions(editionId);
  const [states, enrollments] = await Promise.all([
    prisma.closedBetaCheckinWorkspaceState.findMany({
      where: { editionId },
      select: { status: true, completedAt: true, createdAt: true },
    }),
    prisma.closedBetaEnrollment.count({ where: { status: "active" } }),
  ]);

  let totalWorkspaces = enrollments;
  const stateCounts = states.reduce<Record<string, number>>((acc, state) => {
    acc[state.status] = (acc[state.status] ?? 0) + 1;
    return acc;
  }, {});
  const completed = stateCounts["completed"] ?? 0;
  const pending = stateCounts["pending"] ?? 0;
  const exempt = stateCounts["exempt"] ?? 0;
  if (totalWorkspaces === 0) totalWorkspaces = states.length;

  const completionRate = totalWorkspaces > 0 ? Math.round((completed / totalWorkspaces) * 1000) / 10 : null;

  let averageResponseSeconds: number | null = null;
  const completedStates = states.filter((state) => state.status === "completed" && state.completedAt && state.createdAt);
  if (completedStates.length > 0) {
    const totalSeconds = completedStates.reduce(
      (sum, state) => sum + Math.max(0, state.completedAt!.getTime() - state.createdAt.getTime()) / 1000,
      0,
    );
    averageResponseSeconds = Math.round((totalSeconds / completedStates.length) * 10) / 10;
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
