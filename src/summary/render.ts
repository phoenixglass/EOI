import type { FacilityConfig } from "../config/schema";
import type { FormState } from "../state/formState";
import { generateSnapshots, type SnapshotOutput } from "./snapshot";

export type SummaryOutput = SnapshotOutput;

export function renderSummaries(
  config: FacilityConfig,
  state: FormState,
): SummaryOutput {
  return generateSnapshots(config, state);
}
