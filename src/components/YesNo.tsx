interface Props {
  value: "yes" | "no" | "unknown" | null;
  onChange: (v: "yes" | "no" | "unknown" | null) => void;
  disabled?: boolean;
}

export function YesNo({ value, onChange, disabled }: Props) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") onChange(null);
        else onChange(v as "yes" | "no" | "unknown");
      }}
    >
      <option value="">— select —</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
      <option value="unknown">Unknown</option>
    </select>
  );
}
