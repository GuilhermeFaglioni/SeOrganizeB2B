import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return globalForPrisma.prisma ?? new PrismaClient();
}

export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = new PrismaClient();
      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = globalForPrisma.prisma;
      }
    }
    const client = globalForPrisma.prisma;
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
