import type {
  ActivityEntry,
  CopayRule,
  FormState,
  TriState,
} from "../state/formState";

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

// ---------------------------------------------------------------------------
// Patient estimate engine
// ---------------------------------------------------------------------------

export interface CalculationBasis {
  calculationAmount: number | null;
  calculationBasisLabel: string | null;
}

export function getCalculationBasis(state: FormState): CalculationBasis {
  const allowed = state.estimatedAllowedAmount;
  const charge = state.estimatedProviderCharge;
  const basis = state.estimateBasis;

  if (typeof allowed === "number" && Number.isFinite(allowed)) {
    return {
      calculationAmount: round2(allowed),
      calculationBasisLabel: "estimated allowed amount",
    };
  }
  if (
    basis === "provider_charge" &&
    typeof charge === "number" &&
    Number.isFinite(charge)
  ) {
    return {
      calculationAmount: round2(charge),
      calculationBasisLabel: "provider charge",
    };
  }
  if (
    basis === "usual_allowed_estimate" &&
    typeof charge === "number" &&
    Number.isFinite(charge)
  ) {
    return {
      calculationAmount: round2(charge),
      calculationBasisLabel: "usual allowed estimate",
    };
  }
  return { calculationAmount: null, calculationBasisLabel: null };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function applies(v: TriState | null | undefined): boolean {
  return v === "yes";
}

function deductibleAppliesForService(state: FormState): boolean {
  if (!applies(state.deductibleApplies)) return false;
  if (state.serviceAppliesToDeductibleBucket === "no") return false;
  return true;
}

// IMPORTANT: OOP max met is NOT a universal override.
//
// The OOP max only limits patient responsibility when ALL of the following are true:
//   1. serviceAppliesToOOPBucket === "yes"
//   2. oopRemaining is known (oopMaxTotal !== null)
//   3. the service is covered and accumulates to that OOP bucket.
//
// If bucketStructure === "separate" AND serviceAppliesToOOPBucket === "no",
// the OOP max must NOT cap the estimate, even if the patient has met the OOP max.
// In that case, deductible logic still applies independently.
export function oopCapCanApply(state: FormState): boolean {
  return (
    state.serviceAppliesToOOPBucket === "yes" && state.oopMaxTotal !== null
  );
}

export interface EstimateResult {
  // Inputs / derived plan numbers.
  deductibleRemaining: number | null;
  oopRemaining: number | null;
  deductibleIsMet: boolean;
  oopMaxIsMet: boolean;

  // Basis used for the calculation.
  calculationAmount: number | null;
  calculationBasisLabel: string | null;

  // Math outputs.
  deductiblePortion: number;
  amountAfterDeductible: number;
  coinsuranceAmount: number;
  copayAmountUsed: number;
  patientResponsibilityBeforeOOP: number;
  finalPatientEstimate: number;
  oopCapApplied: boolean;

  // Result classification.
  canEstimate: boolean;
  cannotEstimateReasons: string[];

  // Special outcomes.
  oopMaxOverrideApplied: boolean;
}

const EMPTY: EstimateResult = {
  deductibleRemaining: null,
  oopRemaining: null,
  deductibleIsMet: false,
  oopMaxIsMet: false,
  calculationAmount: null,
  calculationBasisLabel: null,
  deductiblePortion: 0,
  amountAfterDeductible: 0,
  coinsuranceAmount: 0,
  copayAmountUsed: 0,
  patientResponsibilityBeforeOOP: 0,
  finalPatientEstimate: 0,
  oopCapApplied: false,
  canEstimate: false,
  cannotEstimateReasons: [],
  oopMaxOverrideApplied: false,
};

export function calculateEstimate(state: FormState): EstimateResult {
  const result: EstimateResult = { ...EMPTY, cannotEstimateReasons: [] };

  result.deductibleRemaining =
    state.deductibleTotal !== null
      ? Math.max(state.deductibleTotal - nz(state.deductibleMet), 0)
      : null;
  result.oopRemaining =
    state.oopMaxTotal !== null
      ? Math.max(state.oopMaxTotal - nz(state.oopMet), 0)
      : null;
  result.deductibleIsMet =
    result.deductibleRemaining !== null && result.deductibleRemaining <= 0;
  result.oopMaxIsMet =
    result.oopRemaining !== null && result.oopRemaining <= 0;

  // Step 1: calculation basis.
  const basis = getCalculationBasis(state);
  result.calculationAmount = basis.calculationAmount;
  result.calculationBasisLabel = basis.calculationBasisLabel;

  // Step 2: OOP max override — patient owes $0 for covered services.
  // ONLY applies when the service is explicitly tagged as applying to the OOP
  // bucket. If bucketStructure === "separate" and the service does NOT apply to
  // the OOP bucket, the patient may still owe deductible-based responsibility
  // even when oopRemaining is $0.
  const canCapByOop = oopCapCanApply(state);
  if (canCapByOop && result.oopMaxIsMet) {
    result.oopMaxOverrideApplied = true;
    result.canEstimate = true;
    result.finalPatientEstimate = 0;
    result.patientResponsibilityBeforeOOP = 0;
    return result;
  }

  // Required-info gating (everything except coinsurance percent, which depends
  // on amountAfterDeductible and is checked below).
  if (result.calculationAmount === null) {
    result.cannotEstimateReasons.push("no_dollar_basis");
  }
  if (state.deductibleApplies === "unknown" || state.deductibleApplies === null) {
    result.cannotEstimateReasons.push("deductible_applicability_unknown");
  }
  if (state.copayApplies === "yes" && (state.copayRule === "unknown" || state.copayRule === null)) {
    result.cannotEstimateReasons.push("copay_rule_unknown");
  }
  if (state.coinsuranceApplies === "unknown" && state.copayRule !== "copay_only") {
    result.cannotEstimateReasons.push("coinsurance_applicability_unknown");
  }
  if (
    state.bucketStructure !== "combined" &&
    state.serviceAppliesToDeductibleBucket === "unknown" &&
    applies(state.deductibleApplies)
  ) {
    result.cannotEstimateReasons.push("service_deductible_bucket_unknown");
  }

  // Without a basis we cannot compute portions; bail with whatever reasons we have.
  if (result.calculationAmount === null) {
    result.canEstimate = false;
    return result;
  }

  const amount = result.calculationAmount;

  // Step 3: deductible portion.
  if (deductibleAppliesForService(state)) {
    const remaining = nz(result.deductibleRemaining);
    result.deductiblePortion = round2(Math.min(amount, remaining));
    result.amountAfterDeductible = round2(
      Math.max(amount - result.deductiblePortion, 0),
    );
  } else {
    result.deductiblePortion = 0;
    result.amountAfterDeductible = amount;
  }

  // Step 4: coinsurance percent only matters when there is a portion left
  // after the deductible. If amountAfterDeductible === 0, the entire visit
  // falls within the remaining deductible and coinsurance is not needed.
  const coinsurancePercentMissing =
    state.coinsuranceApplies === "yes" &&
    (state.coinsurancePercent === null ||
      !Number.isFinite(state.coinsurancePercent));
  if (coinsurancePercentMissing && result.amountAfterDeductible > 0) {
    result.cannotEstimateReasons.push("coinsurance_percent_unknown");
  }

  if (result.cannotEstimateReasons.length > 0) {
    result.canEstimate = false;
    return result;
  }

  // Step 5: coinsurance.
  if (
    state.coinsuranceApplies === "yes" &&
    typeof state.coinsurancePercent === "number"
  ) {
    result.coinsuranceAmount = round2(
      result.amountAfterDeductible * (state.coinsurancePercent / 100),
    );
  } else {
    result.coinsuranceAmount = 0;
  }

  // Step 6: combine with copay rule.
  const rule: CopayRule =
    state.copayRule ??
    (state.copayApplies === "yes" ? "unknown" : "no_copay");
  const copay = nz(state.copayAmount);

  switch (rule) {
    case "no_copay": {
      result.copayAmountUsed = 0;
      result.patientResponsibilityBeforeOOP = round2(
        result.deductiblePortion + result.coinsuranceAmount,
      );
      break;
    }
    case "copay_only": {
      result.copayAmountUsed = copay;
      result.coinsuranceAmount = 0;
      result.deductiblePortion = 0;
      result.amountAfterDeductible = amount;
      result.patientResponsibilityBeforeOOP = round2(copay);
      break;
    }
    case "copay_before_deductible": {
      result.copayAmountUsed = copay;
      result.patientResponsibilityBeforeOOP = round2(
        copay + result.deductiblePortion + result.coinsuranceAmount,
      );
      break;
    }
    case "copay_after_deductible": {
      result.copayAmountUsed = copay;
      if (deductibleAppliesForService(state) && !result.deductibleIsMet) {
        const remaining = nz(result.deductibleRemaining);
        if (amount <= remaining) {
          result.patientResponsibilityBeforeOOP = round2(amount);
        } else {
          result.patientResponsibilityBeforeOOP = round2(
            result.deductiblePortion + copay,
          );
          // Coinsurance does not stack here; copay-after-deductible substitutes.
          result.coinsuranceAmount = 0;
        }
      } else {
        result.patientResponsibilityBeforeOOP = round2(copay);
        result.coinsuranceAmount = 0;
      }
      break;
    }
    case "copay_plus_coinsurance": {
      result.copayAmountUsed = copay;
      result.patientResponsibilityBeforeOOP = round2(
        copay + result.deductiblePortion + result.coinsuranceAmount,
      );
      break;
    }
    case "copay_instead_of_coinsurance": {
      result.copayAmountUsed = copay;
      result.coinsuranceAmount = 0;
      if (deductibleAppliesForService(state) && !result.deductibleIsMet) {
        if (result.amountAfterDeductible > 0) {
          result.patientResponsibilityBeforeOOP = round2(
            result.deductiblePortion + copay,
          );
        } else {
          result.patientResponsibilityBeforeOOP = round2(
            result.deductiblePortion,
          );
        }
      } else {
        result.patientResponsibilityBeforeOOP = round2(copay);
      }
      break;
    }
    case "unknown":
    default: {
      result.cannotEstimateReasons.push("copay_rule_unknown");
      result.canEstimate = false;
      return result;
    }
  }

  // Step 7: cap by OOP remaining.
  // Only apply the cap when the service explicitly applies to the OOP bucket
  // and oopRemaining is known. Otherwise the OOP max does NOT limit the
  // estimate (this is the separate-bucket case).
  if (canCapByOop) {
    const remaining = nz(result.oopRemaining);
    if (result.patientResponsibilityBeforeOOP > remaining) {
      result.finalPatientEstimate = round2(remaining);
      result.oopCapApplied = true;
    } else {
      result.finalPatientEstimate = result.patientResponsibilityBeforeOOP;
    }
  } else {
    result.finalPatientEstimate = result.patientResponsibilityBeforeOOP;
  }

  result.canEstimate = true;
  return result;
}
