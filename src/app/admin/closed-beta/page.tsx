"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Gauge, Mail, RefreshCw, ShieldCheck, Users, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useClosedBeta,
  useUpdateClosedBeta,
  type ClosedBetaStatus,
} from "@/hooks/use-closed-beta";
import {
  useClosedBetaInvitations,
  useCreateClosedBetaInvitation,
  useReissueClosedBetaInvitation,
  useRevokeClosedBetaInvitation,
} from "@/hooks/use-closed-beta-invitations";
import {
  useClosedBetaAudit,
  useClosedBetaWorkspaceCandidates,
  useClosedBetaWorkspaces,
  useEnrollClosedBetaWorkspace,
  useRemoveClosedBetaWorkspace,
} from "@/hooks/use-closed-beta-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";

function statusVariant(status: ClosedBetaStatus) {
  if (status === "active") return "success" as const;
  if (status === "paused") return "warning" as const;
  return "destructive" as const;
}

export default function ClosedBetaPage() {
  const t = useTranslations("admin.pages.closedBeta");
  const { data, isLoading, isError } = useClosedBeta();
  const update = useUpdateClosedBeta();
  const invitations = useClosedBetaInvitations();
  const createInvitation = useCreateClosedBetaInvitation();
  const revokeInvitation = useRevokeClosedBetaInvitation();
  const reissueInvitation = useReissueClosedBetaInvitation();
  const workspaces = useClosedBetaWorkspaces();
  const candidates = useClosedBetaWorkspaceCandidates();
  const audit = useClosedBetaAudit();
  const enrollWorkspace = useEnrollClosedBetaWorkspace();
  const removeWorkspace = useRemoveClosedBetaWorkspace();
  const [status, setStatus] = useState<ClosedBetaStatus>("paused");
  const [maxPrimary, setMaxPrimary] = useState("30");
  const [maxGuests, setMaxGuests] = useState("3");
  const [inviteEmail, setInviteEmail] = useState("");
  const [latestInviteLink, setLatestInviteLink] = useState<string | null>(null);
  const [candidateWorkspaceId, setCandidateWorkspaceId] = useState("");
  const [candidateOwnerId, setCandidateOwnerId] = useState("");

  useEffect(() => {
    if (!data) return;
    setStatus(data.config.status);
    setMaxPrimary(String(data.config.maxPrimaryWorkspaces));
    setMaxGuests(String(data.config.maxGuestsPerWorkspace));
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6" data-testid="admin-closed-beta-page">
        <LoadingState />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6" data-testid="admin-closed-beta-page">
        <EmptyState icon={ShieldCheck} title={t("title")} description={t("loadFailed")} />
      </div>
    );
  }

  const { config, metrics } = data;

  function save() {
    const primary = Number(maxPrimary);
    const guests = Number(maxGuests);
    if (!Number.isInteger(primary) || primary < 0) return;
    if (!Number.isInteger(guests) || guests < 0) return;
    if (status === "closed" && config.status !== "closed" && !window.confirm(t("confirmClose"))) {
      return;
    }
    update.mutate({
      status,
      maxPrimaryWorkspaces: primary,
      maxGuestsPerWorkspace: guests,
    });
  }

  function createInvitationForEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    createInvitation.mutate(inviteEmail.trim(), {
      onSuccess: (invitation) => {
        setInviteEmail("");
        if (invitation.token) {
          setLatestInviteLink(
            `${window.location.origin}/closed-beta/accept?token=${encodeURIComponent(invitation.token)}`,
          );
        }
      },
    });
  }

  function copyLatestInvite() {
    if (latestInviteLink) void navigator.clipboard.writeText(latestInviteLink);
  }

  function handleReissue(id: string) {
    reissueInvitation.mutate(id, {
      onSuccess: (invitation) => {
        if (invitation.token) {
          setLatestInviteLink(
            `${window.location.origin}/closed-beta/accept?token=${encodeURIComponent(invitation.token)}`,
          );
        }
      },
    });
  }

  const selectedCandidate = candidates.data?.find((candidate) => candidate.id === candidateWorkspaceId);

  function selectCandidateWorkspace(workspaceId: string) {
    setCandidateWorkspaceId(workspaceId);
    const candidate = candidates.data?.find((item) => item.id === workspaceId);
    setCandidateOwnerId(candidate?.profiles[0]?.id ?? "");
  }

  function enrollCandidate(event: React.FormEvent) {
    event.preventDefault();
    if (!candidateWorkspaceId || !candidateOwnerId) return;
    enrollWorkspace.mutate({ workspaceId: candidateWorkspaceId, ownerProfileId: candidateOwnerId });
  }

  const cards = [
    {
      key: "active",
      icon: Users,
      label: t("activeWorkspaces"),
      value: metrics.activePrimaryWorkspaces,
    },
    {
      key: "reserved",
      icon: UserPlus,
      label: t("reservedWorkspaces"),
      value: metrics.reservedPrimaryWorkspaces,
    },
    {
      key: "available",
      icon: Gauge,
      label: t("availableWorkspaces"),
      value: metrics.availablePrimaryWorkspaces,
    },
  ];

  return (
    <div className="space-y-6 p-6" data-testid="admin-closed-beta-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-heading-1 font-semibold text-text-primary">{t("title")}</h1>
          <p className="mt-1 text-body-small text-text-secondary">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/closed-beta/checkins">{t("checkinsLink")}</Link>
          </Button>
          <Badge variant={statusVariant(config.status)}>
            {t(`status.${config.status}`)}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.key} className="rounded-xl border border-border bg-page-alt p-5 shadow-card">
              <div className="flex items-center gap-3 text-text-secondary">
                <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                <span className="text-sm">{card.label}</span>
              </div>
              <p className="mt-4 text-heading-1 font-semibold text-text-primary">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      <section className="rounded-xl border border-border bg-page-alt p-5 shadow-card">
        <div className="mb-5">
          <h2 className="text-heading-2 font-semibold text-text-primary">{t("workspacesTitle")}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t("workspacesDescription")}</p>
        </div>
        {workspaces.isLoading ? (
          <LoadingState />
        ) : workspaces.data && workspaces.data.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-page text-left text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3 font-medium">{t("workspaceName")}</th>
                  <th className="px-4 py-3 font-medium">{t("workspaceOwner")}</th>
                  <th className="px-4 py-3 font-medium">{t("workspaceGuests")}</th>
                  <th className="px-4 py-3 font-medium">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.data.map((workspace) => (
                  <tr key={workspace.workspaceId} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{workspace.workspaceName}</p>
                      <p className="text-xs text-text-muted">{workspace.workspaceSlug}</p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {workspace.owner.name || workspace.owner.email}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {workspace.activeGuests} + {workspace.pendingGuestInvites} {t("pendingShort")}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (window.confirm(t("removeWorkspaceConfirm"))) {
                            removeWorkspace.mutate(workspace.workspaceId);
                          }
                        }}
                        disabled={removeWorkspace.isPending}
                      >
                        {t("removeWorkspace")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">{t("noWorkspaces")}</p>
        )}

        {candidates.data && candidates.data.length > 0 && (
          <form onSubmit={enrollCandidate} className="mt-5 grid gap-3 rounded-lg border border-dashed border-border p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="closed-beta-candidate-workspace">{t("candidateWorkspace")}</Label>
              <select
                id="closed-beta-candidate-workspace"
                value={candidateWorkspaceId}
                onChange={(event) => selectCandidateWorkspace(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-page px-3 text-sm text-text-primary"
              >
                <option value="">{t("selectWorkspace")}</option>
                {candidates.data.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} ({candidate.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closed-beta-candidate-owner">{t("candidateOwner")}</Label>
              <select
                id="closed-beta-candidate-owner"
                value={candidateOwnerId}
                onChange={(event) => setCandidateOwnerId(event.target.value)}
                disabled={!selectedCandidate}
                className="h-10 w-full rounded-md border border-border bg-page px-3 text-sm text-text-primary"
              >
                <option value="">{t("selectOwner")}</option>
                {selectedCandidate?.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name || profile.email}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={enrollWorkspace.isPending || !candidateOwnerId}>
              {t("enrollWorkspace")}
            </Button>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-5 shadow-card">
        <div className="mb-5">
          <h2 className="text-heading-2 font-semibold text-text-primary">{t("auditTitle")}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t("auditDescription")}</p>
        </div>
        {audit.isLoading ? (
          <LoadingState />
        ) : audit.data && audit.data.length > 0 ? (
          <div className="max-h-80 overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-page text-left text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3 font-medium">{t("auditAction")}</th>
                  <th className="px-4 py-3 font-medium">{t("auditTarget")}</th>
                  <th className="px-4 py-3 font-medium">{t("auditActor")}</th>
                  <th className="px-4 py-3 font-medium">{t("auditDate")}</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.map((event) => (
                  <tr key={event.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 font-medium text-text-primary">{event.action}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {event.targetType}{event.targetId ? ` · ${event.targetId}` : ""}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{event.actorEmail || t("systemActor")}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(event.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">{t("noAudit")}</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-5 shadow-card">
        <div className="mb-5">
          <h2 className="text-heading-2 font-semibold text-text-primary">{t("invitationsTitle")}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t("invitationsDescription")}</p>
        </div>
        <form onSubmit={createInvitationForEmail} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Label htmlFor="closed-beta-invite-email">{t("inviteEmail")}</Label>
            <Input
              id="closed-beta-invite-email"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="voce@empresa.com"
              required
            />
          </div>
          <Button type="submit" disabled={createInvitation.isPending}>
            <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
            {createInvitation.isPending ? t("creatingInvitation") : t("createInvitation")}
          </Button>
        </form>
        {latestInviteLink && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
            <code className="min-w-0 flex-1 break-all text-xs text-text-secondary">{latestInviteLink}</code>
            <Button type="button" size="sm" variant="outline" onClick={copyLatestInvite}>
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("copyLink")}
            </Button>
          </div>
        )}
        <div className="mt-5">
          {invitations.isLoading ? (
            <LoadingState />
          ) : invitations.data && invitations.data.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-page text-left text-xs uppercase tracking-wide text-text-secondary">
                    <th className="px-4 py-3 font-medium">{t("inviteEmail")}</th>
                    <th className="px-4 py-3 font-medium">{t("inviteStatus")}</th>
                    <th className="px-4 py-3 font-medium">{t("inviteExpires")}</th>
                    <th className="px-4 py-3 font-medium">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.data.map((invitation) => (
                    <tr key={invitation.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3 font-medium text-text-primary">{invitation.email}</td>
                      <td className="px-4 py-3 text-text-secondary">{invitation.status}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {(invitation.status === "pending" || invitation.status === "expired") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReissue(invitation.id)}
                              disabled={reissueInvitation.isPending}
                            >
                              <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                              {t("reissue")}
                            </Button>
                          )}
                          {invitation.status === "pending" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => revokeInvitation.mutate(invitation.id)}
                              disabled={revokeInvitation.isPending}
                            >
                              {t("revoke")}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">{t("noInvitations")}</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-5 shadow-card">
        <div className="mb-5">
          <h2 className="text-heading-2 font-semibold text-text-primary">{t("settingsTitle")}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t("settingsDescription")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="closed-beta-status">{t("statusLabel")}</Label>
            <select
              id="closed-beta-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ClosedBetaStatus)}
              className="h-10 w-full rounded-md border border-border bg-page px-3 text-sm text-text-primary"
            >
              <option value="active">{t("status.active")}</option>
              <option value="paused">{t("status.paused")}</option>
              <option value="closed">{t("status.closed")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="closed-beta-primary-limit">{t("primaryLimit")}</Label>
            <Input
              id="closed-beta-primary-limit"
              type="number"
              min={0}
              step={1}
              value={maxPrimary}
              onChange={(event) => setMaxPrimary(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="closed-beta-guest-limit">{t("guestLimit")}</Label>
            <Input
              id="closed-beta-guest-limit"
              type="number"
              min={0}
              step={1}
              value={maxGuests}
              onChange={(event) => setMaxGuests(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? t("saving") : t("save")}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-5 shadow-card">
        <h2 className="text-heading-2 font-semibold text-text-primary">{t("planTitle")}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {config.plan.name} · {config.plan.allowedModules.length} {t("modules")}
        </p>
        <p className="mt-2 text-xs text-text-muted">{t("planHint")}</p>
      </section>
    </div>
  );
}
