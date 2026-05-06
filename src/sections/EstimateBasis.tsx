import type { Dispatch } from "react";
import type { FacilityConfig } from "../config/schema";
import type {
  EstimateBasis as EstimateBasisType,
  FormAction,
  FormState,
} from "../state/formState";
import { Section } from "../components/Section";
import { Field } from "../components/Field";
import { MoneyInput } from "../components/MoneyInput";
import { SECTION_DEFAULT_TITLES } from "../config/defaults";
import { effectiveLabel, sectionProgress } from "./sectionUtils";

interface Props {
  config: FacilityConfig;
  state: FormState;
  dispatch: Dispatch<FormAction>;
}

export function EstimateBasis({ config, state, dispatch }: Props) {
  const title =
    config.sections.estimateBasis.title ?? SECTION_DEFAULT_TITLES.estimateBasis;
  const fields = config.fields;
  const progress = sectionProgress(config, state, ["estimateBasis"]);

  if (!fields.estimateBasis.enabled) return null;

  return (
    <Section title={title} filled={progress.filled} total={progress.total}>
      <div className="row">
        <Field label="Estimated allowed amount (preferred)">
          <MoneyInput
            value={state.estimatedAllowedAmount}
            onChange={(v) =>
              dispatch({
                type: "set",
                key: "estimatedAllowedAmount",
                value: v,
              })
            }
          />
        </Field>
        <Field label="Estimated provider charge">
          <MoneyInput
            value={state.estimatedProviderCharge}
            onChange={(v) =>
              dispatch({
                type: "set",
                key: "estimatedProviderCharge",
                value: v,
              })
            }
          />
        </Field>
      </div>
      <Field
        label={effectiveLabel(config, "estimateBasis")}
        required={fields.estimateBasis.required}
        helpText="If allowed amount is entered, it is always used. For OON visits, prefer allowed amount or no dollar estimate."
      >
        <select
          value={state.estimateBasis ?? ""}
          onChange={(e) =>
            dispatch({
              type: "set",
              key: "estimateBasis",
              value:
                e.target.value === ""
                  ? null
                  : (e.target.value as EstimateBasisType),
            })
          }
        >
          <option value="">— select —</option>
          <option value="allowed_amount">Allowed amount</option>
          <option value="provider_charge">Provider charge</option>
          <option value="usual_allowed_estimate">Usual allowed estimate</option>
          <option value="no_dollar_estimate">No dollar estimate</option>
        </select>
      </Field>
    </Section>
  );
}
