import { prisma } from "../../../prisma/client";
import { extendRecurringHorizons } from "./installments-service";
import { todayCivilDate } from "./civil-date";
import { moneyToJson, sum } from "./money";
import { isExpiringSoon } from "./metrics";

export interface TodayBusinessData {
  receivablesThisWeek: string;
  openProposals: number;
  expiringContracts: number;
  overdueTasks: number;
}

/**
 * Computes the "meu negócio" (my business) summary for the Today page.
 * Reuses existing domain logic:
 *  - receivables: pending installments with dueDate in the current ISO week
 *  - openProposals: count of proposals with status draft/sent/viewed
 *  - expiringContracts: active fixed contracts ending within 30 days
 *  - overdueTasks: non-archived tasks whose dueDate < start of today
 */
export async function computeTodayBusiness(): Promise<TodayBusinessData> {
  const today = todayCivilDate();
  const weekEnd = endOfISOWeek(today);

  return prisma.$transaction(async (tx) => {
    await extendRecurringHorizons(tx);

    const installments = await tx.installment.findMany({
      where: {
        status: "pending",
        dueDate: { gte: today, lte: weekEnd },
      },
      select: { expectedAmount: true },
    });

    const receivablesThisWeek = sum(
      installments.map((i) => i.expectedAmount)
    );

    const openProposals = await tx.proposal.count({
      where: {
        status: { in: ["draft", "sent", "viewed"] },
      },
    });

    const activeContracts = await tx.contract.findMany({
      where: { status: "active" },
      select: {
        id: true,
        durationType: true,
        endDate: true,
      },
    });

    const expiringContracts = activeContracts.filter(
      (c) =>
        c.durationType === "fixed" &&
        c.endDate &&
        isExpiringSoon(c.endDate, today)
    ).length;

    const overdueTasks = await tx.task.count({
      where: {
        archived: false,
        dueDate: { lt: startOfToday() },
        column: { completesTasks: false },
      },
    });

    return {
      receivablesThisWeek: moneyToJson(receivablesThisWeek),
      openProposals,
      expiringContracts,
      overdueTasks,
    };
  });
}

/** Returns the ISO-8601 week end (Sunday) civil date string for the given date. */
export function endOfISOWeek(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  // JS: 0=Sun,1=Mon,...,6=Sat → ISO: 1=Mon,...,7=Sun
  const jsDay = d.getUTCDay(); // 0..6
  const daysUntilSunday = jsDay === 0 ? 0 : 7 - jsDay;
  const result = new Date(Date.UTC(year, month - 1, day + daysUntilSunday));
  return [
    result.getUTCFullYear(),
    String(result.getUTCMonth() + 1).padStart(2, "0"),
    String(result.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Returns a Date object representing the start of today (UTC midnight). */
function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
