"use client";

export function CheckRow({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="check-row">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="check-box" aria-hidden="true">
        {checked ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <polyline points="2.5,6.5 5,9 9.5,3.5" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        ) : null}
      </span>
      <span className="check-label">{children}</span>
    </label>
  );
}
