import { describe, it, expect } from "vitest";
import {
  computeDeductibleRemaining,
  computeOopRemaining,
  computeFinancials,
  parseMoney,
  formatMoney,
} from "./calculations";
import type { FormState, ActivityEntry } from "../state/formState";

function baseState(overrides: Partial<FormState> = {}): FormState {
  return {
    network: "",
    deductibleTotal: null,
    deductibleMet: null,
    oopMaxTotal: null,
    oopMet: null,
    deductibleOopStructure: null,
    patientStatusId: "",
    currentTierId: "",
    verifiedTierId: "",
    deductibleApplies: null,
    coinsurancePercent: null,
    copayAmount: null,
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

  it("OOP satisfied via oopMet alone", () => {
    const f = computeFinancials(
      baseState({ oopMaxTotal: 5000, oopMet: 5000 }),
    );
    expect(f.oopSatisfied).toBe(true);
    expect(f.oopRemaining).toBe(0);
  });

  it("excludes activities not counting toward OOP", () => {
    const f = computeFinancials(
      baseState({
        oopMaxTotal: 5000,
        oopMet: 0,
        activities: [
          activity({ id: "1", clientPayment: 4000, countsTowardOop: false }),
          activity({ id: "2", clientPayment: 500, countsTowardOop: true }),
        ],
      }),
    );
    expect(f.totalPaymentsToOop).toBe(500);
    expect(f.oopRemaining).toBe(4500);
  });

  it("flags crossTierWarning when verified differs from current", () => {
    const f = computeFinancials(
      baseState({ currentTierId: "iop", verifiedTierId: "php" }),
    );
    expect(f.crossTierWarning).toBe(true);
  });

  it("does not flag cross-tier when ids match", () => {
    const f = computeFinancials(
      baseState({ currentTierId: "iop", verifiedTierId: "iop" }),
    );
    expect(f.crossTierWarning).toBe(false);
  });

  it("does not flag cross-tier when one side is empty", () => {
    const f = computeFinancials(
      baseState({ currentTierId: "iop", verifiedTierId: "" }),
    );
    expect(f.crossTierWarning).toBe(false);
  });

  it("handles separate vs combined structure (informational only)", () => {
    const sep = computeFinancials(
      baseState({
        deductibleOopStructure: "separate",
        deductibleTotal: 1000,
        deductibleMet: 200,
        oopMaxTotal: 3000,
        oopMet: 500,
      }),
    );
    expect(sep.deductibleRemaining).toBe(800);
    expect(sep.oopRemaining).toBe(2500);

    const comb = computeFinancials(
      baseState({
        deductibleOopStructure: "combined",
        deductibleTotal: 1000,
        deductibleMet: 200,
        oopMaxTotal: 3000,
        oopMet: 500,
      }),
    );
    expect(comb.deductibleRemaining).toBe(800);
    expect(comb.oopRemaining).toBe(2500);
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
