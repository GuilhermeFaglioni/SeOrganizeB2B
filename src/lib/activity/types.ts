import type { Prisma } from "@prisma/client";

export interface RecordActivityInput {
  actorId?: string | null;
  taskId?: string | null;
  type: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
  notifyProfileIds?: string[];
  tenantId?: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata: unknown;
  taskId: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
}

export interface NotificationItem {
  id: string;
  readAt: string | null;
  createdAt: string;
  activity: ActivityItem;
}
