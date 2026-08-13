import { PrismaClient } from "@prisma/client";
import { tenantFilter } from "./middleware/tenant-filter";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const TENANT_FILTER_INSTALLED = Symbol.for(
  "seorganize.prisma.tenantFilterInstalled"
);

function appendPgbouncer(baseUrl: string): string {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}pgbouncer=true`;
}

function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Add it to your environment to connect to the database."
    );
  }
  return `${appendPgbouncer(baseUrl)}&connection_limit=1&pool_timeout=10`;
}

function getDirectUrl(): string {
  // PgBouncer transaction mode (Supabase transaction pooler, port 6543) does
  // not support prepared statements. Prisma needs `pgbouncer=true` on the
  // directUrl too, otherwise `$queryRaw`/`$executeRaw` would fail when the
  // connection points at the transaction pooler.
  const baseUrl = process.env.DIRECT_URL;
  return baseUrl ? appendPgbouncer(baseUrl) : "";
}

function createPrismaClient(): PrismaClient {
  const directUrl = getDirectUrl();
  return new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
        ...(directUrl ? { directUrl } : {}),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

let prismaClient: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = globalForPrisma.prisma ?? createPrismaClient();
    if (
      !(prismaClient as unknown as Record<symbol, boolean>)[
        TENANT_FILTER_INSTALLED
      ]
    ) {
      prismaClient.$use(tenantFilter);
      (prismaClient as unknown as Record<symbol, boolean>)[
        TENANT_FILTER_INSTALLED
      ] = true;
    }
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prismaClient;
    }
  }
  return prismaClient;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export {
  TENANT_CONTEXT_REQUIRED,
  TenantContextRequiredError,
  getTenantId,
  requireTenantId,
  tenantFilter,
  withTenant,
  withTenantBypass,
} from "./middleware/tenant-filter";
