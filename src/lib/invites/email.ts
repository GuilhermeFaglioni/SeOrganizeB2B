export interface InviteEmailContext {
  id: string;
  email: string;
  token: string;
  expiresAt: Date;
}

export interface InviteWorkspaceContext {
  id: string;
  name: string;
}

/**
 * Placeholder email sender for workspace invitations.
 *
 * There is no email provider wired up yet — this stub logs the invite and
 * resolves so the flow is testable end to end. Swap the body for a real
 * provider (e.g. Resend / Supabase Auth invite) without changing callers.
 */
export async function sendInviteEmail(
  invite: InviteEmailContext,
  workspace: InviteWorkspaceContext
): Promise<void> {
  console.info(
    `[invites] invite email to ${invite.email} for workspace "${workspace.name}" ` +
      `(invite ${invite.id}, token ${invite.token}, expires ${invite.expiresAt.toISOString()})`
  );
}