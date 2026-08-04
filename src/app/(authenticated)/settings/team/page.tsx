"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAreas } from "@/hooks/use-areas";
import { useAssignRole, useRoles, useTeam } from "@/hooks/use-roles";
import { useCan } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { toastSuccess } from "@/lib/toast";
import {
  SettingsBackLink,
  SettingsHeader,
  SettingsSection,
  SettingsShell,
} from "@/components/settings/settings-shell";

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
  const assignRole = useAssignRole();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editMap, setEditMap] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!team) return;
    const map: Record<string, string[]> = {};
    for (const p of team) {
      map[p.id] = p.teamMemberAreas.map((m) => m.areaId);
    }
    setEditMap(map);
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
      { userId: profileId, roleId: roleId || null },
      { onSuccess: () => toastSuccess(t("roleSaved")) }
    );
  };

  return (
    <SettingsShell testId="team-page">
      <SettingsBackLink label={t("backToSettings")} />
      <SettingsHeader title={t("title")} description={t("subtitle")} />

      <SettingsSection>
        <div className="space-y-3">
        {team?.map((profile) => (
          <div
            key={profile.id}
            className="bg-page-alt border border-border rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setExpandedId(expandedId === profile.id ? null : profile.id)}
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
              {expandedId === profile.id ? <ChevronDown size={18} className="text-text-secondary" /> : <ChevronRight size={18} className="text-text-secondary" />}
            </button>

            {expandedId === profile.id && (
              <div className="border-t border-border p-4 space-y-4">
                <div className="space-y-2">
                  <label htmlFor={`role-${profile.id}`} className="text-sm text-text-secondary">
                    {t("roleLabel")}
                  </label>
                  <select
                    id={`role-${profile.id}`}
                    value={profile.role?.id ?? ""}
                    onChange={(event) => handleRoleChange(profile.id, event.target.value)}
                    className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:w-72"
                  >
                    <option value="">{t("noRole")}</option>
                    {roles?.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-text-secondary">{t("assignLabel")}</p>
                  {areas && areas.length > 0 ? (
                    <div className="space-y-2">
                      {areas.map((area: { id: string; name: string; color: string }) => (
                        <label
                          key={area.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-secondary cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={(editMap[profile.id] || []).includes(area.id)}
                            onChange={() => toggleArea(profile.id, area.id)}
                            className="w-4 h-4 rounded border-border text-accent"
                          />
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: area?.color }}
                          />
                          <span className="text-sm text-text-primary">{area.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">{t("noAreas")}</p>
                  )}
                </div>
                <Button size="sm" onClick={() => handleSave(profile.id)} disabled={saving}>
                  {saving ? t("saving") : t("save")}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {message && (
        <p className={`text-sm ${isSuccess ? "text-success" : "text-danger"}`}>
          {message}
        </p>
      )}
      </SettingsSection>
    </SettingsShell>
  );
}
