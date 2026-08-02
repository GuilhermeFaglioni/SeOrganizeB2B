import { Prisma } from "@prisma/client";

export type Money = Prisma.Decimal;

export function toDecimal(value: string | number | Prisma.Decimal): Money {
  return new Prisma.Decimal(value);
}

export function add(a: Money, b: Money): Money {
  return a.plus(b);
}

export function sub(a: Money, b: Money): Money {
  return a.minus(b);
}

export function mul(a: Money, b: Money): Money {
  return a.times(b);
}

export function div(a: Money, b: Money): Money {
  return a.dividedBy(b);
}

export function neg(a: Money): Money {
  return a.negated();
}

export function sum(values: Money[]): Money {
  return values.reduce((acc, value) => acc.plus(value), new Prisma.Decimal(0));
}

export function eq(a: Money, b: Money): boolean {
  return a.equals(b);
}

export function gt(a: Money, b: Money): boolean {
  return a.greaterThan(b);
}

export function gte(a: Money, b: Money): boolean {
  return a.greaterThanOrEqualTo(b);
}

export function lt(a: Money, b: Money): boolean {
  return a.lessThan(b);
}

export function isNegative(a: Money): boolean {
  return a.isNegative();
}

export function toCents(a: Money): number {
  return a.times(100).toDecimalPlaces(0).toNumber();
}

export function fromCents(cents: number): Money {
  return new Prisma.Decimal(cents).dividedBy(100);
}

export function moneyToJson(a: Money): string {
  return a.toFixed(2);
}

export function formatBRL(value: Money): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
    .format(value.toNumber())
    .replace(/\u00a0/g, " ");
}
