import { PrismaClient } from "@prisma/client";
import { tenantFilter } from "./middleware/tenant-filter";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const TENANT_FILTER_INSTALLED = Symbol.for(
  "seorganize.prisma.tenantFilterInstalled"
);

function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL!;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}pgbouncer=true&connection_limit=1&pool_timeout=10`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: getDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (!(prisma as unknown as Record<symbol, boolean>)[TENANT_FILTER_INSTALLED]) {
  prisma.$use(tenantFilter);
  (prisma as unknown as Record<symbol, boolean>)[TENANT_FILTER_INSTALLED] = true;
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export {
  TENANT_CONTEXT_REQUIRED,
  TenantContextRequiredError,
  tenantFilter,
  withTenant,
  withTenantBypass,
} from "./middleware/tenant-filter";
