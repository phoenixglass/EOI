import type { FacilityConfig } from "../config/schema";
import type {
  CopayRule,
  FormState,
  NetworkStatus,
  TriState,
} from "../state/formState";
import {
  calculateEstimate,
  formatMoney,
  formatPercent,
  type EstimateResult,
} from "../calc/calculations";

export interface SnapshotOutput {
  staff: string;
  patient: string;
  generatedAt: string;
}

export function generateSnapshots(
  config: FacilityConfig,
  state: FormState,
  now: Date = new Date(),
): SnapshotOutput {
  const generatedAt = now.toLocaleString(config.vocabulary.currency.locale);
  const estimate = calculateEstimate(state);
  return {
    staff: generateStaffSnapshot(config, state, estimate, generatedAt),
    patient: generatePatientSnapshot(config, state, estimate, generatedAt),
    generatedAt,
  };
}

const m = (config: FacilityConfig, n: number | null | undefined): string =>
  formatMoney(
    typeof n === "number" && Number.isFinite(n) ? n : null,
    config.vocabulary.currency.locale,
    config.vocabulary.currency.code,
  );

const p = (n: number | null | undefined): string =>
  formatPercent(
    typeof n === "number" && Number.isFinite(n) ? n : null,
  );

function tierLabel(config: FacilityConfig, id: string): string {
  return config.serviceTiers.find((t) => t.id === id)?.label ?? "";
}

function networkLabel(s: NetworkStatus | null): string {
  switch (s) {
    case "inn":
      return "In-network";
    case "oon":
      return "Out-of-network";
    case "unknown":
      return "Unknown";
    default:
      return "Not entered";
  }
}

function networkExplanation(s: NetworkStatus | null): string {
  switch (s) {
    case "inn":
      return "This provider is in-network with your plan. Your insurance benefits usually process at the in-network benefit level, as long as the service is covered.";
    case "oon":
      return "This provider is out-of-network with your plan. Your insurance may still help pay for this visit, but your cost may be higher than it would be with an in-network provider. The final amount depends on how your insurance processes the claim.";
    case "unknown":
    default:
      return "The network status for this provider is unknown. Because of that, the final amount may vary depending on how your insurance processes the claim.";
  }
}

function deductibleHeadlineCfg(
  config: FacilityConfig,
  state: FormState,
  estimate: EstimateResult,
): string {
  const v = state.deductibleApplies;
  if (v === "no") return "Your deductible does not apply to this visit.";
  if (v === "unknown" || v === null)
    return "We could not confirm whether your deductible applies to this visit. Because of that, we cannot estimate the exact amount you may owe.";
  if (estimate.deductibleIsMet)
    return "Your deductible does apply to this visit, but your deductible appears to have already been met.";
  return `Your deductible does apply to this visit.\n\nBecause your deductible has not been met yet, you may be responsible for the allowed cost of this visit until the remaining ${m(config, estimate.deductibleRemaining ?? 0)} deductible is met.`;
}

function copayLineCfg(config: FacilityConfig, state: FormState): string {
  const rule = state.copayRule;
  const amount = state.copayAmount;
  if (state.copayApplies === "no" || rule === "no_copay") {
    return "No copay is listed for this visit.";
  }
  if (rule === "unknown" || rule === null) {
    return "Your plan shows a copay, but the timing/rule for the copay is unknown. Because of that, we cannot estimate the exact amount you may owe.";
  }
  switch (rule) {
    case "copay_only":
      return `Your plan shows a ${m(config, amount)} copay for this visit.`;
    case "copay_before_deductible":
      return `Your plan shows a ${m(config, amount)} copay for this visit. Your deductible may also apply after the copay.`;
    case "copay_after_deductible":
      return `Your plan shows a ${m(config, amount)} copay after your deductible is met.`;
    case "copay_plus_coinsurance":
      return `Your plan shows a ${m(config, amount)} copay plus coinsurance for this visit.`;
    case "copay_instead_of_coinsurance":
      return `Your plan shows a ${m(config, amount)} copay instead of coinsurance for this visit.`;
  }
  return "";
}

function coinsuranceLine(state: FormState): string {
  if (state.coinsuranceApplies === "no") {
    return "No coinsurance is listed for this visit.";
  }
  if (
    state.coinsuranceApplies === "unknown" ||
    state.coinsuranceApplies === null
  ) {
    return "We could not confirm whether coinsurance applies to this visit.";
  }
  if (
    state.coinsurancePercent !== null &&
    Number.isFinite(state.coinsurancePercent)
  ) {
    return `After your deductible is met, your plan says you are responsible for ${p(state.coinsurancePercent)} of the allowed amount for this type of visit.`;
  }
  return "Coinsurance applies after the deductible, but no coinsurance percentage was entered.";
}

function separateBucketNote(
  state: FormState,
  visitType: string,
): string | null {
  if (state.bucketStructure !== "separate") return null;

  const lines: string[] = [];
  lines.push(
    "Your deductible and out-of-pocket maximum are tracked separately for this benefit.",
  );

  const dBucket = state.serviceAppliesToDeductibleBucket;
  const oBucket = state.serviceAppliesToOOPBucket;
  if (dBucket === "yes" && oBucket === "no") {
    lines.push("");
    lines.push(
      `That means meeting your out-of-pocket maximum does not automatically mean this visit is covered at 100%. For this ${visitType.toLowerCase()}, the service applies to your deductible bucket but does not apply to your out-of-pocket maximum bucket.`,
    );
  } else if (dBucket === "no" && oBucket === "yes") {
    lines.push("");
    lines.push(
      `For this ${visitType.toLowerCase()}, the service applies to your out-of-pocket maximum bucket but does not apply to your deductible bucket.`,
    );
  } else {
    lines.push("");
    lines.push(
      "That means meeting your out-of-pocket maximum does not automatically mean this visit is covered at 100%.",
    );
  }
  return lines.join("\n");
}

function whatThisMeans(
  config: FacilityConfig,
  state: FormState,
  estimate: EstimateResult,
): string {
  const lines: string[] = [];
  if (estimate.oopMaxOverrideApplied) {
    lines.push(
      "Your out-of-pocket maximum appears to have been met. For covered services, your insurance should generally pay 100% of the allowed amount for the rest of the plan year. You may still owe for services that are not covered, denied, excluded, or above what your insurance allows.",
    );
    return lines.join("\n\n");
  }

  const dApplies = state.deductibleApplies;
  if (dApplies === "yes" && !estimate.deductibleIsMet) {
    lines.push(
      `Because your deductible has not been met yet, you may be responsible for the allowed cost of this visit until the remaining ${m(config, estimate.deductibleRemaining ?? 0)} deductible is met.`,
    );
  } else if (dApplies === "yes" && estimate.deductibleIsMet) {
    lines.push("Your deductible appears to be met for the year.");
  } else if (dApplies === "no") {
    lines.push("Your deductible does not apply to this visit.");
  }

  if (
    state.coinsuranceApplies === "yes" &&
    state.coinsurancePercent !== null
  ) {
    if (dApplies === "yes" && !estimate.deductibleIsMet) {
      lines.push(
        `After your deductible is met, you would usually pay ${p(state.coinsurancePercent)} of the allowed amount for this type of visit.`,
      );
    } else {
      lines.push(
        `You would usually pay ${p(state.coinsurancePercent)} of the allowed amount for this type of visit.`,
      );
    }
  }

  return lines.join("\n\n");
}

function estimateBlock(
  config: FacilityConfig,
  state: FormState,
  estimate: EstimateResult,
): string | null {
  if (estimate.oopMaxOverrideApplied) {
    return [
      `Estimated amount you may owe for this visit: ${m(config, 0)}`,
      "",
      "Your out-of-pocket maximum appears to have been met. For covered services, your insurance should generally pay 100% of the allowed amount.",
      "",
      "You may still owe for services that are not covered, denied, excluded, or above what your insurance allows.",
    ].join("\n");
  }

  if (!estimate.canEstimate) {
    const reason = explainEstimateGap(state, estimate);
    return [
      "We do not have enough information to estimate the exact dollar amount for this visit because the final amount depends on what your insurance allows for the claim.",
      "",
      reason,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const lines: string[] = [];
  lines.push(
    `Estimated amount you may owe for this visit: ${m(config, estimate.finalPatientEstimate)}`,
  );
  lines.push("");
  lines.push(
    `This estimate is based on the ${estimate.calculationBasisLabel} of ${m(config, estimate.calculationAmount)}.`,
  );

  if (estimate.deductiblePortion > 0) {
    if (
      estimate.amountAfterDeductible <= 0 &&
      estimate.coinsuranceAmount <= 0
    ) {
      lines.push("");
      lines.push(
        `Because your deductible has not been met yet, the full ${m(config, estimate.deductiblePortion)} would go toward your remaining deductible.`,
      );
      const remainingAfter =
        (estimate.deductibleRemaining ?? 0) - estimate.deductiblePortion;
      lines.push("");
      lines.push(
        `After this visit, your remaining deductible would be about ${m(config, Math.max(remainingAfter, 0))}.`,
      );
      if (
        state.coinsuranceApplies === "yes" &&
        (state.coinsurancePercent === null ||
          !Number.isFinite(state.coinsurancePercent))
      ) {
        lines.push("");
        lines.push(
          "The missing coinsurance percentage does not affect this estimate because this visit does not exceed your remaining deductible. Coinsurance would only matter if the allowed amount were more than the deductible you have left.",
        );
      }
    } else {
      lines.push("");
      lines.push(
        `The first ${m(config, estimate.deductiblePortion)} would go toward meeting your deductible.`,
      );
      if (estimate.coinsuranceAmount > 0 && estimate.amountAfterDeductible > 0) {
        lines.push(
          `After that, the remaining ${m(config, estimate.amountAfterDeductible)} would be subject to your ${p(state.coinsurancePercent)} coinsurance.`,
        );
        lines.push(
          `Your estimated coinsurance would be ${m(config, estimate.coinsuranceAmount)}.`,
        );
      }
    }
  } else if (estimate.coinsuranceAmount > 0 && state.coinsurancePercent !== null) {
    lines.push("");
    lines.push(
      `Your estimated coinsurance would be ${m(config, estimate.coinsuranceAmount)} (${p(state.coinsurancePercent)} of the allowed amount).`,
    );
  }

  if (estimate.copayAmountUsed > 0) {
    lines.push("");
    lines.push(
      `Your plan's ${m(config, estimate.copayAmountUsed)} copay is included in the estimate.`,
    );
  }

  if (estimate.oopCapApplied) {
    lines.push("");
    lines.push(
      `Your estimated responsibility would normally be ${m(config, estimate.patientResponsibilityBeforeOOP)}, but you only have ${m(config, estimate.oopRemaining ?? 0)} left before reaching your out-of-pocket maximum. Because of that, your estimated responsibility for covered services may be limited to ${m(config, estimate.finalPatientEstimate)}.`,
    );
  } else if (
    estimate.deductiblePortion > 0 &&
    estimate.coinsuranceAmount > 0
  ) {
    lines.push("");
    lines.push(
      `Your estimated total responsibility would be ${m(config, estimate.finalPatientEstimate)}.`,
    );
  }

  return lines.join("\n");
}

function explainEstimateGap(
  state: FormState,
  estimate: EstimateResult,
): string {
  const reasons = estimate.cannotEstimateReasons;
  const parts: string[] = [];
  if (reasons.includes("deductible_applicability_unknown")) {
    parts.push(
      "We could not confirm whether the deductible applies to this visit.",
    );
  }
  if (reasons.includes("copay_rule_unknown")) {
    parts.push(
      "The plan shows a copay, but the copay timing/rule is unknown.",
    );
  }
  if (reasons.includes("coinsurance_applicability_unknown")) {
    parts.push(
      "We could not confirm whether coinsurance applies to this visit.",
    );
  }
  if (reasons.includes("coinsurance_percent_unknown")) {
    parts.push(
      "Coinsurance applies, but no coinsurance percentage was entered.",
    );
  }
  if (reasons.includes("service_deductible_bucket_unknown")) {
    parts.push(
      "We could not confirm whether this service applies to your deductible bucket.",
    );
  }
  if (reasons.includes("no_dollar_basis")) {
    parts.push(
      "We do not have an allowed amount or provider charge estimate for this service.",
    );
  }

  if (
    state.deductibleApplies === "yes" &&
    estimate.deductibleRemaining !== null &&
    estimate.deductibleRemaining > 0
  ) {
    parts.push(
      `Based on your benefits, you may be responsible for the allowed cost of the visit until your remaining ${formatMoney(estimate.deductibleRemaining, "en-US", "USD")} deductible is met.`,
    );
  }
  return parts.join("\n\n");
}

function generatePatientSnapshot(
  config: FacilityConfig,
  state: FormState,
  estimate: EstimateResult,
  generatedAt: string,
): string {
  const visitType = tierLabel(config, state.currentTierId) || "your visit";
  const network = networkLabel(state.networkStatus);
  const out: string[] = [];

  out.push(config.branding.facilityName);
  out.push(`Generated ${generatedAt}`);
  out.push("");
  out.push("Hi — here's a quick summary of your insurance for this visit.");
  out.push("");
  out.push(`Visit type: ${visitType}`);
  out.push(`Network status: ${network}`);
  out.push("");
  out.push(networkExplanation(state.networkStatus));
  out.push("");

  out.push("Your deductible:");
  out.push(`Your deductible is ${m(config, state.deductibleTotal)} total.`);
  out.push(`You have met ${m(config, state.deductibleMet ?? 0)} so far.`);
  out.push(
    `You have ${m(config, estimate.deductibleRemaining ?? null)} left to meet.`,
  );
  out.push("");

  out.push("Your out-of-pocket maximum:");
  out.push(
    `Your out-of-pocket maximum is ${m(config, state.oopMaxTotal)} total.`,
  );
  out.push(`You have met ${m(config, state.oopMet ?? 0)} so far.`);
  out.push(
    `You have ${m(config, estimate.oopRemaining ?? null)} left before reaching your maximum.`,
  );
  out.push("");

  const bucketNote = separateBucketNote(state, visitType);
  if (bucketNote) {
    out.push("Important bucket note:");
    out.push(bucketNote);
    out.push("");
  }

  out.push(`For this ${visitType.toLowerCase()}:`);
  out.push(deductibleHeadlineCfg(config, state, estimate));
  out.push(copayLineCfg(config, state));
  out.push(coinsuranceLine(state));
  out.push("");

  const meaning = whatThisMeans(config, state, estimate);
  if (meaning) {
    out.push("What this means:");
    out.push(meaning);
    out.push("");
  }

  const eb = estimateBlock(config, state, estimate);
  if (eb) {
    out.push(eb);
    out.push("");
  }

  out.push("Important:");
  out.push(
    config.branding.footerDisclaimer ||
      "This is an estimate of benefits, not a guarantee of payment. Final amounts depend on your insurance company's processing of the claim, including what they allow, what they consider covered, and any plan limits.",
  );
  const billingPhone =
    config.branding.billingPhone || extractPhone(config.branding.contactLine);
  if (billingPhone) {
    out.push("");
    out.push(`Billing questions: ${billingPhone}`);
  } else if (config.branding.contactLine) {
    out.push("");
    out.push(config.branding.contactLine);
  }

  return out.join("\n");
}

function extractPhone(s?: string): string | undefined {
  if (!s) return undefined;
  const idx = s.toLowerCase().indexOf("billing questions:");
  if (idx >= 0) return s.slice(idx + "billing questions:".length).trim();
  return undefined;
}

function generateStaffSnapshot(
  config: FacilityConfig,
  state: FormState,
  estimate: EstimateResult,
  generatedAt: string,
): string {
  const out: string[] = [];
  out.push(config.branding.facilityName);
  out.push(`Generated ${generatedAt}`);
  out.push("");
  out.push("Staff benefit snapshot");
  out.push("");
  out.push(`Network: ${networkLabel(state.networkStatus)}`);
  out.push(
    `Service tier: ${tierLabel(config, state.currentTierId) || "(not set)"}`,
  );
  if (
    state.verifiedTierId &&
    state.verifiedTierId !== state.currentTierId
  ) {
    out.push(
      `Verified tier mismatch: ${tierLabel(config, state.verifiedTierId) || state.verifiedTierId}`,
    );
  }
  out.push("");

  out.push("Plan:");
  out.push(
    `Deductible: ${m(config, state.deductibleTotal)} total / ${m(config, state.deductibleMet ?? 0)} met / ${m(config, estimate.deductibleRemaining ?? null)} remaining`,
  );
  out.push(
    `OOP max: ${m(config, state.oopMaxTotal)} total / ${m(config, state.oopMet ?? 0)} met / ${m(config, estimate.oopRemaining ?? null)} remaining`,
  );
  out.push(`Bucket structure: ${labelStructure(state.bucketStructure)}`);
  out.push("");

  out.push("Tier rules:");
  out.push(`Deductible applies: ${labelTri(state.deductibleApplies)}`);
  out.push(`Coinsurance applies: ${labelTri(state.coinsuranceApplies)}`);
  out.push(`Coinsurance: ${p(state.coinsurancePercent)}`);
  out.push(`Copay applies: ${labelTri(state.copayApplies)}`);
  out.push(`Copay amount: ${m(config, state.copayAmount)}`);
  out.push(`Copay rule: ${labelCopayRule(state.copayRule)}`);
  out.push("");

  out.push("Estimate:");
  if (estimate.oopMaxOverrideApplied) {
    out.push(
      `Estimated patient responsibility: ${m(config, 0)} (OOP max met).`,
    );
  } else if (estimate.canEstimate) {
    out.push(
      `Estimated patient responsibility: ${m(config, estimate.finalPatientEstimate)} (basis: ${estimate.calculationBasisLabel} ${m(config, estimate.calculationAmount)}).`,
    );
    if (estimate.deductiblePortion > 0)
      out.push(`  Deductible portion: ${m(config, estimate.deductiblePortion)}`);
    if (estimate.coinsuranceAmount > 0)
      out.push(`  Coinsurance: ${m(config, estimate.coinsuranceAmount)}`);
    if (estimate.copayAmountUsed > 0)
      out.push(`  Copay applied: ${m(config, estimate.copayAmountUsed)}`);
    if (estimate.oopCapApplied)
      out.push(`  Capped by OOP remaining: ${m(config, estimate.oopRemaining ?? 0)}`);
  } else {
    out.push("No dollar estimate generated.");
    if (estimate.cannotEstimateReasons.length > 0) {
      out.push(
        `Reason(s): ${estimate.cannotEstimateReasons.map(reasonLabel).join("; ")}`,
      );
    }
  }
  out.push("");

  if (config.finalCheck.length > 0) {
    out.push("Final checks:");
    for (const c of config.finalCheck) {
      out.push(`${c.label}: ${state.finalCheck[c.id] ? "Yes" : "No"}`);
    }
    out.push("");
  }

  out.push("Disclaimer:");
  out.push(
    "Estimate of benefits only. Final amount depends on payer processing.",
  );

  return out.join("\n");
}

function labelTri(v: TriState | null): string {
  if (v === "yes") return "Yes";
  if (v === "no") return "No";
  if (v === "unknown") return "Unknown";
  return "—";
}

function labelStructure(
  v: "combined" | "separate" | "unknown" | null,
): string {
  if (v === "combined") return "Combined";
  if (v === "separate") return "Separate";
  if (v === "unknown") return "Unknown";
  return "—";
}

function labelCopayRule(v: CopayRule | null): string {
  switch (v) {
    case "no_copay":
      return "No copay";
    case "copay_only":
      return "Copay only";
    case "copay_before_deductible":
      return "Copay before deductible";
    case "copay_after_deductible":
      return "Copay after deductible";
    case "copay_plus_coinsurance":
      return "Copay plus coinsurance";
    case "copay_instead_of_coinsurance":
      return "Copay instead of coinsurance";
    case "unknown":
      return "Unknown";
    default:
      return "—";
  }
}

function reasonLabel(r: string): string {
  switch (r) {
    case "no_dollar_basis":
      return "No allowed amount or provider charge estimate entered";
    case "deductible_applicability_unknown":
      return "Deductible applicability unknown";
    case "copay_rule_unknown":
      return "Copay timing/rule unknown";
    case "coinsurance_applicability_unknown":
      return "Coinsurance applicability unknown";
    case "coinsurance_percent_unknown":
      return "Coinsurance percent missing";
    case "service_deductible_bucket_unknown":
      return "Service deductible bucket applicability unknown";
    default:
      return r;
  }
}

// Re-exports for tests/UI that currently consume the older render module.
export type { EstimateResult };
