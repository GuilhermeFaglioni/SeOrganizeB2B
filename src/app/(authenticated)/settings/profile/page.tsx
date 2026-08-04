"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/stores/auth-context";
import { useAreas } from "@/hooks/use-areas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  SettingsBackLink,
  SettingsHeader,
  SettingsSection,
  SettingsShell,
} from "@/components/settings/settings-shell";

export default function ProfilePage() {
  const t = useTranslations("settings.profile");
  const { user, updateUserName } = useAuth();
  const { data: areas } = useAreas();
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (user) {
      setName(user?.user_metadata?.full_name || user?.email?.split("@")[0] || "");
    }
  }, [user]);

  useEffect(() => {
    fetch("/api/profile/areas")
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          setSelectedAreaIds(res.data.map((m: { areaId: string }) => m.areaId));
        }
      })
      .catch(() => {});
  }, []);

  const toggleArea = (areaId: string) => {
    setSelectedAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaIds: selectedAreaIds }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      toastSuccess(t("areasUpdated"));
    } catch (err) {
      toastError(
        t("areasUpdateError"),
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell testId="profile-page">
      <SettingsBackLink label={t("backToSettings")} />
      <SettingsHeader title={t("title")} description={t("subtitle")} />

      <SettingsSection>
        <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-label text-text-secondary">{t("emailLabel")}</label>
          <Input value={user?.email || ""} disabled />
        </div>

        <div className="space-y-2">
          <label className="text-label text-text-secondary">{t("nameLabel")}</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
          />
        </div>

        <Button onClick={async () => {
          setSaving(true);
          try {
            const res = await fetch("/api/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            updateUserName(data.data.name);
            toastSuccess(t("nameUpdated"));
          } catch (err) {
            toastError(
              t("nameUpdateError"),
              err instanceof Error ? err.message : undefined,
            );
          } finally {
            setSaving(false);
          }
        }} disabled={saving || !name.trim()}>
          {saving ? t("saving") : t("saveName")}
        </Button>
        </div>
      </SettingsSection>

      <SettingsSection title={t("areasTitle")} description={t("areasDescription")}>
        <div className="space-y-4">
        {areas && areas.length > 0 ? (
          <div className="space-y-2">
            {areas.map((area: { id: string; name: string; color: string }) => (
              <label
                key={area.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-bg-secondary cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedAreaIds.includes(area.id)}
                  onChange={() => toggleArea(area.id)}
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

        <Button onClick={handleSave} disabled={saving}>
          {saving ? t("saving") : t("save")}
        </Button>
        </div>
      </SettingsSection>
    </SettingsShell>
  );
}
