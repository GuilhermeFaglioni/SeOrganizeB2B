import { describe, expect, it } from "vitest";
import {
  toDecimal,
  add,
  sub,
  mul,
  div,
  sum,
  eq,
  lt,
  isNegative,
  toCents,
  fromCents,
  moneyToJson,
  formatBRL,
} from "../lib/financial/money";
import {
  isCivilDate,
  todayCivilDate,
  addMonthsCivil,
  addDaysCivil,
  monthKey,
  compareCivil,
  isWithin,
  formatCivilDate,
} from "../lib/financial/civil-date";

describe("money helpers", () => {
  it("performs decimal-safe arithmetic", () => {
    const a = toDecimal("10.10");
    const b = toDecimal("0.30");
    expect(add(a, b).toString()).toBe("10.4");
    expect(sub(a, b).toString()).toBe("9.8");
    expect(mul(a, toDecimal(2)).toString()).toBe("20.2");
    expect(div(a, toDecimal(2)).toString()).toBe("5.05");
    expect(sum([a, b, toDecimal("0.60")]).toString()).toBe("11");
  });

  it("never produces floating point error", () => {
    expect(add(toDecimal("0.1"), toDecimal("0.2")).toString()).toBe("0.3");
  });

  it("rounds to cents and formats BRL", () => {
    expect(toCents(toDecimal("12.34"))).toBe(1234);
    expect(fromCents(1234).toString()).toBe("12.34");
    expect(moneyToJson(toDecimal("12.3"))).toBe("12.30");
    expect(formatBRL(toDecimal("1234.5"))).toBe("R$ 1.234,50");
  });

  it("compares with tolerance-free decimal equality", () => {
    expect(eq(toDecimal("1.00"), toDecimal("1"))).toBe(true);
    expect(lt(toDecimal("0.99"), toDecimal("1"))).toBe(true);
    expect(isNegative(toDecimal("-0.01"))).toBe(true);
  });
});

describe("civil date helpers", () => {
  it("validates and compares YYYY-MM-DD strings", () => {
    expect(isCivilDate("2026-08-02")).toBe(true);
    expect(isCivilDate("2026-02-30")).toBe(false);
    expect(isCivilDate("2026-8-02")).toBe(false);
    expect(compareCivil("2026-08-02", "2026-08-03")).toBe(-1);
    expect(isWithin("2026-08-02", "2026-08-01", "2026-08-31")).toBe(true);
    expect(monthKey("2026-08-02")).toBe("2026-08");
  });

  it("adds months and days while clamping to month end", () => {
    expect(addMonthsCivil("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsCivil("2026-08-02", 2)).toBe("2026-10-02");
    expect(addDaysCivil("2026-08-02", 30)).toBe("2026-09-01");
  });

  it("produces a valid today value and UTC-stable formatting", () => {
    expect(isCivilDate(todayCivilDate())).toBe(true);
    expect(formatCivilDate("2026-08-02")).toBe("Aug 2, 2026");
  });
});
