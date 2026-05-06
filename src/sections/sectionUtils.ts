import type { FacilityConfig, FieldToggle } from "../config/schema";
import type { FormState } from "../state/formState";
import { FIELD_DEFAULT_LABELS } from "../config/defaults";

export type FieldKey = keyof FacilityConfig["fields"];

export function fieldMeta(
  config: FacilityConfig,
  key: FieldKey,
): FieldToggle & { defaultLabel: string } {
  const cfg = config.fields[key];
  return {
    ...cfg,
    defaultLabel: FIELD_DEFAULT_LABELS[key],
  };
}

export function effectiveLabel(
  config: FacilityConfig,
  key: FieldKey,
): string {
  const m = fieldMeta(config, key);
  return m.label ?? m.defaultLabel;
}

export function isFieldComplete(
  state: FormState,
  key: FieldKey,
): boolean {
  switch (key) {
    case "network":
      return state.networkStatus !== null;
    case "deductible":
      return state.deductibleTotal !== null;
    case "oopMax":
      return state.oopMaxTotal !== null;
    case "bucketStructure":
      return state.bucketStructure !== null;
    case "patientStatus":
      return state.patientStatusId !== "";
    case "currentTier":
      return state.currentTierId !== "";
    case "verifiedTier":
      return state.verifiedTierId !== "";
    case "deductibleApplies":
      return state.deductibleApplies !== null;
    case "coinsurance":
      return (
        state.coinsuranceApplies !== null &&
        (state.coinsuranceApplies !== "yes" ||
          state.coinsurancePercent !== null)
      );
    case "copay":
      return state.copayApplies !== null;
    case "copayRule":
      return state.copayRule !== null;
    case "estimateBasis":
      return state.estimateBasis !== null;
    case "serviceBucketApplicability":
      return (
        state.serviceAppliesToDeductibleBucket !== null &&
        state.serviceAppliesToOOPBucket !== null
      );
    case "priorActivity":
      return true; // activity list is always considered "complete" (can be empty)
    case "currentBalance":
      return state.currentBalance !== null;
  }
}

export function sectionProgress(
  config: FacilityConfig,
  state: FormState,
  keys: FieldKey[],
): { filled: number; total: number } {
  const enabled = keys.filter((k) => config.fields[k].enabled);
  const filled = enabled.filter((k) => isFieldComplete(state, k)).length;
  return { filled, total: enabled.length };
}
