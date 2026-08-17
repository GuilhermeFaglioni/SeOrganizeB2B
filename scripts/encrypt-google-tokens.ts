import { prisma, withTenantBypass } from "../prisma/client";
import {
  encryptGoogleToken,
  isEncryptedGoogleToken,
} from "../src/lib/google/token-crypto";

async function main() {
  const auths = await withTenantBypass(() =>
    prisma.calendarAuth.findMany({
      select: { id: true, accessToken: true, refreshToken: true },
    }),
  );
  let migrated = 0;

  for (const auth of auths) {
    if (!auth.accessToken && !auth.refreshToken) {
      continue;
    }
    if (!auth.accessToken || !auth.refreshToken) {
      throw new Error(`Calendar authorization ${auth.id} has incomplete tokens`);
    }
    const accessToken = isEncryptedGoogleToken(auth.accessToken)
      ? auth.accessToken
      : encryptGoogleToken(auth.accessToken);
    const refreshToken = isEncryptedGoogleToken(auth.refreshToken)
      ? auth.refreshToken
      : encryptGoogleToken(auth.refreshToken);
    if (accessToken === auth.accessToken && refreshToken === auth.refreshToken) {
      continue;
    }

    await withTenantBypass(() =>
      prisma.calendarAuth.update({
        where: { id: auth.id },
        data: { accessToken, refreshToken },
      }),
    );
    migrated += 1;
  }

  console.log(`Encrypted ${migrated} Calendar authorization record(s).`);
}

main().catch((error) => {
  console.error("Google token migration failed", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
