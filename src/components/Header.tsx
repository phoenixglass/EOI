import type { Branding } from "../config/schema";

interface Props {
  branding: Branding;
  onClear: () => void;
}

export function Header({ branding, onClear }: Props) {
  return (
    <header className="app-header">
      {branding.logoUrl && (
        <img className="logo" src={branding.logoUrl} alt="" />
      )}
      <h1>{branding.facilityName}</h1>
      {branding.contactLine && (
        <span className="contact">{branding.contactLine}</span>
      )}
      <button onClick={onClear}>Clear form</button>
    </header>
  );
}
