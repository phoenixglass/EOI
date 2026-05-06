import { useEffect, useState } from "react";
import { parseMoney } from "../calc/calculations";

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  id?: string;
}

export function MoneyInput({ value, onChange, placeholder, id }: Props) {
  const [text, setText] = useState<string>(value === null ? "" : String(value));

  useEffect(() => {
    // Sync when value changes externally (e.g. reset).
    setText(value === null ? "" : String(value));
  }, [value]);

  return (
    <input
      id={id}
      inputMode="decimal"
      placeholder={placeholder ?? "0.00"}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseMoney(e.target.value));
      }}
      onBlur={() => {
        const parsed = parseMoney(text);
        if (parsed === null) {
          setText("");
          onChange(null);
        } else {
          setText(parsed.toFixed(2));
          onChange(parsed);
        }
      }}
    />
  );
}
