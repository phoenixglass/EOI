import type { Dispatch } from "react";
import type { FacilityConfig } from "../config/schema";
import type {
  DeductibleOopStructure,
  FormAction,
  FormState,
  NetworkStatus,
} from "../state/formState";
import { Section } from "../components/Section";
import { Field } from "../components/Field";
import { MoneyInput } from "../components/MoneyInput";
import { SECTION_DEFAULT_TITLES } from "../config/defaults";
import { effectiveLabel, fieldMeta, sectionProgress } from "./sectionUtils";

interface Props {
  config: FacilityConfig;
  state: FormState;
  dispatch: Dispatch<FormAction>;
}

export function PlanBasics({ config, state, dispatch }: Props) {
  const fields = config.fields;
  const title =
    config.sections.planBasics.title ?? SECTION_DEFAULT_TITLES.planBasics;
  const progress = sectionProgress(config, state, [
    "network",
    "deductible",
    "oopMax",
    "bucketStructure",
  ]);

  return (
    <Section title={title} filled={progress.filled} total={progress.total}>
      {fields.network.enabled && (
        <Field
          label={effectiveLabel(config, "network")}
          required={fields.network.required}
          helpText={fieldMeta(config, "network").helpText}
        >
          <select
            value={state.networkStatus ?? ""}
            onChange={(e) =>
              dispatch({
                type: "set",
                key: "networkStatus",
                value:
                  e.target.value === ""
                    ? null
                    : (e.target.value as NetworkStatus),
              })
            }
          >
            <option value="">— select —</option>
            <option value="inn">In-network</option>
            <option value="oon">Out-of-network</option>
            <option value="unknown">Unknown</option>
          </select>
        </Field>
      )}

      {fields.deductible.enabled && (
        <div className="row">
          <Field
            label={`${effectiveLabel(config, "deductible")} — total`}
            required={fields.deductible.required}
          >
            <MoneyInput
              value={state.deductibleTotal}
              onChange={(v) =>
                dispatch({ type: "set", key: "deductibleTotal", value: v })
              }
            />
          </Field>
          <Field label={`${effectiveLabel(config, "deductible")} — met`}>
            <MoneyInput
              value={state.deductibleMet}
              onChange={(v) =>
                dispatch({ type: "set", key: "deductibleMet", value: v })
              }
            />
          </Field>
        </div>
      )}

      {fields.oopMax.enabled && (
        <div className="row">
          <Field
            label={`${effectiveLabel(config, "oopMax")} — total`}
            required={fields.oopMax.required}
          >
            <MoneyInput
              value={state.oopMaxTotal}
              onChange={(v) =>
                dispatch({ type: "set", key: "oopMaxTotal", value: v })
              }
            />
          </Field>
          <Field label={`${effectiveLabel(config, "oopMax")} — met`}>
            <MoneyInput
              value={state.oopMet}
              onChange={(v) =>
                dispatch({ type: "set", key: "oopMet", value: v })
              }
            />
          </Field>
        </div>
      )}

      {fields.bucketStructure.enabled && (
        <Field
          label={effectiveLabel(config, "bucketStructure")}
          required={fields.bucketStructure.required}
          helpText="Whether the deductible and OOP max share a single bucket or are tracked separately."
        >
          <select
            value={state.bucketStructure ?? ""}
            onChange={(e) =>
              dispatch({
                type: "set",
                key: "bucketStructure",
                value:
                  e.target.value === ""
                    ? null
                    : (e.target.value as DeductibleOopStructure),
              })
            }
          >
            <option value="">— select —</option>
            <option value="combined">Combined</option>
            <option value="separate">Separate</option>
            <option value="unknown">Unknown</option>
          </select>
        </Field>
      )}
    </Section>
  );
}
