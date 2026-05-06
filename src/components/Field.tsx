import type { ReactNode } from "react";

interface Props {
  label: string;
  required?: boolean;
  helpText?: string;
  children: ReactNode;
}

export function Field({ label, required, helpText, children }: Props) {
  return (
    <div className="field">
      <label>
        {label}
        {required && <span className="req">*</span>}
      </label>
      {children}
      {helpText && <span className="help">{helpText}</span>}
    </div>
  );
}
