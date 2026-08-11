import { prisma } from "../../../prisma/client";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [totalWorkspaces, totalProfiles, totalPlans] = await Promise.all([
    prisma.workspace.count(),
    prisma.profile.count(),
    prisma.plan.count(),
  ]);

  return (
    <AdminDashboard
      totalWorkspaces={totalWorkspaces}
      totalProfiles={totalProfiles}
      totalPlans={totalPlans}
    />
  );
}
