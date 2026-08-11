import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminAccessDenied } from "@/components/admin/admin-access-denied";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const isSuperAdmin = await getSuperAdminStatus(user.id);
  if (!isSuperAdmin) {
    return <AdminAccessDenied />;
  }

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] overflow-hidden">
      <AdminSidebar />
      <main className="min-h-0 flex-1 overflow-auto bg-page">{children}</main>
    </div>
  );
}
