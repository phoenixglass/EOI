import type { Dispatch } from "react";
import type { FacilityConfig } from "../config/schema";
import type { FormAction, FormState } from "../state/formState";
import { Section } from "../components/Section";
import { SECTION_DEFAULT_TITLES } from "../config/defaults";

interface Props {
  config: FacilityConfig;
  state: FormState;
  dispatch: Dispatch<FormAction>;
}

export function FinalCheck({ config, state, dispatch }: Props) {
  const title =
    config.sections.finalCheck.title ?? SECTION_DEFAULT_TITLES.finalCheck;
  if (config.finalCheck.length === 0) return null;

  const total = config.finalCheck.length;
  const filled = config.finalCheck.filter((c) => state.finalCheck[c.id]).length;

  return (
    <Section title={title} filled={filled} total={total}>
      <div className="checklist">
        {config.finalCheck.map((c) => (
          <label key={c.id}>
            <input
              type="checkbox"
              checked={!!state.finalCheck[c.id]}
              onChange={(e) =>
                dispatch({
                  type: "toggleCheck",
                  id: c.id,
                  value: e.target.checked,
                })
              }
            />
            <span>
              {c.label}
              {c.required && <span style={{ color: "var(--error)" }}> *</span>}
            </span>
          </label>
        ))}
      </div>
    </Section>
  );
}
