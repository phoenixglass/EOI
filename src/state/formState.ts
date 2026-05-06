import type { FacilityConfig } from "../config/schema";

export type DeductibleApplies = "yes" | "no" | "unknown";
export type DeductibleOopStructure = "combined" | "separate";

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
  network: string;
  deductibleTotal: number | null;
  deductibleMet: number | null;
  oopMaxTotal: number | null;
  oopMet: number | null;
  deductibleOopStructure: DeductibleOopStructure | null;
  patientStatusId: string;
  currentTierId: string;
  verifiedTierId: string;
  deductibleApplies: DeductibleApplies | null;
  coinsurancePercent: number | null;
  copayAmount: number | null;
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
