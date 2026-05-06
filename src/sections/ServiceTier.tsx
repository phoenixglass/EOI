import type { Dispatch } from "react";
import type { FacilityConfig } from "../config/schema";
import type { FormAction, FormState } from "../state/formState";
import { Section } from "../components/Section";
import { Field } from "../components/Field";
import { SECTION_DEFAULT_TITLES } from "../config/defaults";
import { effectiveLabel, sectionProgress } from "./sectionUtils";

interface Props {
  config: FacilityConfig;
  state: FormState;
  dispatch: Dispatch<FormAction>;
}

export function ServiceTier({ config, state, dispatch }: Props) {
  const title =
    config.sections.serviceTier.title ?? SECTION_DEFAULT_TITLES.serviceTier;
  const fields = config.fields;
  const progress = sectionProgress(config, state, [
    "patientStatus",
    "currentTier",
    "verifiedTier",
  ]);

  return (
    <Section title={title} filled={progress.filled} total={progress.total}>
      {fields.patientStatus.enabled && (
        <Field
          label={effectiveLabel(config, "patientStatus")}
          required={fields.patientStatus.required}
        >
          <select
            value={state.patientStatusId}
            onChange={(e) =>
              dispatch({
                type: "set",
                key: "patientStatusId",
                value: e.target.value,
              })
            }
          >
            <option value="">— select —</option>
            {config.statusOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      {fields.currentTier.enabled && (
        <Field
          label={effectiveLabel(config, "currentTier")}
          required={fields.currentTier.required}
        >
          <select
            value={state.currentTierId}
            onChange={(e) => {
              const id = e.target.value;
              dispatch({ type: "set", key: "currentTierId", value: id });
              if (id) {
                dispatch({ type: "applyTierDefaults", tierId: id, config });
              }
            }}
          >
            <option value="">— select —</option>
            {config.serviceTiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      {fields.verifiedTier.enabled && (
        <Field
          label={effectiveLabel(config, "verifiedTier")}
          required={fields.verifiedTier.required}
          helpText="The tier the payer has on file. May differ from current."
        >
          <select
            value={state.verifiedTierId}
            onChange={(e) =>
              dispatch({
                type: "set",
                key: "verifiedTierId",
                value: e.target.value,
              })
            }
          >
            <option value="">— select —</option>
            {config.serviceTiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      )}
    </Section>
  );
}
