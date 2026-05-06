import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FacilityConfig } from "../config/schema";
import { generateSnapshots } from "./snapshot";
import { makeInitialState, type FormState } from "../state/formState";

function loadConfig(rel: string) {
  const full = resolve(process.cwd(), rel);
  const raw = JSON.parse(readFileSync(full, "utf8"));
  return FacilityConfig.parse(raw);
}

const FIXED_DATE = new Date("2026-05-06T14:53:00");

describe("generateSnapshots — patient wording", () => {
  it("default config renders without throwing for empty state", () => {
    const cfg = loadConfig("public/config/default.json");
    const state: FormState = makeInitialState(cfg);
    const out = generateSnapshots(cfg, state, FIXED_DATE);
    expect(out.staff).toContain("Acme Urgent Care");
    expect(out.patient).toContain("Acme Urgent Care");
  });

  it("OON, no allowed amount → patient sees deductible explanation and no dollar estimate", () => {
    const cfg = loadConfig("public/config/default.json");
    const state: FormState = {
      ...makeInitialState(cfg),
      networkStatus: "oon",
      deductibleTotal: 2000,
      deductibleMet: 943,
      oopMaxTotal: 5000,
      oopMet: 958,
      bucketStructure: "combined",
      currentTierId: "office_visit",
      deductibleApplies: "yes",
      coinsuranceApplies: "yes",
      coinsurancePercent: 20,
      copayApplies: "no",
      copayRule: "no_copay",
      estimateBasis: "no_dollar_estimate",
      serviceAppliesToDeductibleBucket: "yes",
      serviceAppliesToOOPBucket: "yes",
    };
    const out = generateSnapshots(cfg, state, FIXED_DATE);
    expect(out.patient).toContain("Out-of-network");
    expect(out.patient).toContain("$1,057.00 left to meet");
    expect(out.patient).toContain("$4,042.00 left before reaching your maximum");
    expect(out.patient).toContain("Your deductible does apply");
    expect(out.patient).toContain("No copay is listed");
    expect(out.patient).toContain("20% of the allowed amount");
    expect(out.patient).toContain(
      "We do not have enough information to estimate the exact dollar amount",
    );
    expect(out.patient).toContain("Billing questions: (555) 555-0100");
    expect(out.patient).toContain("not a guarantee of payment");
  });

  it("$1500 visit crosses deductible → shows split and final $1,145.60", () => {
    const cfg = loadConfig("public/config/default.json");
    const state: FormState = {
      ...makeInitialState(cfg),
      networkStatus: "inn",
      deductibleTotal: 2000,
      deductibleMet: 943,
      oopMaxTotal: 5000,
      oopMet: 958,
      bucketStructure: "combined",
      currentTierId: "office_visit",
      deductibleApplies: "yes",
      coinsuranceApplies: "yes",
      coinsurancePercent: 20,
      copayApplies: "no",
      copayRule: "no_copay",
      estimatedAllowedAmount: 1500,
      estimateBasis: "allowed_amount",
      serviceAppliesToDeductibleBucket: "yes",
      serviceAppliesToOOPBucket: "yes",
    };
    const out = generateSnapshots(cfg, state, FIXED_DATE);
    expect(out.patient).toMatch(/Estimated amount you may owe.*\$1,145\.60/);
    expect(out.patient).toContain("$1,057.00 would go toward");
    expect(out.patient).toContain("$443.00 would be subject to your 20%");
    expect(out.patient).toContain("$88.60");
  });

  it("OOP max met → patient sees override language", () => {
    const cfg = loadConfig("public/config/default.json");
    const state: FormState = {
      ...makeInitialState(cfg),
      networkStatus: "inn",
      deductibleTotal: 2000,
      deductibleMet: 2000,
      oopMaxTotal: 5000,
      oopMet: 5000,
      bucketStructure: "combined",
      currentTierId: "office_visit",
      deductibleApplies: "yes",
      coinsuranceApplies: "yes",
      coinsurancePercent: 20,
      copayApplies: "no",
      copayRule: "no_copay",
      estimateBasis: "no_dollar_estimate",
      serviceAppliesToDeductibleBucket: "yes",
      serviceAppliesToOOPBucket: "yes",
    };
    const out = generateSnapshots(cfg, state, FIXED_DATE);
    expect(out.patient).toContain(
      "Your out-of-pocket maximum appears to have been met",
    );
    expect(out.patient).toMatch(/100%/);
    expect(out.patient).toContain("not covered, denied, excluded");
  });

  it("OOP cap applied — wording explains the cap", () => {
    const cfg = loadConfig("public/config/default.json");
    const state: FormState = {
      ...makeInitialState(cfg),
      networkStatus: "inn",
      deductibleTotal: 2000,
      deductibleMet: 2000,
      oopMaxTotal: 5000,
      oopMet: 4900,
      bucketStructure: "combined",
      currentTierId: "office_visit",
      deductibleApplies: "yes",
      coinsuranceApplies: "yes",
      coinsurancePercent: 20,
      copayApplies: "no",
      copayRule: "no_copay",
      estimatedAllowedAmount: 1000,
      estimateBasis: "allowed_amount",
      serviceAppliesToDeductibleBucket: "yes",
      serviceAppliesToOOPBucket: "yes",
    };
    const out = generateSnapshots(cfg, state, FIXED_DATE);
    expect(out.patient).toContain("$200.00");
    expect(out.patient).toContain("$100.00 left before reaching");
    expect(out.patient).toContain("limited to $100.00");
  });

  it("copay rule unknown → no dollar estimate, explains why", () => {
    const cfg = loadConfig("public/config/default.json");
    const state: FormState = {
      ...makeInitialState(cfg),
      networkStatus: "inn",
      deductibleTotal: 2000,
      deductibleMet: 0,
      oopMaxTotal: 5000,
      oopMet: 0,
      bucketStructure: "combined",
      currentTierId: "office_visit",
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
    };
    const out = generateSnapshots(cfg, state, FIXED_DATE);
    expect(out.patient).toContain(
      "We do not have enough information to estimate",
    );
    expect(out.patient).toContain(
      "copay timing/rule is unknown",
    );
  });

  it("deductible applicability unknown → wording explains gap", () => {
    const cfg = loadConfig("public/config/default.json");
    const state: FormState = {
      ...makeInitialState(cfg),
      networkStatus: "inn",
      deductibleTotal: 2000,
      deductibleMet: 0,
      oopMaxTotal: 5000,
      oopMet: 0,
      bucketStructure: "combined",
      currentTierId: "office_visit",
      deductibleApplies: "unknown",
      coinsuranceApplies: "no",
      copayApplies: "no",
      copayRule: "no_copay",
      estimateBasis: "no_dollar_estimate",
      serviceAppliesToDeductibleBucket: "yes",
      serviceAppliesToOOPBucket: "yes",
    };
    const out = generateSnapshots(cfg, state, FIXED_DATE);
    expect(out.patient).toContain(
      "We could not confirm whether your deductible applies",
    );
  });

  it("staff snapshot includes structured plan and tier rules", () => {
    const cfg = loadConfig("public/config/default.json");
    const state: FormState = {
      ...makeInitialState(cfg),
      networkStatus: "oon",
      deductibleTotal: 2000,
      deductibleMet: 943,
      oopMaxTotal: 5000,
      oopMet: 958,
      bucketStructure: "combined",
      currentTierId: "office_visit",
      deductibleApplies: "yes",
      coinsuranceApplies: "yes",
      coinsurancePercent: 20,
      copayApplies: "no",
      copayRule: "no_copay",
      estimateBasis: "no_dollar_estimate",
      serviceAppliesToDeductibleBucket: "yes",
      serviceAppliesToOOPBucket: "yes",
    };
    const out = generateSnapshots(cfg, state, FIXED_DATE);
    expect(out.staff).toContain("Network: Out-of-network");
    expect(out.staff).toContain("Service tier: Office visit");
    expect(out.staff).toContain("Bucket structure: Combined");
    expect(out.staff).toContain("Deductible applies: Yes");
    expect(out.staff).toContain("No dollar estimate generated");
  });

  it("uses copay-after-deductible: small visit fits inside deductible → patient pays full visit", () => {
    const cfg = loadConfig("public/config/default.json");
    const state: FormState = {
      ...makeInitialState(cfg),
      networkStatus: "inn",
      deductibleTotal: 2000,
      deductibleMet: 0,
      oopMaxTotal: 5000,
      oopMet: 0,
      bucketStructure: "combined",
      currentTierId: "office_visit",
      deductibleApplies: "yes",
      coinsuranceApplies: "no",
      copayApplies: "yes",
      copayAmount: 30,
      copayRule: "copay_after_deductible",
      estimatedAllowedAmount: 150,
      estimateBasis: "allowed_amount",
      serviceAppliesToDeductibleBucket: "yes",
      serviceAppliesToOOPBucket: "yes",
    };
    const out = generateSnapshots(cfg, state, FIXED_DATE);
    expect(out.patient).toMatch(/Estimated amount you may owe.*\$150\.00/);
  });
});
