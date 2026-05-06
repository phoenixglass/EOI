import type { Dispatch } from "react";
import type { FacilityConfig } from "../config/schema";
import type { FormAction, FormState } from "../state/formState";
import { Section } from "../components/Section";
import { Field } from "../components/Field";
import { MoneyInput } from "../components/MoneyInput";
import { YesNo } from "../components/YesNo";
import { SECTION_DEFAULT_TITLES } from "../config/defaults";
import { effectiveLabel, sectionProgress } from "./sectionUtils";

interface Props {
  config: FacilityConfig;
  state: FormState;
  dispatch: Dispatch<FormAction>;
}

export function TierRules({ config, state, dispatch }: Props) {
  const title =
    config.sections.tierRules.title ?? SECTION_DEFAULT_TITLES.tierRules;
  const fields = config.fields;
  const progress = sectionProgress(config, state, [
    "deductibleApplies",
    "coinsurance",
    "copay",
  ]);

  return (
    <Section title={title} filled={progress.filled} total={progress.total}>
      {fields.deductibleApplies.enabled && (
        <Field
          label={effectiveLabel(config, "deductibleApplies")}
          required={fields.deductibleApplies.required}
        >
          <YesNo
            value={state.deductibleApplies}
            onChange={(v) =>
              dispatch({ type: "set", key: "deductibleApplies", value: v })
            }
          />
        </Field>
      )}

      <div className="row">
        {fields.coinsurance.enabled && (
          <Field
            label={effectiveLabel(config, "coinsurance")}
            required={fields.coinsurance.required}
          >
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={state.coinsurancePercent ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "set",
                  key: "coinsurancePercent",
                  value: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </Field>
        )}

        {fields.copay.enabled && (
          <Field
            label={effectiveLabel(config, "copay")}
            required={fields.copay.required}
          >
            <MoneyInput
              value={state.copayAmount}
              onChange={(v) =>
                dispatch({ type: "set", key: "copayAmount", value: v })
              }
            />
          </Field>
        )}
      </div>
    </Section>
  );
}
