"use client";

import { useRouter } from "next/navigation";

export default function SettingsPage() {
  return (
    <div data-testid="settings-page" className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-heading-1 text-text-primary">Settings</h1>
        <p className="text-body-small text-text-secondary mt-1">
          Manage your profile, team areas, and preferences.
        </p>
      </div>

      <div className="grid gap-4">
        <SettingsCard
          title="Profile"
          description="Manage your name, avatar, and team area assignments"
          href="/settings/profile"
        />
        <SettingsCard
          title="Team Areas"
          description="Create, edit, and delete team areas used to organize projects and tasks"
          href="/settings/areas"
        />
        <SettingsCard
          title="Team"
          description="View and manage team members and their area assignments"
          href="/settings/team"
        />
      </div>
    </div>
  );
}

function SettingsCard({ title, description, href }: { title: string; description: string; href: string }) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(href)}
      className="cursor-pointer rounded-xl border border-border bg-page-alt p-5 shadow-card transition-[transform,box-shadow,border-color] hover:border-accent hover:shadow-elevated motion-safe:hover:-translate-y-0.5"
    >
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="text-sm text-text-secondary mt-1">{description}</p>
    </div>
  );
}
