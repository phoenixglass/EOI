import { describe, it, expect } from "vitest";
import {
  computeDeductibleRemaining,
  computeOopRemaining,
  computeFinancials,
  parseMoney,
  formatMoney,
  calculateEstimate,
  getCalculationBasis,
} from "./calculations";
import type { FormState, ActivityEntry } from "../state/formState";

function baseState(overrides: Partial<FormState> = {}): FormState {
  return {
    networkStatus: null,
    deductibleTotal: null,
    deductibleMet: null,
    oopMaxTotal: null,
    oopMet: null,
    bucketStructure: null,
    patientStatusId: "",
    currentTierId: "",
    verifiedTierId: "",
    deductibleApplies: null,
    coinsuranceApplies: null,
    coinsurancePercent: null,
    copayApplies: null,
    copayAmount: null,
    copayRule: null,
    estimatedProviderCharge: null,
    estimatedAllowedAmount: null,
    estimateBasis: null,
    serviceAppliesToDeductibleBucket: null,
    serviceAppliesToOOPBucket: null,
    activities: [],
    currentBalance: null,
    finalCheck: {},
    ...overrides,
  };
}

function activity(over: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: "a",
    tierId: "op",
    clientPayment: 0,
    assistance: 0,
    assistanceTypeId: "",
    countsTowardOop: false,
    countsTowardDeductible: false,
    notes: "",
    ...over,
  };
}

describe("computeDeductibleRemaining", () => {
  it("returns null when total is null", () => {
    expect(computeDeductibleRemaining(null, 100)).toBeNull();
  });
  it("clamps negative to 0 when met exceeds total", () => {
    expect(computeDeductibleRemaining(500, 700)).toBe(0);
  });
  it("subtracts met from total", () => {
    expect(computeDeductibleRemaining(1000, 250)).toBe(750);
  });
  it("treats null met as 0", () => {
    expect(computeDeductibleRemaining(1000, null)).toBe(1000);
  });
});

describe("computeOopRemaining", () => {
  it("returns null when total is null", () => {
    expect(computeOopRemaining(null, 100, 0)).toBeNull();
  });
  it("uses larger of oopMet and activity-to-oop", () => {
    expect(computeOopRemaining(5000, 1000, 3000)).toBe(2000);
    expect(computeOopRemaining(5000, 4000, 1000)).toBe(1000);
  });
  it("clamps to 0", () => {
    expect(computeOopRemaining(5000, 6000, 0)).toBe(0);
  });
});

describe("computeFinancials", () => {
  it("handles empty activity list", () => {
    const f = computeFinancials(
      baseState({ oopMaxTotal: 5000, oopMet: 1000 }),
    );
    expect(f.totalEpisodeActivityToOop).toBe(0);
    expect(f.oopRemaining).toBe(4000);
    expect(f.oopSatisfied).toBe(false);
  });

  it("OOP satisfied via activity sum", () => {
    const f = computeFinancials(
      baseState({
        oopMaxTotal: 1000,
        oopMet: 0,
        activities: [
          activity({
            id: "1",
            clientPayment: 600,
            assistance: 500,
            countsTowardOop: true,
          }),
        ],
      }),
    );
    expect(f.totalEpisodeActivityToOop).toBe(1100);
    expect(f.oopRemaining).toBe(0);
    expect(f.oopSatisfied).toBe(true);
  });

  it("flags crossTierWarning when verified differs from current", () => {
    const f = computeFinancials(
      baseState({ currentTierId: "iop", verifiedTierId: "php" }),
    );
    expect(f.crossTierWarning).toBe(true);
  });
});

describe("parseMoney", () => {
  it("parses bare number", () => {
    expect(parseMoney("123.45")).toBe(123.45);
  });
  it("strips $ and commas", () => {
    expect(parseMoney("$1,234.56")).toBe(1234.56);
  });
  it("returns null for empty", () => {
    expect(parseMoney("")).toBeNull();
  });
  it("returns null for garbage", () => {
    expect(parseMoney("abc")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("returns em-dash for null", () => {
    expect(formatMoney(null, "en-US", "USD")).toBe("—");
  });
  it("formats USD", () => {
    expect(formatMoney(1234.5, "en-US", "USD")).toMatch(/\$1,234\.50/);
  });
});

describe("getCalculationBasis", () => {
  it("prefers allowed amount over provider charge", () => {
    const b = getCalculationBasis(
      baseState({
        estimatedAllowedAmount: 200,
        estimatedProviderCharge: 500,
        estimateBasis: "provider_charge",
      }),
    );
    expect(b.calculationAmount).toBe(200);
    expect(b.calculationBasisLabel).toBe("estimated allowed amount");
  });

  it("uses provider charge when basis selected", () => {
    const b = getCalculationBasis(
      baseState({
        estimatedProviderCharge: 500,
        estimateBasis: "provider_charge",
      }),
    );
    expect(b.calculationAmount).toBe(500);
    expect(b.calculationBasisLabel).toBe("provider charge");
  });

  it("returns null when basis is no_dollar_estimate", () => {
    const b = getCalculationBasis(
      baseState({
        estimatedProviderCharge: 500,
        estimateBasis: "no_dollar_estimate",
      }),
    );
    expect(b.calculationAmount).toBeNull();
  });
});

describe("calculateEstimate — acceptance scenarios", () => {
  // Test 1: OON, deductible total $2000, met $943, OOP $5000 / $958, 20% coins, no copay, no allowed amount.
  it("Test 1: no allowed amount → cannot estimate dollar amount", () => {
    const r = calculateEstimate(
      baseState({
        networkStatus: "oon",
        deductibleTotal: 2000,
        deductibleMet: 943,
        oopMaxTotal: 5000,
        oopMet: 958,
        bucketStructure: "combined",
        deductibleApplies: "yes",
        coinsuranceApplies: "yes",
        coinsurancePercent: 20,
        copayApplies: "no",
        copayRule: "no_copay",
        estimateBasis: "no_dollar_estimate",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.canEstimate).toBe(false);
    expect(r.deductibleRemaining).toBe(1057);
    expect(r.oopRemaining).toBe(4042);
    expect(r.cannotEstimateReasons).toContain("no_dollar_basis");
  });

  // Test 2: $200 allowed amount → $200 patient responsibility.
  it("Test 2: $200 allowed amount goes entirely to deductible", () => {
    const r = calculateEstimate(
      baseState({
        networkStatus: "oon",
        deductibleTotal: 2000,
        deductibleMet: 943,
        oopMaxTotal: 5000,
        oopMet: 958,
        bucketStructure: "combined",
        deductibleApplies: "yes",
        coinsuranceApplies: "yes",
        coinsurancePercent: 20,
        copayApplies: "no",
        copayRule: "no_copay",
        estimatedAllowedAmount: 200,
        estimateBasis: "allowed_amount",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.canEstimate).toBe(true);
    expect(r.deductiblePortion).toBe(200);
    expect(r.amountAfterDeductible).toBe(0);
    expect(r.coinsuranceAmount).toBe(0);
    expect(r.finalPatientEstimate).toBe(200);
  });

  // Test 3: $1500 allowed amount → $1145.60.
  it("Test 3: $1500 visit crosses deductible", () => {
    const r = calculateEstimate(
      baseState({
        deductibleTotal: 2000,
        deductibleMet: 943,
        oopMaxTotal: 5000,
        oopMet: 958,
        bucketStructure: "combined",
        deductibleApplies: "yes",
        coinsuranceApplies: "yes",
        coinsurancePercent: 20,
        copayApplies: "no",
        copayRule: "no_copay",
        estimatedAllowedAmount: 1500,
        estimateBasis: "allowed_amount",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.canEstimate).toBe(true);
    expect(r.deductiblePortion).toBe(1057);
    expect(r.amountAfterDeductible).toBe(443);
    expect(r.coinsuranceAmount).toBeCloseTo(88.6, 2);
    expect(r.finalPatientEstimate).toBeCloseTo(1145.6, 2);
  });

  // Test 4: deductible met, 20% coins, $200 allowed → $40.
  it("Test 4: deductible met, 20% of $200 = $40", () => {
    const r = calculateEstimate(
      baseState({
        deductibleTotal: 2000,
        deductibleMet: 2000,
        oopMaxTotal: 5000,
        oopMet: 1000,
        bucketStructure: "combined",
        deductibleApplies: "yes",
        coinsuranceApplies: "yes",
        coinsurancePercent: 20,
        copayApplies: "no",
        copayRule: "no_copay",
        estimatedAllowedAmount: 200,
        estimateBasis: "allowed_amount",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.canEstimate).toBe(true);
    expect(r.deductibleIsMet).toBe(true);
    expect(r.deductiblePortion).toBe(0);
    expect(r.coinsuranceAmount).toBe(40);
    expect(r.finalPatientEstimate).toBe(40);
  });

  // Test 5: OOP max met → $0 for covered services.
  it("Test 5: OOP max met → $0 estimate, override applied", () => {
    const r = calculateEstimate(
      baseState({
        deductibleTotal: 2000,
        deductibleMet: 2000,
        oopMaxTotal: 5000,
        oopMet: 5000,
        bucketStructure: "combined",
        deductibleApplies: "yes",
        coinsuranceApplies: "yes",
        coinsurancePercent: 20,
        copayApplies: "no",
        copayRule: "no_copay",
        estimatedAllowedAmount: 1000,
        estimateBasis: "allowed_amount",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.oopMaxIsMet).toBe(true);
    expect(r.oopMaxOverrideApplied).toBe(true);
    expect(r.finalPatientEstimate).toBe(0);
  });

  // Test 6: OOP remaining ($100) caps the estimate ($200 → $100).
  it("Test 6: OOP cap limits estimate", () => {
    const r = calculateEstimate(
      baseState({
        deductibleTotal: 2000,
        deductibleMet: 2000,
        oopMaxTotal: 5000,
        oopMet: 4900,
        bucketStructure: "combined",
        deductibleApplies: "yes",
        coinsuranceApplies: "yes",
        coinsurancePercent: 20,
        copayApplies: "no",
        copayRule: "no_copay",
        estimatedAllowedAmount: 1000,
        estimateBasis: "allowed_amount",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.canEstimate).toBe(true);
    expect(r.patientResponsibilityBeforeOOP).toBe(200);
    expect(r.oopRemaining).toBe(100);
    expect(r.finalPatientEstimate).toBe(100);
    expect(r.oopCapApplied).toBe(true);
  });

  // Test 7: copay only → just the copay.
  it("Test 7: copay only → $50", () => {
    const r = calculateEstimate(
      baseState({
        deductibleTotal: 2000,
        deductibleMet: 0,
        oopMaxTotal: 5000,
        oopMet: 0,
        bucketStructure: "combined",
        deductibleApplies: "no",
        coinsuranceApplies: "no",
        copayApplies: "yes",
        copayAmount: 50,
        copayRule: "copay_only",
        estimatedAllowedAmount: 200,
        estimateBasis: "allowed_amount",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.canEstimate).toBe(true);
    expect(r.finalPatientEstimate).toBe(50);
    expect(r.copayAmountUsed).toBe(50);
  });

  // Test 8: copay rule unknown → no confident dollar estimate.
  it("Test 8: copay rule unknown → cannot estimate", () => {
    const r = calculateEstimate(
      baseState({
        deductibleTotal: 2000,
        deductibleMet: 0,
        oopMaxTotal: 5000,
        oopMet: 0,
        bucketStructure: "combined",
        deductibleApplies: "yes",
        coinsuranceApplies: "yes",
        coinsurancePercent: 20,
        copayApplies: "yes",
        copayAmount: 40,
        copayRule: "unknown",
        estimatedAllowedAmount: 200,
        estimateBasis: "allowed_amount",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.canEstimate).toBe(false);
    expect(r.cannotEstimateReasons).toContain("copay_rule_unknown");
  });

  // Test 9: deductible applicability unknown → no confident estimate.
  it("Test 9: deductible applicability unknown → cannot estimate", () => {
    const r = calculateEstimate(
      baseState({
        deductibleTotal: 2000,
        deductibleMet: 0,
        oopMaxTotal: 5000,
        oopMet: 0,
        bucketStructure: "combined",
        deductibleApplies: "unknown",
        coinsuranceApplies: "yes",
        coinsurancePercent: 20,
        copayApplies: "no",
        copayRule: "no_copay",
        estimatedAllowedAmount: 200,
        estimateBasis: "allowed_amount",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.canEstimate).toBe(false);
    expect(r.cannotEstimateReasons).toContain(
      "deductible_applicability_unknown",
    );
  });

  // Test 10: OON with provider charge but no allowed amount → uses provider charge with label.
  it("Test 10a: OON provider charge basis → uses provider charge", () => {
    const r = calculateEstimate(
      baseState({
        networkStatus: "oon",
        deductibleTotal: 2000,
        deductibleMet: 0,
        oopMaxTotal: 5000,
        oopMet: 0,
        bucketStructure: "combined",
        deductibleApplies: "yes",
        coinsuranceApplies: "yes",
        coinsurancePercent: 20,
        copayApplies: "no",
        copayRule: "no_copay",
        estimatedProviderCharge: 1000,
        estimateBasis: "provider_charge",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.canEstimate).toBe(true);
    expect(r.calculationAmount).toBe(1000);
    expect(r.calculationBasisLabel).toBe("provider charge");
  });

  // Separate-bucket scenarios: OOP max met must NOT be a universal override.
  it("Test 11: separate buckets, OOP met but service does not apply to OOP → deductible still applies", () => {
    const r = calculateEstimate(
      baseState({
        networkStatus: "oon",
        deductibleTotal: 2000,
        deductibleMet: 0,
        oopMaxTotal: 3500,
        oopMet: 3500,
        bucketStructure: "separate",
        deductibleApplies: "yes",
        coinsuranceApplies: "yes",
        coinsurancePercent: null,
        copayApplies: "no",
        copayRule: "no_copay",
        estimatedAllowedAmount: 750,
        estimateBasis: "allowed_amount",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "no",
      }),
    );
    expect(r.canEstimate).toBe(true);
    expect(r.oopMaxIsMet).toBe(true);
    expect(r.oopMaxOverrideApplied).toBe(false);
    expect(r.oopCapApplied).toBe(false);
    expect(r.deductiblePortion).toBe(750);
    expect(r.amountAfterDeductible).toBe(0);
    expect(r.finalPatientEstimate).toBe(750);
    expect(r.cannotEstimateReasons).not.toContain("coinsurance_percent_unknown");
  });

  it("Test 12: coinsurance percent missing but visit fits inside deductible → still estimable", () => {
    const r = calculateEstimate(
      baseState({
        deductibleTotal: 2000,
        deductibleMet: 0,
        oopMaxTotal: 5000,
        oopMet: 0,
        bucketStructure: "combined",
        deductibleApplies: "yes",
        coinsuranceApplies: "yes",
        coinsurancePercent: null,
        copayApplies: "no",
        copayRule: "no_copay",
        estimatedAllowedAmount: 750,
        estimateBasis: "allowed_amount",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.canEstimate).toBe(true);
    expect(r.deductiblePortion).toBe(750);
    expect(r.amountAfterDeductible).toBe(0);
    expect(r.finalPatientEstimate).toBe(750);
  });

  it("Test 13: coinsurance percent missing AND visit crosses deductible → cannot estimate", () => {
    const r = calculateEstimate(
      baseState({
        deductibleTotal: 500,
        deductibleMet: 0,
        oopMaxTotal: 5000,
        oopMet: 0,
        bucketStructure: "combined",
        deductibleApplies: "yes",
        coinsuranceApplies: "yes",
        coinsurancePercent: null,
        copayApplies: "no",
        copayRule: "no_copay",
        estimatedAllowedAmount: 750,
        estimateBasis: "allowed_amount",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.canEstimate).toBe(false);
    expect(r.cannotEstimateReasons).toContain("coinsurance_percent_unknown");
  });

  it("Test 14: separate buckets, OOP met, service applies only to OOP bucket → override fires", () => {
    // Sanity check that the OOP override still works when the service truly
    // accumulates against the OOP bucket.
    const r = calculateEstimate(
      baseState({
        deductibleTotal: 2000,
        deductibleMet: 0,
        oopMaxTotal: 3500,
        oopMet: 3500,
        bucketStructure: "separate",
        deductibleApplies: "no",
        coinsuranceApplies: "yes",
        coinsurancePercent: 20,
        copayApplies: "no",
        copayRule: "no_copay",
        estimatedAllowedAmount: 750,
        estimateBasis: "allowed_amount",
        serviceAppliesToDeductibleBucket: "no",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.oopMaxOverrideApplied).toBe(true);
    expect(r.finalPatientEstimate).toBe(0);
  });

  it("Test 10b: OON, no basis selected → cannot estimate", () => {
    const r = calculateEstimate(
      baseState({
        networkStatus: "oon",
        deductibleTotal: 2000,
        deductibleMet: 0,
        oopMaxTotal: 5000,
        oopMet: 0,
        bucketStructure: "combined",
        deductibleApplies: "yes",
        coinsuranceApplies: "yes",
        coinsurancePercent: 20,
        copayApplies: "no",
        copayRule: "no_copay",
        estimatedProviderCharge: 1000,
        estimateBasis: "no_dollar_estimate",
        serviceAppliesToDeductibleBucket: "yes",
        serviceAppliesToOOPBucket: "yes",
      }),
    );
    expect(r.canEstimate).toBe(false);
    expect(r.cannotEstimateReasons).toContain("no_dollar_basis");
  });
});
