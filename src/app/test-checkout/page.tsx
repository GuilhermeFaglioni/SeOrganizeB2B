import type { Metadata } from "next";
import { prisma } from "../../../prisma/client";
import { TestCheckoutLanding } from "./test-checkout";

export const metadata: Metadata = {
  title: "Assinar",
};

export const dynamic = "force-dynamic";

export default async function TestCheckoutPage() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
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
