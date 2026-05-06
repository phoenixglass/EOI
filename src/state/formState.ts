import type { FacilityConfig } from "../config/schema";

export type TriState = "yes" | "no" | "unknown";
export type DeductibleApplies = TriState;
export type DeductibleOopStructure = "combined" | "separate" | "unknown";
export type NetworkStatus = "inn" | "oon" | "unknown";

export type CopayRule =
  | "no_copay"
  | "copay_only"
  | "copay_before_deductible"
  | "copay_after_deductible"
  | "copay_plus_coinsurance"
  | "copay_instead_of_coinsurance"
  | "unknown";

export type EstimateBasis =
  | "allowed_amount"
  | "provider_charge"
  | "usual_allowed_estimate"
  | "no_dollar_estimate";

export interface ActivityEntry {
  id: string;
  tierId: string;
  clientPayment: number | null;
  assistance: number | null;
  assistanceTypeId: string;
  countsTowardOop: boolean;
  countsTowardDeductible: boolean;
  notes: string;
}

export interface FormState {
  networkStatus: NetworkStatus | null;
  deductibleTotal: number | null;
  deductibleMet: number | null;
  oopMaxTotal: number | null;
  oopMet: number | null;
  bucketStructure: DeductibleOopStructure | null;
  patientStatusId: string;
  currentTierId: string;
  verifiedTierId: string;

  deductibleApplies: TriState | null;

  coinsuranceApplies: TriState | null;
  coinsurancePercent: number | null;

  copayApplies: TriState | null;
  copayAmount: number | null;
  copayRule: CopayRule | null;

  estimatedProviderCharge: number | null;
  estimatedAllowedAmount: number | null;
  estimateBasis: EstimateBasis | null;

  serviceAppliesToDeductibleBucket: TriState | null;
  serviceAppliesToOOPBucket: TriState | null;

  activities: ActivityEntry[];
  currentBalance: number | null;
  finalCheck: Record<string, boolean>;
}

export type FormAction =
  | { type: "set"; key: keyof FormState; value: FormState[keyof FormState] }
  | { type: "addActivity"; entry: ActivityEntry }
  | { type: "updateActivity"; id: string; patch: Partial<ActivityEntry> }
  | { type: "removeActivity"; id: string }
  | { type: "toggleCheck"; id: string; value: boolean }
  | { type: "applyTierDefaults"; tierId: string; config: FacilityConfig }
  | { type: "reset"; initial: FormState };

export function makeInitialState(_config: FacilityConfig): FormState {
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
  };
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "set":
      return { ...state, [action.key]: action.value };
    case "addActivity":
      return { ...state, activities: [...state.activities, action.entry] };
    case "updateActivity":
      return {
        ...state,
        activities: state.activities.map((a) =>
          a.id === action.id ? { ...a, ...action.patch } : a,
        ),
      };
    case "removeActivity":
      return {
        ...state,
        activities: state.activities.filter((a) => a.id !== action.id),
      };
    case "toggleCheck":
      return {
        ...state,
        finalCheck: { ...state.finalCheck, [action.id]: action.value },
      };
    case "applyTierDefaults": {
      const tier = action.config.serviceTiers.find((t) => t.id === action.tierId);
      if (!tier?.defaults) return state;
      const d = tier.defaults;
      return {
        ...state,
        deductibleApplies: d.deductibleApplies ?? state.deductibleApplies,
        coinsurancePercent:
          d.coinsurancePercent ?? state.coinsurancePercent,
        copayAmount: d.copayAmount ?? state.copayAmount,
        copayRule: d.copayRule ?? state.copayRule,
        coinsuranceApplies: d.coinsuranceApplies ?? state.coinsuranceApplies,
        copayApplies: d.copayApplies ?? state.copayApplies,
      };
    }
    case "reset":
      return action.initial;
    default:
      return state;
  }
}

export function newActivityId(): string {
  return `a_${Math.random().toString(36).slice(2, 10)}`;
}
