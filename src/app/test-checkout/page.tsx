import type { Metadata } from "next";
import { prisma } from "../../../prisma/client";
import { TestCheckoutLanding } from "./test-checkout";

export const metadata: Metadata = {
  title: "Assinar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TestCheckoutPage() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true, isInternal: false },
    select: { id: true, name: true, stripePriceId: true, allowedModules: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <TestCheckoutLanding
      plans={plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        stripePriceId: plan.stripePriceId,
        allowedModules: (plan.allowedModules as string[]) ?? [],
      }))}
    />
  );
}
