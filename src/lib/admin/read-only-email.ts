export interface ReadOnlyAccessEmailContext {
  token: string;
  expiresAt: Date;
  workspaceName: string;
}

/**
 * Placeholder email sender for read-only tenant access links.
 *
 * There is no email provider wired up yet — this stub logs the access link and
 * resolves so the flow is testable end to end. Swap the body for a real
 * provider (e.g. Resend / Supabase Auth) without changing callers.
 */
export async function sendReadOnlyAccessEmail(
  email: string,
  access: ReadOnlyAccessEmailContext
): Promise<void> {
  console.info(
    `[read-only] access link to ${email} for workspace "${access.workspaceName}" ` +
      `(token ${access.token}, expires ${access.expiresAt.toISOString()})`
  );
}
