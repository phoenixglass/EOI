import type { ActivityEntry, FormState } from "../state/formState";

export interface ComputedFinancials {
  deductibleRemaining: number | null;
  oopRemaining: number | null;
  totalPaymentsToOop: number;
  totalAssistanceToOop: number;
  totalEpisodeActivityToOop: number;
  oopSatisfied: boolean;
  crossTierWarning: boolean;
}

const nz = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

export function computeDeductibleRemaining(
  total: number | null,
  met: number | null,
): number | null {
  if (total === null) return null;
  return Math.max(total - nz(met), 0);
}

export function sumActivities(
  activities: ActivityEntry[],
  predicate: (a: ActivityEntry) => boolean,
  field: "clientPayment" | "assistance",
): number {
  return activities
    .filter(predicate)
    .reduce((acc, a) => acc + nz(a[field]), 0);
}

export function computeOopRemaining(
  oopMaxTotal: number | null,
  oopMet: number | null,
  totalEpisodeActivityToOop: number,
): number | null {
  if (oopMaxTotal === null) return null;
  const effectiveMet = Math.max(nz(oopMet), totalEpisodeActivityToOop);
  return Math.max(oopMaxTotal - effectiveMet, 0);
}

export function computeFinancials(state: FormState): ComputedFinancials {
  const deductibleRemaining = computeDeductibleRemaining(
    state.deductibleTotal,
    state.deductibleMet,
  );

  const totalPaymentsToOop = sumActivities(
    state.activities,
    (a) => a.countsTowardOop,
    "clientPayment",
  );
  const totalAssistanceToOop = sumActivities(
    state.activities,
    (a) => a.countsTowardOop,
    "assistance",
  );
  const totalEpisodeActivityToOop =
    totalPaymentsToOop + totalAssistanceToOop;

  const oopRemaining = computeOopRemaining(
    state.oopMaxTotal,
    state.oopMet,
    totalEpisodeActivityToOop,
  );

  const oopSatisfied =
    state.oopMaxTotal !== null && state.oopMaxTotal > 0
      ? nz(state.oopMet) >= state.oopMaxTotal ||
        (oopRemaining !== null && oopRemaining === 0)
      : false;

  const crossTierWarning =
    !!state.verifiedTierId &&
    !!state.currentTierId &&
    state.verifiedTierId !== state.currentTierId;

  return {
    deductibleRemaining,
    oopRemaining,
    totalPaymentsToOop,
    totalAssistanceToOop,
    totalEpisodeActivityToOop,
    oopSatisfied,
    crossTierWarning,
  };
}

export function parseMoney(input: string): number | null {
  if (input === "" || input == null) return null;
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(
  value: number | null,
  locale: string,
  currencyCode: string,
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value}%`;
}
