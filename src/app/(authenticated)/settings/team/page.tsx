"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAreas } from "@/hooks/use-areas";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Users } from "lucide-react";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

interface ProfileWithAreas {
  id: string;
  name: string | null;
  email: string;
  teamMemberAreas: { areaId: string; area: { id: string; name: string; color: string } }[];
}

export default function TeamPage() {
  const router = useRouter();
  const { data: areas } = useAreas();
  const [profiles, setProfiles] = useState<ProfileWithAreas[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editMap, setEditMap] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchJson<ProfileWithAreas[]>("/api/profiles").then((data) => {
      setProfiles(data || []);
      const map: Record<string, string[]> = {};
      for (const p of data || []) {
        map[p.id] = p.teamMemberAreas.map((m) => m.areaId);
      }
      setEditMap(map);
    });
  }, []);

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
      setMessage("Updated successfully");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="team-page" className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/settings")} className="text-sm text-text-secondary hover:text-text-primary">
          &larr; Back to Settings
        </button>
      </div>

      <div>
        <h1 className="text-heading-1 text-text-primary">Team</h1>
        <p className="text-body-small text-text-secondary mt-1">
          Manage team members and their area assignments.
        </p>
      </div>

      <div className="space-y-3">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="bg-white border border-border rounded-xl overflow-hidden"
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
                    {profile.name || "Unnamed"}
                  </p>
                  <p className="text-xs text-text-secondary">{profile.email}</p>
                </div>
              </div>
              {expandedId === profile.id ? <ChevronDown size={18} className="text-text-secondary" /> : <ChevronRight size={18} className="text-text-secondary" />}
            </button>

            {expandedId === profile.id && (
              <div className="border-t border-border p-4 space-y-3">
                <p className="text-sm text-text-secondary">Assign team areas:</p>
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
                          style={{ backgroundColor: area.color }}
                        />
                        <span className="text-sm text-text-primary">{area.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">No areas configured.</p>
                )}
                <Button size="sm" onClick={() => handleSave(profile.id)} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {message && (
        <p className={`text-sm ${message.includes("success") ? "text-success" : "text-danger"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
