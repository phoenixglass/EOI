import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FacilityConfig } from "../config/schema";
import { renderSummaries } from "./render";
import { makeInitialState, type FormState } from "../state/formState";

function loadConfig(rel: string) {
  const full = resolve(process.cwd(), rel);
  const raw = JSON.parse(readFileSync(full, "utf8"));
  return FacilityConfig.parse(raw);
}

describe("renderSummaries (e2e)", () => {
  it("default config renders without throwing for empty state", () => {
    const cfg = loadConfig("public/config/default.json");
    const state: FormState = makeInitialState(cfg);
    const out = renderSummaries(cfg, state);
    expect(out.staff).toContain("Acme Urgent Care");
    expect(out.patient).toContain("Acme Urgent Care");
  });

  it("bh-clinic renders client noun and episode-activity loop", () => {
    const cfg = loadConfig("public/config/bh-clinic.json");
    const state: FormState = {
      ...makeInitialState(cfg),
      network: "In-network",
      deductibleTotal: 2000,
      deductibleMet: 500,
      oopMaxTotal: 5000,
      oopMet: 1000,
      deductibleOopStructure: "separate",
      patientStatusId: "in_treatment",
      currentTierId: "iop",
      verifiedTierId: "iop",
      deductibleApplies: "yes",
      coinsurancePercent: 20,
      copayAmount: 30,
      activities: [
        {
          id: "1",
          tierId: "iop",
          clientPayment: 200,
          assistance: 100,
          assistanceTypeId: "scholarship",
          countsTowardOop: true,
          countsTowardDeductible: false,
          notes: "first week",
        },
      ],
      currentBalance: 50,
    };
    const out = renderSummaries(cfg, state);
    expect(out.staff).toContain("Northwood Behavioral Health");
    expect(out.staff).toContain("In treatment");
    expect(out.staff).toContain("IOP");
    expect(out.staff).toMatch(/\$200\.00/);
    // Vocabulary "episode" should appear via t.episodeNoun substitution
    expect(out.patient.toLowerCase()).toContain("episode");
  });

  it("oopSatisfied surfaces in patient summary", () => {
    const cfg = loadConfig("public/config/default.json");
    const state: FormState = {
      ...makeInitialState(cfg),
      network: "In-network",
      deductibleTotal: 1000,
      deductibleMet: 1000,
      oopMaxTotal: 3000,
      oopMet: 3000,
      currentTierId: "office_visit",
    };
    const out = renderSummaries(cfg, state);
    expect(out.patient).toMatch(/met your out-of-pocket max/i);
  });
});
