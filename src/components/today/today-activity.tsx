import { ActivityFeed } from "@/components/activity/activity-feed";

export function TodayActivity() {
  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
      <h3 className="mb-4 text-heading-1 text-text-primary">
        Atividade recente
      </h3>
      <ActivityFeed limit={12} />
    </section>
  );
}
