import type { Dispatch } from "react";
import type { FacilityConfig } from "../config/schema";
import type {
  CopayRule,
  FormAction,
  FormState,
  TriState,
} from "../state/formState";
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
    "copayRule",
    "serviceBucketApplicability",
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

      {fields.coinsurance.enabled && (
        <div className="row">
          <Field
            label="Coinsurance applies?"
            required={fields.coinsurance.required}
          >
            <YesNo
              value={state.coinsuranceApplies}
              onChange={(v) =>
                dispatch({ type: "set", key: "coinsuranceApplies", value: v })
              }
            />
          </Field>
          <Field label={`${effectiveLabel(config, "coinsurance")} %`}>
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
        </div>
      )}

      {fields.copay.enabled && (
        <div className="row">
          <Field
            label="Copay applies?"
            required={fields.copay.required}
          >
            <YesNo
              value={state.copayApplies}
              onChange={(v) => {
                dispatch({ type: "set", key: "copayApplies", value: v });
                // When copay does not apply, force-clear amount/rule. The
                // dropdown otherwise lets staff pick "Copay before deductible"
                // even though copayApplies=No, which is conceptual noise.
                if (v === "no") {
                  dispatch({ type: "set", key: "copayAmount", value: null });
                  dispatch({
                    type: "set",
                    key: "copayRule",
                    value: "no_copay" as CopayRule,
                  });
                }
              }}
            />
          </Field>
          <Field label={effectiveLabel(config, "copay")}>
            <MoneyInput
              value={state.copayAmount}
              onChange={(v) =>
                dispatch({ type: "set", key: "copayAmount", value: v })
              }
              disabled={state.copayApplies === "no"}
            />
          </Field>
        </div>
      )}

      {fields.copayRule.enabled && (
        <Field
          label={effectiveLabel(config, "copayRule")}
          required={fields.copayRule.required}
          helpText={
            state.copayApplies === "no"
              ? "Copay does not apply to this visit, so the copay rule is locked to “No copay”."
              : "Do not infer this from the copay amount alone. Use what the payer says."
          }
        >
          <select
            value={state.copayRule ?? ""}
            disabled={state.copayApplies === "no"}
            onChange={(e) =>
              dispatch({
                type: "set",
                key: "copayRule",
                value:
                  e.target.value === ""
                    ? null
                    : (e.target.value as CopayRule),
              })
            }
          >
            <option value="">— select —</option>
            <option value="no_copay">No copay</option>
            <option value="copay_only">Copay only</option>
            <option value="copay_before_deductible">
              Copay before deductible
            </option>
            <option value="copay_after_deductible">
              Copay after deductible
            </option>
            <option value="copay_plus_coinsurance">
              Copay plus coinsurance
            </option>
            <option value="copay_instead_of_coinsurance">
              Copay instead of coinsurance
            </option>
            <option value="unknown">Unknown</option>
          </select>
        </Field>
      )}

      {fields.serviceBucketApplicability.enabled && (
        <div className="row">
          <Field
            label="Service applies to deductible bucket?"
            helpText="If unsure and structure is Combined, default to Yes."
          >
            <YesNo
              value={state.serviceAppliesToDeductibleBucket}
              onChange={(v: TriState | null) =>
                dispatch({
                  type: "set",
                  key: "serviceAppliesToDeductibleBucket",
                  value: v,
                })
              }
            />
          </Field>
          <Field label="Service applies to OOP max bucket?">
            <YesNo
              value={state.serviceAppliesToOOPBucket}
              onChange={(v: TriState | null) =>
                dispatch({
                  type: "set",
                  key: "serviceAppliesToOOPBucket",
                  value: v,
                })
              }
            />
          </Field>
        </div>
      )}
    </Section>
  );
}
