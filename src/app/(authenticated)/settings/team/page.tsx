"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAreas } from "@/hooks/use-areas";
import { useAssignRole, useRemoveMember, useRoles, useTeam } from "@/hooks/use-roles";
import { useInvites, useCreateInvite, useCancelInvite } from "@/hooks/use-invites";
import { useCan } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Mail, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  SettingsBackLink,
  SettingsHeader,
  SettingsSection,
  SettingsShell,
} from "@/components/settings/settings-shell";

const NO_ROLE_VALUE = "none";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export default function TeamPage() {
  const t = useTranslations("settings.team");
  const { can, data: permData } = useCan();
  const { data: areas } = useAreas();
  const { data: team } = useTeam();
  const { data: roles } = useRoles();
  const { data: invites } = useInvites();
  const createInvite = useCreateInvite();
  const cancelInvite = useCancelInvite();
  const assignRole = useAssignRole();
  const removeMember = useRemoveMember();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editMap, setEditMap] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("none");
  const [limitMap, setLimitMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!team) return;
    const map: Record<string, string[]> = {};
    for (const p of team) {
      map[p.id] = p.teamMemberAreas.map((m) => m.areaId);
    }
    setEditMap(map);
    setLimitMap(Object.fromEntries(team.map((p) => [p.id, p.monthlyCreditLimit === null ? "" : String(p.monthlyCreditLimit)])));
  }, [team]);

  if (permData && !can("manage_roles")) {
    return (
      <SettingsShell testId="team-page">
        <SettingsBackLink label={t("backToSettings")} />
        <SettingsSection>
          <p className="text-sm text-text-secondary">{t("noPermission")}</p>
        </SettingsSection>
      </SettingsShell>
    );
  }

  // Solo provider: only the owner exists and no invites sent yet
  const isSolo = (team?.length ?? 0) <= 1 && (invites?.length ?? 0) === 0;
  const hasTeam = (team?.length ?? 0) > 1 || (invites?.length ?? 0) > 0;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    createInvite.mutate(
      {
        email: inviteEmail.trim(),
        roleId: inviteRoleId === "none" ? null : inviteRoleId,
      },
      {
        onSuccess: () => {
          setInviteEmail("");
          setInviteRoleId("none");
          toastSuccess(t("inviteSuccess"));
        },
      }
    );
  };

  const handleCancelInvite = (inviteId: string) => {
    cancelInvite.mutate(inviteId, {
      onSuccess: () => toastSuccess(t("inviteCancelled")),
      onError: () => toastError(t("cancelFailed")),
    });
  };

  const toggleArea = (profileId: string, areaId: string) => {
    setEditMap((prev) => {
      const current = prev[profileId] || [];
      return {
        ...prev,
        [profileId]: current.includes(areaId)
          ? current.filter((id) => id !== areaId)
          : [...current, areaId],
      };
    });
  };

  const handleSave = async (profileId: string) => {
    setSaving(true);
    setMessage("");
    try {
      await fetchJson(`/api/profiles/${profileId}/areas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaIds: editMap[profileId] || [] }),
      });
      setIsSuccess(true);
      setMessage(t("saveSuccess"));
    } catch (err) {
      setIsSuccess(false);
      setMessage(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = (profileId: string, roleId: string) => {
    assignRole.mutate(
      {
        userId: profileId,
        roleId: roleId === NO_ROLE_VALUE ? null : roleId,
      },
      { onSuccess: () => toastSuccess(t("roleSaved")) }
    );
  };

  const handleLimitSave = async (profileId: string) => {
    const raw = limitMap[profileId] ?? "";
    const monthlyLimit = raw.trim() === "" ? null : Number(raw);
    if (monthlyLimit !== null && (!Number.isSafeInteger(monthlyLimit) || monthlyLimit < 0)) {
      toastError(t("limitInvalid"));
      return;
    }
    await fetchJson(`/api/profiles/${profileId}/ai-credit-limit`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ monthlyLimit }) });
    toastSuccess(t("limitSaved"));
  };

  const handleRemoveMember = (profileId: string) => {
    if (!window.confirm(t("removeConfirm"))) return;
    removeMember.mutate(profileId);
  };

  return (
    <SettingsShell testId="team-page">
      <SettingsBackLink label={t("backToSettings")} />
      <SettingsHeader title={t("title")} description={t("subtitle")} />

      {/* Invite form — always visible, one-step: email only */}
      <SettingsSection>
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 space-y-1">
            <label htmlFor="invite-email" className="text-sm text-text-secondary">
              {t("inviteTitle")}
            </label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t("inviteEmailPlaceholder")}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <p className="text-xs text-text-muted">{t("inviteHint")}</p>
          </div>
          <div className="min-w-44 space-y-1">
            <label htmlFor="invite-role" className="text-sm text-text-secondary">
              {t("inviteRole")}
            </label>
            <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("inviteRoleDefault")}</SelectItem>
                {roles?.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={createInvite.isPending}>
            <Mail size={16} aria-hidden="true" className="mr-1.5" />
            {createInvite.isPending ? t("inviteSending") : t("inviteButton")}
          </Button>
        </form>
      </SettingsSection>

      {/* Pending invites */}
      {invites && invites.length > 0 && (
        <SettingsSection>
          <h3 className="text-sm font-semibold text-text-primary mb-2">
            {t("pendingInvites")}
          </h3>
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-page-alt p-3"
              >
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <Mail size={14} className="text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary truncate">{invite.email}</p>
                  <p className="text-xs text-text-muted">
                    {invite.roleId
                      ? roles?.find((r) => r.id === invite.roleId)?.name ?? ""
                      : ""}
                  </p>
                </div>
                <span className="rounded bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary">
                  {invite.status === "expired"
                    ? t("inviteExpired")
                    : t("invitePending")}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t("cancelInvite")}
                  onClick={() => handleCancelInvite(invite.id)}
                  disabled={cancelInvite.isPending}
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </SettingsSection>
      )}

      {/* Solo provider: show hint instead of role management */}
      {isSolo && (
        <SettingsSection>
          <div className="rounded-xl border border-dashed border-border bg-page-alt p-6 text-center">
            <ShieldCheck size={32} className="mx-auto text-text-muted mb-2" />
            <p className="text-sm font-medium text-text-primary">
              {t("rolesHiddenTitle")}
            </p>
            <p className="mt-1 text-xs text-text-muted">{t("soloHint")}</p>
          </div>
        </SettingsSection>
      )}

      {/* Team members list — only show role/area management when team exists */}
      {hasTeam && (
        <SettingsSection>
          <div className="space-y-3">
            {team?.map((profile) => (
              <div
                key={profile.id}
                className="bg-page-alt border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedId(expandedId === profile.id ? null : profile.id)
                  }
                  className="w-full flex items-center justify-between p-4 hover:bg-bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                      <Users size={16} className="text-accent" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-text-primary">
                        {profile.name || t("unnamed")}
                      </p>
                      <p className="text-xs text-text-secondary">{profile.email}</p>
                    </div>
                    {profile.role && (
                      <span className="ml-2 rounded bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary">
                        {profile.role.name}
                      </span>
                    )}
                  </div>
                  {expandedId === profile.id ? (
                    <ChevronDown size={18} className="text-text-secondary" />
                  ) : (
                    <ChevronRight size={18} className="text-text-secondary" />
                  )}
                </button>

                {expandedId === profile.id && (
                  <div className="border-t border-border p-4 space-y-4">
                    <div className="space-y-2">
                      <label htmlFor={`credit-limit-${profile.id}`} className="text-sm text-text-secondary">{t("creditLimitLabel")}</label>
                      <div className="flex gap-2">
                        <Input id={`credit-limit-${profile.id}`} type="number" min="0" step="1" value={limitMap[profile.id] ?? ""} onChange={(e) => setLimitMap((prev) => ({ ...prev, [profile.id]: e.target.value }))} placeholder={t("creditLimitUnlimited")} className="sm:w-72" />
                        <Button size="sm" variant="outline" onClick={() => void handleLimitSave(profile.id)}>{t("save")}</Button>
                      </div>
                      <p className="text-xs text-text-muted">{t("creditLimitHint")}</p>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor={`role-${profile.id}`}
                        className="text-sm text-text-secondary"
                      >
                        {t("roleLabel")}
                      </label>
                      <Select
                        value={profile.role?.id ?? NO_ROLE_VALUE}
                        onValueChange={(value) =>
                          handleRoleChange(profile.id, value)
                        }
                      >
                        <SelectTrigger id={`role-${profile.id}`} className="sm:w-72">
                          <SelectValue placeholder={t("noRole")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_ROLE_VALUE}>{t("noRole")}</SelectItem>
                          {roles?.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-text-secondary">
                        {t("assignLabel")}
                      </p>
                      {areas && areas.length > 0 ? (
                        <div className="space-y-2">
                          {areas.map(
                            (area: {
                              id: string;
                              name: string;
                              color: string;
                            }) => (
                              <label
                                key={area.id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-secondary cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={(editMap[profile.id] || []).includes(
                                    area.id
                                  )}
                                  onChange={() =>
                                    toggleArea(profile.id, area.id)
                                  }
                                  className="w-4 h-4 rounded border-border text-accent"
                                />
                                <span
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: area?.color }}
                                />
                                <span className="text-sm text-text-primary">
                                  {area.name}
                                </span>
                              </label>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-text-secondary">
                          {t("noAreas")}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSave(profile.id)}
                      disabled={saving}
                    >
                      {saving ? t("saving") : t("save")}
                    </Button>
                    {!profile.isOwner && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveMember(profile.id)}
                        disabled={removeMember.isPending}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        {t("removeMember")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {message && (
            <p
              className={`text-sm ${isSuccess ? "text-success" : "text-danger"}`}
            >
              {message}
            </p>
          )}
        </SettingsSection>
      )}
    </SettingsShell>
  );
}
