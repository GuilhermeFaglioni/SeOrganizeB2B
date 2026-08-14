export type WorkspaceOnboardingState =
  | { status: "ready" }
  | { status: "workspace_creation_required" }
  | { status: "binding_required"; reason: "pending_invite" | "expired_invite" }
  | { status: "binding_setup_required" };
