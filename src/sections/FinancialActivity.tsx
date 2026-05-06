import type { Dispatch } from "react";
import type { FacilityConfig } from "../config/schema";
import {
  newActivityId,
  type FormAction,
  type FormState,
  type ActivityEntry,
} from "../state/formState";
import { Section } from "../components/Section";
import { Field } from "../components/Field";
import { MoneyInput } from "../components/MoneyInput";
import { SECTION_DEFAULT_TITLES } from "../config/defaults";
import { effectiveLabel } from "./sectionUtils";

interface Props {
  config: FacilityConfig;
  state: FormState;
  dispatch: Dispatch<FormAction>;
}

export function FinancialActivity({ config, state, dispatch }: Props) {
  const title =
    config.sections.financialActivity.title ??
    SECTION_DEFAULT_TITLES.financialActivity;
  const fields = config.fields;

  const handleAdd = () => {
    const aType = config.assistanceTypes[0];
    const entry: ActivityEntry = {
      id: newActivityId(),
      tierId: state.currentTierId || config.serviceTiers[0].id,
      clientPayment: null,
      assistance: null,
      assistanceTypeId: aType?.id ?? "",
      countsTowardOop: aType?.defaultCountsTowardOop ?? false,
      countsTowardDeductible: aType?.defaultCountsTowardDeductible ?? false,
      notes: "",
    };
    dispatch({ type: "addActivity", entry });
  };

  return (
    <Section title={title}>
      {fields.priorActivity.enabled && (
        <>
          <p className="help" style={{ margin: "0 0 8px 0" }}>
            Log payments and assistance applied during this episode. Items
            marked &ldquo;counts toward OOP&rdquo; reduce the out-of-pocket
            remaining shown on the summary.
          </p>

          <div className="activities-list">
            {state.activities.length === 0 && (
              <p className="help">No activity entered.</p>
            )}
            {state.activities.map((a) => (
              <ActivityRow
                key={a.id}
                entry={a}
                config={config}
                onChange={(patch) =>
                  dispatch({ type: "updateActivity", id: a.id, patch })
                }
                onRemove={() =>
                  dispatch({ type: "removeActivity", id: a.id })
                }
              />
            ))}
          </div>

          <button onClick={handleAdd}>+ Add activity</button>
        </>
      )}

      {fields.currentBalance.enabled && (
        <div style={{ marginTop: 12 }}>
          <Field label={effectiveLabel(config, "currentBalance")}>
            <MoneyInput
              value={state.currentBalance}
              onChange={(v) =>
                dispatch({ type: "set", key: "currentBalance", value: v })
              }
            />
          </Field>
        </div>
      )}
    </Section>
  );
}

interface RowProps {
  entry: ActivityEntry;
  config: FacilityConfig;
  onChange: (patch: Partial<ActivityEntry>) => void;
  onRemove: () => void;
}

function ActivityRow({ entry, config, onChange, onRemove }: RowProps) {
  return (
    <div className="activity-row">
      <div className="activity-grid">
        <Field label="Tier">
          <select
            value={entry.tierId}
            onChange={(e) => onChange({ tierId: e.target.value })}
          >
            {config.serviceTiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assistance type">
          <select
            value={entry.assistanceTypeId}
            onChange={(e) => {
              const id = e.target.value;
              const t = config.assistanceTypes.find((x) => x.id === id);
              onChange({
                assistanceTypeId: id,
                countsTowardOop: t?.defaultCountsTowardOop ?? entry.countsTowardOop,
                countsTowardDeductible:
                  t?.defaultCountsTowardDeductible ?? entry.countsTowardDeductible,
              });
            }}
          >
            <option value="">— none —</option>
            {config.assistanceTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Patient payment">
          <MoneyInput
            value={entry.clientPayment}
            onChange={(v) => onChange({ clientPayment: v })}
          />
        </Field>
        <Field label="Assistance amount">
          <MoneyInput
            value={entry.assistance}
            onChange={(v) => onChange({ assistance: v })}
          />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
        <label style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={entry.countsTowardOop}
            onChange={(e) => onChange({ countsTowardOop: e.target.checked })}
          />{" "}
          Counts toward OOP
        </label>
        <label style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={entry.countsTowardDeductible}
            onChange={(e) =>
              onChange({ countsTowardDeductible: e.target.checked })
            }
          />{" "}
          Counts toward deductible
        </label>
        <button className="subtle" onClick={onRemove} style={{ marginLeft: "auto" }}>
          Remove
        </button>
      </div>
      <Field label="Notes">
        <input
          type="text"
          value={entry.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </Field>
    </div>
  );
}
