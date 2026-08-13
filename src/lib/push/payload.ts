import type { PushPayload } from "./send";

interface NotificationContext {
  activityType: string;
  summary: string;
  actorName: string;
  entityType: string;
  entityId: string;
}

export function buildPushPayload(ctx: NotificationContext): PushPayload | null {
  const { activityType, summary, actorName, entityType, entityId } = ctx;

  switch (activityType) {
    case "task.created":
      return {
        title: "Nova tarefa atribuída",
        body: `${actorName} criou uma tarefa para você: ${summary.replace(/criou a tarefa "?/, "").replace(/"$/, "")}`,
        url: `/board`,
        tag: `task-created-${entityId}`,
      };

    case "task.assigned":
      return {
        title: "Você foi atribuído a uma tarefa",
        body: `${actorName} ${summary.replace(/^Atualizou responsáveis de "?/, "").replace(/"$/, "")}`,
        url: `/board`,
        tag: `task-assigned-${entityId}`,
      };

    case "comment.mentioned":
      return {
        title: "Você foi mencionado",
        body: `${actorName} mencionou você em um comentário`,
        url: `/board`,
        tag: `comment-mentioned-${entityId}`,
      };

    case "calendar.scheduled":
      return {
        title: "Reunião agendada",
        body: `${actorName} agendou um evento para você`,
        url: `/calendar`,
        tag: `calendar-scheduled-${entityId}`,
      };

    case "calendar.updated":
      return {
        title: "Evento atualizado",
        body: `${actorName} atualizou um evento`,
        url: `/calendar`,
        tag: `calendar-updated-${entityId}`,
      };

    case "task.moved":
      return {
        title: "Tarefa movida",
        body: summary,
        url: `/board`,
        tag: `task-moved-${entityId}`,
      };

    case "task.archived":
      return {
        title: "Tarefa arquivada",
        body: summary,
        url: `/board`,
        tag: `task-archived-${entityId}`,
      };

    case "proposal.viewed":
      return {
        title: "Proposta visualizada",
        body: summary,
        url: `/financial/proposals`,
        tag: `proposal-viewed-${entityId}`,
      };

    case "proposal.accepted":
      return {
        title: "Proposta aceita!",
        body: summary,
        url: `/financial/proposals`,
        tag: `proposal-accepted-${entityId}`,
      };

    case "proposal.rejected":
      return {
        title: "Proposta recusada",
        body: summary,
        url: `/financial/proposals`,
        tag: `proposal-rejected-${entityId}`,
      };

    case "installment.due_tomorrow":
      return {
        title: "Parcela vence amanhã",
        body: summary,
        url: `/financial/receivables`,
        tag: `installment-due-${entityId}`,
      };

    case "installment.overdue":
      return {
        title: "Parcela vencida",
        body: summary,
        url: `/financial/receivables`,
        tag: `installment-overdue-${entityId}`,
      };

    default:
      return {
        title: "SeOrganize+",
        body: summary,
        url: "/",
        tag: `notification-${entityType}-${entityId}`,
      };
  }
}
